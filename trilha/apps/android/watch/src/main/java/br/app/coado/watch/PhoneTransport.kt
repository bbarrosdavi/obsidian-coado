package br.app.coado.watch

import android.util.Log
import br.app.coado.shared.data.ApiException
import br.app.coado.shared.data.Transport
import br.app.coado.shared.data.Wear
import br.app.coado.shared.model.Snapshot
import br.app.coado.shared.model.SyncRequest
import br.app.coado.shared.model.json
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.serialization.encodeToString

/**
 * A conta pelo celular. O recorte vem como item de dados que o celular publica; os estudos do
 * pulso vão como itens que o celular sobe e apaga. Nada aqui precisa do celular por perto na
 * hora: o Data Layer entrega quando os dois se encontram.
 */
class PhoneTransport(private val app: CoadoWatchApp) : Transport {
    override val label = "pelo celular"
    override val confirmsPush = false

    override suspend fun pull(today: String): Snapshot {
        val before = app.store.snapshot.value?.fetchedAt ?: 0
        // o que já chegou enquanto o app estava fechado
        Wear.read(app, Wear.SNAPSHOT)?.let { WatchListenerService.apply(app, it) }
        val asked = Wear.send(app, Wear.REFRESH)
        if (asked) {
            // o celular baixa um recorte novo e publica; esperamos um pouco por ele
            withTimeoutOrNull(12_000) {
                app.store.snapshot.filter { it != null && it.fetchedAt > before }.first()
            }
        }
        val snap = app.store.snapshot.value
        if (snap == null) {
            throw ApiException(0, if (asked) "phone" else "no_phone", if (asked) "O celular ainda não respondeu." else "Celular fora de alcance. Abra o Coado nele.")
        }
        if (!asked) Log.i(TAG, "celular fora de alcance: usando o recorte guardado")
        return snap
    }

    override suspend fun push(req: SyncRequest) {
        req.upserts?.studies?.forEach { Wear.put(app, Wear.STUDY + it.id, json.encodeToString(it)) }
        req.upserts?.reviews?.forEach { Wear.put(app, Wear.REVIEW + it.id, json.encodeToString(it)) }
        req.settings?.timerPrefs?.let { Wear.put(app, Wear.SETTINGS, json.encodeToString(it)) }
    }

    private companion object {
        const val TAG = "CoadoPhone"
    }
}
