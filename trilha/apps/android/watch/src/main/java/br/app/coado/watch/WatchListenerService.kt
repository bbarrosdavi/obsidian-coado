package br.app.coado.watch

import android.util.Log
import br.app.coado.shared.CoadoCore
import br.app.coado.shared.data.Wear
import br.app.coado.shared.model.Snapshot
import br.app.coado.shared.model.json
import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.WearableListenerService
import kotlinx.coroutines.runBlocking

/** O celular publicou um recorte novo da conta */
class WatchListenerService : WearableListenerService() {
    override fun onDataChanged(events: DataEventBuffer) {
        val app = CoadoCore.of(this)
        val payloads = events.filter { it.type == DataEvent.TYPE_CHANGED && it.dataItem.uri.path == Wear.SNAPSHOT }
            .mapNotNull { Wear.payload(it.dataItem) }
        if (payloads.isEmpty()) return
        runBlocking { payloads.forEach { apply(app, it) } }
    }

    companion object {
        private const val TAG = "CoadoWatch"

        suspend fun apply(app: CoadoCore, payload: String) {
            val snap = runCatching { json.decodeFromString<Snapshot>(payload) }.getOrElse {
                Log.w(TAG, "recorte ilegível: ${it.message}")
                return
            }
            app.store.awaitLoaded()
            val current = app.store.snapshot.value
            if (current != null && current.fetchedAt >= snap.fetchedAt && snap.fetchedAt != 0L) return
            app.store.setSnapshot(if (snap.fetchedAt == 0L) snap.copy(fetchedAt = System.currentTimeMillis()) else snap)
            app.store.updatePrefs { it.copy(lastSyncAt = System.currentTimeMillis(), lastSyncError = "") }
            Log.i(TAG, "recorte do celular aplicado (${snap.studies.size} estudos)")
        }
    }
}
