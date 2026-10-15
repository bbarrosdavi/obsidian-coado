package br.app.coado.phone

import android.util.Log
import br.app.coado.shared.data.Wear
import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.WearableListenerService
import kotlinx.coroutines.runBlocking

/** O relógio registrou um estudo, mudou as durações ou pediu um recorte novo */
class PhoneListenerService : WearableListenerService() {
    private val app get() = application as CoadoPhoneApp

    override fun onDataChanged(events: DataEventBuffer) {
        val mine = events.any { e ->
            val path = e.dataItem.uri.path.orEmpty()
            e.type == DataEvent.TYPE_CHANGED && (path.startsWith(Wear.STUDY) || path.startsWith(Wear.REVIEW) || path == Wear.SETTINGS)
        }
        if (!mine) return
        runBlocking {
            app.store.awaitLoaded()
            app.absorbWatchItems()
        }
        app.sync.enqueue()
    }

    override fun onMessageReceived(event: MessageEvent) {
        if (event.path != Wear.REFRESH) return
        Log.i(CoadoPhoneApp.TAG, "o relógio pediu um recorte novo")
        app.sync.enqueue()
    }
}
