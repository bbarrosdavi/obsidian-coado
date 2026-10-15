package br.app.coado.shared.data

import br.app.coado.shared.model.ApiErrorBody
import br.app.coado.shared.model.AuthConfig
import br.app.coado.shared.model.PairResponse
import br.app.coado.shared.model.Snapshot
import br.app.coado.shared.model.SyncRequest
import br.app.coado.shared.model.json
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.TimeUnit

/** Erro devolvido pela api (status 0 = sem conexão) */
class ApiException(val status: Int, val code: String, message: String) : Exception(message) {
    val offline get() = status == 0
    val unauthorized get() = status == 401
}

/**
 * O cliente da api do Coado (packages/shared/src/api.ts). O token de aparelho vai em
 * `Authorization: Bearer`; toda escrita leva o cabeçalho anti-CSRF, como no navegador.
 */
class Api(private val userAgent: String) {
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    suspend fun authConfig(server: String): AuthConfig =
        json.decodeFromString(call(server, "GET", "/auth/config", null, null))

    /** Sign in with Google nativo: o id_token vira uma sessão de aparelho */
    suspend fun googleToken(server: String, idToken: String, device: String): PairResponse =
        json.decodeFromString(call(server, "POST", "/auth/google/token", """{"idToken":${quote(idToken)},"device":${quote(device)}}""", null))

    /** O visitante de desenvolvimento (AUTH_DEV_LOGIN=true no servidor) */
    suspend fun devToken(server: String, name: String, email: String, device: String): PairResponse =
        json.decodeFromString(call(server, "POST", "/auth/dev/token", """{"name":${quote(name)},"email":${quote(email)},"device":${quote(device)}}""", null))

    /** O relógio sozinho: troca o código de Configurações → Relógio por um token */
    suspend fun pair(server: String, code: String, device: String): PairResponse =
        json.decodeFromString(call(server, "POST", "/watch/pair", """{"code":${quote(code)},"device":${quote(device)}}""", null))

    suspend fun snapshot(server: String, token: String, today: String): Snapshot =
        json.decodeFromString(call(server, "GET", "/watch/snapshot?today=$today", null, token))

    suspend fun sync(server: String, token: String, req: SyncRequest) {
        call(server, "POST", "/sync", json.encodeToString(req), token)
    }

    suspend fun logout(server: String, token: String) {
        call(server, "POST", "/auth/logout", null, token)
    }

    private fun quote(s: String) = json.encodeToString(s)

    private suspend fun call(server: String, method: String, path: String, body: String?, token: String?): String = withContext(Dispatchers.IO) {
        val base = server.trim().trimEnd('/')
        val req = Request.Builder()
            .url("$base/api$path")
            .header("Accept", "application/json")
            .header("User-Agent", userAgent)
            .apply {
                if (token != null) header("Authorization", "Bearer $token")
                if (method != "GET") header("X-Coado-Request", "1")
            }
            .method(method, if (method == "GET") null else (body ?: "").toRequestBody(JSON))
            .build()
        val res = try {
            client.newCall(req).execute()
        } catch (e: IOException) {
            throw ApiException(0, "offline", "Sem conexão com o servidor.")
        }
        res.use {
            val text = it.body?.string().orEmpty()
            if (!it.isSuccessful) {
                val err = runCatching { json.decodeFromString<ApiErrorBody>(text) }.getOrNull()
                throw ApiException(it.code, err?.error ?: "http", err?.message?.ifBlank { null } ?: "Erro ${it.code}")
            }
            text
        }
    }

    private companion object {
        val JSON = "application/json; charset=utf-8".toMediaType()
    }
}
