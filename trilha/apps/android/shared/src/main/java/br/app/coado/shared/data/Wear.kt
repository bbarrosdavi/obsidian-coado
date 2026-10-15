package br.app.coado.shared.data

import android.content.Context
import android.util.Log
import com.google.android.gms.wearable.DataItem
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable
import kotlinx.coroutines.tasks.await

/*
 * A ponte entre o celular e o relógio pelo Data Layer do Wear OS (mesmo pacote nos dois).
 *
 *   celular ──► /coado/snapshot            o recorte da conta, republicado a cada sincronização
 *   relógio ──► /coado/study/<id>          um estudo registrado no pulso (o celular sobe e apaga o item)
 *   relógio ──► /coado/review/<id>         as revisões agendadas junto
 *   relógio ──► /coado/settings            as durações editadas no relógio
 *   relógio ──► mensagem /coado/refresh    "me manda um recorte novo"
 *
 * Itens de dados ficam guardados e chegam quando os dois se encontram: um estudo registrado sem o
 * celular por perto sobe assim que ele aparecer.
 */
object Wear {
    const val SNAPSHOT = "/coado/snapshot"
    const val STUDY = "/coado/study/"
    const val REVIEW = "/coado/review/"
    const val SETTINGS = "/coado/settings"
    const val REFRESH = "/coado/refresh"
    private const val TAG = "CoadoWear"

    suspend fun put(context: Context, path: String, payload: String) {
        val req = PutDataMapRequest.create(path).apply {
            dataMap.putString("json", payload)
            // o mesmo conteúdo republicado não gera evento: o carimbo força a mudança
            dataMap.putLong("at", System.currentTimeMillis())
        }.asPutDataRequest().setUrgent()
        Wearable.getDataClient(context).putDataItem(req).await()
    }

    fun payload(item: DataItem): String? = runCatching { DataMapItem.fromDataItem(item).dataMap.getString("json") }.getOrNull()

    /** O item mais recente neste caminho, de qualquer nó */
    suspend fun read(context: Context, path: String): String? = items(context) { it.uri.path == path }.maxByOrNull { it.second }?.first

    /** Todos os itens cujo caminho começa com o prefixo */
    suspend fun readAll(context: Context, prefix: String): List<String> = items(context) { it.uri.path.orEmpty().startsWith(prefix) }.map { it.first }

    private suspend fun items(context: Context, filter: (DataItem) -> Boolean): List<Pair<String, Long>> {
        val buffer = Wearable.getDataClient(context).dataItems.await()
        try {
            return buffer.filter(filter).mapNotNull { item ->
                val map = runCatching { DataMapItem.fromDataItem(item).dataMap }.getOrNull() ?: return@mapNotNull null
                map.getString("json")?.let { it to map.getLong("at") }
            }
        } finally {
            buffer.release()
        }
    }

    /** Apaga os itens de um prefixo (o celular, depois de subir os estudos do relógio) */
    suspend fun delete(context: Context, prefix: String) {
        val client = Wearable.getDataClient(context)
        val buffer = client.dataItems.await()
        val uris = try {
            buffer.filter { it.uri.path.orEmpty().startsWith(prefix) }.map { it.uri }
        } finally {
            buffer.release()
        }
        for (uri in uris) runCatching { client.deleteDataItems(uri).await() }.onFailure { Log.w(TAG, "não apagou $uri: ${it.message}") }
    }

    /** Manda uma mensagem aos nós conectados agora; false se não há nenhum por perto */
    suspend fun send(context: Context, path: String, payload: ByteArray = ByteArray(0)): Boolean {
        val nodes = runCatching { Wearable.getNodeClient(context).connectedNodes.await() }.getOrDefault(emptyList())
        if (nodes.isEmpty()) return false
        var delivered = false
        for (node in nodes) {
            runCatching { Wearable.getMessageClient(context).sendMessage(node.id, path, payload).await() }
                .onSuccess { delivered = true }
                .onFailure { Log.w(TAG, "mensagem $path para ${node.displayName} falhou: ${it.message}") }
        }
        return delivered
    }

    /** Há um aparelho pareado por perto (celular ou relógio)? */
    suspend fun hasPeer(context: Context): Boolean =
        runCatching { Wearable.getNodeClient(context).connectedNodes.await().isNotEmpty() }.getOrDefault(false)
}
