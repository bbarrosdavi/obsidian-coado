package br.app.coado.shared.data

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import br.app.coado.shared.model.Draft
import br.app.coado.shared.model.LocalPrefs
import br.app.coado.shared.model.Pending
import br.app.coado.shared.model.Review
import br.app.coado.shared.model.Snapshot
import br.app.coado.shared.model.Study
import br.app.coado.shared.model.TimerPrefs
import br.app.coado.shared.model.json
import br.app.coado.shared.timer.TimerState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.KSerializer
import kotlinx.serialization.serializer

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore("coado")

/**
 * O que o aparelho guarda, em JSON num DataStore: o recorte da conta, o que ainda não subiu, os
 * ajustes, a sessão em andamento e a sessão encerrada à espera do registro. Tudo fica em memória
 * (StateFlow) e vai ao disco a cada mudança; o alarme do fim da etapa lê daqui ao acordar o processo.
 */
class Store(context: Context) {
    private val ds = context.applicationContext.dataStore
    private val lock = Mutex()

    private val _snapshot = MutableStateFlow<Snapshot?>(null)
    private val _pending = MutableStateFlow(Pending())
    private val _prefs = MutableStateFlow(LocalPrefs())
    private val _timer = MutableStateFlow(TimerState())
    private val _draft = MutableStateFlow<Draft?>(null)
    private val _loaded = MutableStateFlow(false)

    val snapshot: StateFlow<Snapshot?> = _snapshot
    val pending: StateFlow<Pending> = _pending
    val prefs: StateFlow<LocalPrefs> = _prefs
    val timer: StateFlow<TimerState> = _timer
    val draft: StateFlow<Draft?> = _draft
    val loaded: StateFlow<Boolean> = _loaded

    suspend fun load() {
        val p = ds.data.first()
        _snapshot.value = read(p, SNAPSHOT)
        _pending.value = read(p, PENDING) ?: Pending()
        _prefs.value = read(p, PREFS) ?: LocalPrefs()
        _timer.value = read(p, TIMER) ?: TimerState()
        _draft.value = read(p, DRAFT)
        _loaded.value = true
    }

    suspend fun awaitLoaded() {
        _loaded.first { it }
    }

    private inline fun <reified T> read(p: Preferences, key: Preferences.Key<String>): T? =
        p[key]?.let { runCatching { json.decodeFromString<T>(it) }.getOrNull() }

    private suspend fun <T> write(key: Preferences.Key<String>, value: T?, serializer: KSerializer<T>) {
        ds.edit { if (value == null) it.remove(key) else it[key] = json.encodeToString(serializer, value) }
    }

    /** As durações em vigor: as editadas aqui, senão as da conta, senão o padrão */
    fun effectivePrefs(): TimerPrefs = _prefs.value.timerPrefs ?: _snapshot.value?.timerPrefs ?: TimerPrefs()

    /**
     * Recorte novo da conta. O que ele já contém deixa de estar pendente, e as durações da conta
     * passam a valer se nenhuma edição local espera envio.
     */
    suspend fun setSnapshot(s: Snapshot) {
        awaitLoaded()
        lock.withLock {
        _snapshot.value = s
        write(SNAPSHOT, s, serializer())
        val known = s.studies.map { it.id }.toSet()
        val pending = _pending.value
        if (pending.studies.any { it.id in known }) {
            val left = Pending(
                studies = pending.studies.filter { it.id !in known },
                reviews = pending.reviews.filter { it.studyId !in known },
            )
            _pending.value = left
            write(PENDING, left, serializer())
        }
        val prefs = _prefs.value
        if (!prefs.prefsDirty && prefs.timerPrefs != null && prefs.timerPrefs != s.timerPrefs) {
            updatePrefsLocked { it.copy(timerPrefs = null) }
        } else if (prefs.prefsDirty && prefs.timerPrefs == s.timerPrefs) {
            updatePrefsLocked { it.copy(prefsDirty = false) }
        }
    }
    }

    suspend fun updatePrefs(fn: (LocalPrefs) -> LocalPrefs) {
        awaitLoaded()
        lock.withLock { updatePrefsLocked(fn) }
    }

    private suspend fun updatePrefsLocked(fn: (LocalPrefs) -> LocalPrefs) {
        val next = fn(_prefs.value)
        if (next == _prefs.value) return
        _prefs.value = next
        write(PREFS, next, serializer())
    }

    suspend fun setTimer(t: TimerState) {
        awaitLoaded()
        lock.withLock {
        _timer.value = t
        write(TIMER, t, serializer())
    }
    }

    suspend fun setDraft(d: Draft?) {
        awaitLoaded()
        lock.withLock {
        _draft.value = d
        write(DRAFT, d, serializer())
    }
    }

    suspend fun addPending(studies: List<Study>, reviews: List<Review>) {
        awaitLoaded()
        lock.withLock {
        val next = Pending(_pending.value.studies + studies, _pending.value.reviews + reviews)
        _pending.value = next
        write(PENDING, next, serializer())
    }
    }

    suspend fun removePending(studyIds: Set<String>, reviewIds: Set<String>) {
        awaitLoaded()
        lock.withLock {
        val next = Pending(
            _pending.value.studies.filter { it.id !in studyIds },
            _pending.value.reviews.filter { it.id !in reviewIds },
        )
        _pending.value = next
        write(PENDING, next, serializer())
    }
    }

    /** Sai da conta: token, recorte e pendências vão embora; os ajustes do aparelho ficam */
    suspend fun signOut() {
        awaitLoaded()
        lock.withLock {
        _snapshot.value = null
        write(SNAPSHOT, null, serializer<Snapshot>())
        _pending.value = Pending()
        write(PENDING, null, serializer<Pending>())
        _draft.value = null
        write(DRAFT, null, serializer<Draft>())
        updatePrefsLocked { it.copy(token = "", accountName = "", accountEmail = "", timerPrefs = null, prefsDirty = false, lastSyncAt = 0, lastSyncError = "") }
    }
    }

    private companion object {
        val SNAPSHOT = stringPreferencesKey("snapshot")
        val PENDING = stringPreferencesKey("pending")
        val PREFS = stringPreferencesKey("prefs")
        val TIMER = stringPreferencesKey("timer")
        val DRAFT = stringPreferencesKey("draft")
    }
}
