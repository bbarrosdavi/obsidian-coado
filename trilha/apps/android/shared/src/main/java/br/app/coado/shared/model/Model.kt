package br.app.coado.shared.model

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/*
 * O recorte do Coado que cabe nos aparelhos. Os nomes dos campos são os do contrato da api
 * (packages/shared/src/api.ts e types.ts): o JSON vai e volta sem tradução.
 */

val json = Json {
    ignoreUnknownKeys = true
    // opcionais ausentes ficam de fora: o zod da api recusa `null` em campos `.optional()`
    explicitNulls = false
    encodeDefaults = true
}

@Serializable
data class TimerPrefs(
    val pomodoroStudy: Int = 25,
    val pomodoroShort: Int = 5,
    val pomodoroLong: Int = 15,
    val pomodoroRounds: Int = 4,
    val countdown: Int = 60,
    val sound: Boolean = true,
)

@Serializable
data class WeeklyGoal(val minutes: Int = 0, val questions: Int = 0)

@Serializable
data class PlanLite(
    val id: String,
    val name: String,
    val examDate: String? = null,
    /** "universidade" ou ausente (concurso) */
    val kind: String? = null,
    val weeklyGoal: WeeklyGoal = WeeklyGoal(),
)

/** Avaliação pendente (modo universidade): prova, trabalho, lista */
@Serializable
data class WatchAssessment(
    val id: String,
    val subjectId: String,
    val name: String,
    val kind: String = "prova",
    /** YYYY-MM-DD */
    val date: String,
    /** HH:mm */
    val time: String? = null,
)

@Serializable
data class SubjectLite(val id: String, val name: String, val color: String)

@Serializable
data class CategoryLite(val id: String, val name: String)

@Serializable
data class CycleItem(val id: String, val subjectId: String, /** minutos planejados */ val duration: Int)

@Serializable
data class PlanningLite(
    val type: String = "cycle",
    val cycle: List<CycleItem> = emptyList(),
    /** estudos com data >= esta contam para o ciclo atual */
    val cycleStartedAt: String,
    val completedCycles: Int = 0,
)

/** Estudo como vem no recorte (sem material, páginas, vídeos e comentário) */
@Serializable
data class WatchStudy(
    val id: String,
    val subjectId: String,
    val topicId: String? = null,
    val categoryId: String,
    /** YYYY-MM-DD */
    val date: String,
    /** HH:mm */
    val time: String? = null,
    /** segundos */
    val duration: Int,
    val hits: Int = 0,
    val misses: Int = 0,
    val countInPlanning: Boolean = true,
    val assessmentId: String? = null,
)

/** GET /api/watch/snapshot */
@Serializable
data class Snapshot(
    val serverTime: String = "",
    val today: String = "",
    val plan: PlanLite? = null,
    val subjects: List<SubjectLite> = emptyList(),
    val categories: List<CategoryLite> = emptyList(),
    val timerPrefs: TimerPrefs = TimerPrefs(),
    val reviewIntervals: List<Int> = listOf(1, 7, 30, 60, 120),
    val planning: PlanningLite? = null,
    val studies: List<WatchStudy> = emptyList(),
    val studiedDates: List<String> = emptyList(),
    val reviewsDue: Int = 0,
    /** avaliações ainda não feitas, atrasadas primeiro */
    val assessments: List<WatchAssessment> = emptyList(),
    /** quando este recorte foi baixado (ms; só nos aparelhos) */
    val fetchedAt: Long = 0,
)

@Serializable
data class PageRange(val start: Int, val end: Int)

@Serializable
data class VideoRange(val title: String, val start: Int, val end: Int)

/** Estudo completo, como o navegador grava (vai no POST /api/sync) */
@Serializable
data class Study(
    val id: String,
    val planId: String,
    val subjectId: String,
    val topicId: String? = null,
    /** a avaliação a que o estudo serviu (modo universidade) */
    val assessmentId: String? = null,
    val categoryId: String,
    val date: String,
    val time: String? = null,
    val duration: Int,
    val material: String = "",
    val hits: Int = 0,
    val misses: Int = 0,
    val pages: List<PageRange> = emptyList(),
    val videos: List<VideoRange> = emptyList(),
    val comment: String = "",
    val countInPlanning: Boolean = true,
    val createdAt: String,
) {
    fun lite() = WatchStudy(id, subjectId, topicId, categoryId, date, time, duration, hits, misses, countInPlanning, assessmentId)
}

@Serializable
data class Review(
    val id: String,
    val planId: String,
    val studyId: String,
    val subjectId: String,
    val topicId: String? = null,
    val dueDate: String,
    val interval: Int,
    val status: String = "pending",
)

@Serializable
data class SyncUpserts(val studies: List<Study>? = null, val reviews: List<Review>? = null)

@Serializable
data class SyncSettings(val timerPrefs: TimerPrefs? = null)

@Serializable
data class SyncRequest(val upserts: SyncUpserts? = null, val settings: SyncSettings? = null) {
    val isEmpty get() = upserts?.studies.isNullOrEmpty() && upserts?.reviews.isNullOrEmpty() && settings?.timerPrefs == null
}

@Serializable
data class PairMe(val name: String = "", val email: String = "")

@Serializable
data class PairResponse(val token: String, val me: PairMe = PairMe(), val expiresAt: String = "")

@Serializable
data class AuthConfig(val google: Boolean = false, val devLogin: Boolean = false, val googleClientId: String? = null)

@Serializable
data class ApiErrorBody(val error: String = "http", val message: String = "")

/** O que ainda não chegou ao servidor */
@Serializable
data class Pending(val studies: List<Study> = emptyList(), val reviews: List<Review> = emptyList()) {
    val isEmpty get() = studies.isEmpty() && reviews.isEmpty()
}

/** Modo da sessão: pomodoro em etapas ou cronômetro livre */
@Serializable
enum class Mode { POMODORO, FREE }

/** Como o aparelho chega à conta: direto na api ou pelo celular pareado (Data Layer) */
@Serializable
enum class Transport { DIRECT, PHONE }

/** Sessão encerrada, esperando o registro (categoria, questões) */
@Serializable
data class Draft(
    val subjectId: String,
    val subjectName: String,
    val subjectColor: String,
    /** segundos estudados */
    val seconds: Int,
    /** início da sessão (epoch ms): data e hora do estudo */
    val startedAt: Long,
    val cycleItemId: String? = null,
    val categoryId: String = "teoria",
    val topicId: String? = null,
    val mode: Mode = Mode.POMODORO,
    val rounds: Int = 0,
    /** a avaliação escolhida ao começar (modo universidade) */
    val assessmentId: String? = null,
)

/** Ajustes que ficam só no aparelho */
@Serializable
data class LocalPrefs(
    /** origem do servidor (sem /api); vazio = o padrão do build */
    val server: String = "",
    /** token de aparelho (Authorization: Bearer); vazio = sem conta */
    val token: String = "",
    val accountName: String = "",
    val accountEmail: String = "",
    /** no relógio: pelo celular ou direto */
    val transport: Transport = Transport.PHONE,
    /** ao fim de uma etapa, a seguinte começa sozinha */
    val autoContinue: Boolean = true,
    val vibrate: Boolean = true,
    /** ampulheta animada e transições; desligado, só o essencial */
    val animations: Boolean = true,
    val mode: Mode = Mode.POMODORO,
    /** durações editadas aqui e ainda não confirmadas pelo servidor */
    val timerPrefs: TimerPrefs? = null,
    val prefsDirty: Boolean = false,
    val lastSyncAt: Long = 0,
    val lastSyncError: String = "",
) {
    val signedIn get() = token.isNotEmpty()
}
