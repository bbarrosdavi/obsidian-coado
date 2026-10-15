package br.app.coado.shared.data

import android.content.Context
import android.util.Log
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import br.app.coado.shared.CoadoCore
import br.app.coado.shared.model.Dates
import br.app.coado.shared.model.Snapshot
import br.app.coado.shared.model.SyncRequest
import br.app.coado.shared.model.SyncSettings
import br.app.coado.shared.model.SyncUpserts
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import java.util.concurrent.TimeUnit

sealed interface SyncStatus {
    data object Idle : SyncStatus
    data object Syncing : SyncStatus
    data class Ok(val at: Long) : SyncStatus
    data class Error(val message: String) : SyncStatus
    data object SignedOut : SyncStatus
}

/** Por onde este aparelho chega à conta */
interface Transport {
    val label: String
    /** o envio já confirma a chegada ao servidor (direto) ou só a entrega ao celular (Data Layer) */
    val confirmsPush: Boolean
    suspend fun pull(today: String): Snapshot
    suspend fun push(req: SyncRequest)
}

/** Direto na api, com o token de aparelho */
class DirectTransport(private val server: String, private val token: String, private val api: Api) : Transport {
    override val label = "direta"
    override val confirmsPush = true
    override suspend fun pull(today: String) = api.snapshot(server, token, today)
    override suspend fun push(req: SyncRequest) = api.sync(server, token, req)
}

/**
 * Sincronização em lote, como a do navegador: sobe o que ficou pendente (estudos, revisões,
 * durações editadas) e baixa o recorte novo. Falhas ficam para a próxima tentativa, que o
 * WorkManager agenda com rede.
 */
class SyncManager(private val app: CoadoCore) {
    private val _status = MutableStateFlow<SyncStatus>(SyncStatus.Idle)
    val status: StateFlow<SyncStatus> = _status

    suspend fun syncNow(): Boolean {
        app.store.awaitLoaded()
        val transport = app.transport()
        if (transport == null) {
            _status.value = SyncStatus.SignedOut
            return false
        }
        _status.value = SyncStatus.Syncing
        val store = app.store
        return try {
            app.beforeSync()
            val pending = store.pending.value
            val prefs = store.prefs.value
            val req = SyncRequest(
                upserts = if (pending.isEmpty) null else SyncUpserts(pending.studies.ifEmpty { null }, pending.reviews.ifEmpty { null }),
                settings = if (prefs.prefsDirty && prefs.timerPrefs != null) SyncSettings(prefs.timerPrefs) else null,
            )
            if (!req.isEmpty) {
                transport.push(req)
                if (transport.confirmsPush) {
                    store.removePending(pending.studies.map { it.id }.toSet(), pending.reviews.map { it.id }.toSet())
                    if (req.settings != null) store.updatePrefs { it.copy(prefsDirty = false) }
                }
            }
            val now = System.currentTimeMillis()
            val snap = transport.pull(Dates.today()).copy(fetchedAt = now)
            store.setSnapshot(snap)
            store.updatePrefs { it.copy(lastSyncAt = now, lastSyncError = "") }
            app.afterSync(snap)
            _status.value = SyncStatus.Ok(now)
            true
        } catch (e: Exception) {
            Log.w(TAG, "sincronização falhou: ${e.message}")
            val message = e.message ?: "Falha na sincronização."
            store.updatePrefs { it.copy(lastSyncError = message) }
            if (e is ApiException && e.unauthorized) app.onUnauthorized()
            _status.value = SyncStatus.Error(message)
            false
        }
    }

    /** Agenda (ou reagenda) um envio assim que houver rede */
    fun enqueue() {
        val request = OneTimeWorkRequestBuilder<SyncWorker>()
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build()
        WorkManager.getInstance(app).enqueueUniqueWork(WORK, ExistingWorkPolicy.REPLACE, request)
    }

    companion object {
        const val WORK = "coado-sync"
        const val TAG = "CoadoSync"
    }
}

class SyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val app = CoadoCore.of(applicationContext)
        return when {
            app.sync.syncNow() -> Result.success()
            app.sync.status.value is SyncStatus.SignedOut -> Result.failure()
            runAttemptCount < 6 -> Result.retry()
            else -> Result.failure()
        }
    }
}
