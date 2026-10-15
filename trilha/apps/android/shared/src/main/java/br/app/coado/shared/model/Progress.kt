package br.app.coado.shared.model

import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.UUID

/*
 * A lógica do site (apps/web/src/lib/utils.ts) portada para os aparelhos: as mesmas contas,
 * para o relógio e o celular mostrarem o que a home mostra.
 */

object Dates {
    private val time = DateTimeFormatter.ofPattern("HH:mm")

    fun parse(s: String): LocalDate = LocalDate.parse(s)
    fun today(): String = LocalDate.now().toString()
    fun addDays(s: String, n: Long): String = parse(s).plusDays(n).toString()

    /** a - b, em dias */
    fun diffDays(a: String, b: String): Int = ChronoUnit.DAYS.between(parse(b), parse(a)).toInt()

    /** domingo da semana da data (as metas semanais contam de domingo a sábado) */
    fun startOfWeek(s: String): String = parse(s).let { it.minusDays((it.dayOfWeek.value % 7).toLong()) }.toString()

    /** 0 = domingo … 6 = sábado */
    fun weekday(s: String): Int = parse(s).dayOfWeek.value % 7

    val WEEKDAYS = listOf("DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB")
    val WEEKDAYS_LONG = listOf("Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado")

    /** 11/10 */
    fun fmtDayMonth(s: String) = "${s.substring(8, 10)}/${s.substring(5, 7)}"

    /** 11/10/2026 */
    fun fmtDate(s: String) = "${s.substring(8, 10)}/${s.substring(5, 7)}/${s.substring(0, 4)}"

    private fun local(epochMs: Long): LocalDateTime = Instant.ofEpochMilli(epochMs).atZone(ZoneId.systemDefault()).toLocalDateTime()

    /** YYYY-MM-DD local do instante */
    fun dateOf(epochMs: Long): String = local(epochMs).toLocalDate().toString()

    /** HH:mm local do instante */
    fun timeOf(epochMs: Long): String = local(epochMs).format(time)

    fun iso(epochMs: Long): String = Instant.ofEpochMilli(epochMs).toString()
}

/** 16 caracteres, como o uid() do navegador */
fun uid(): String = UUID.randomUUID().toString().replace("-", "").take(16)

// ---------- formatação ----------

private fun pad(n: Int) = n.toString().padStart(2, '0')

/** 5400 → "1h30min"; 0 → "0min" */
fun fmtDuration(seconds: Int): String {
    val totalMin = Math.round(seconds / 60.0).toInt()
    val h = totalMin / 60
    val m = totalMin % 60
    return if (h == 0) "${m}min" else "${h}h${pad(m)}min"
}

/** minutos → "1h30min" */
fun fmtMinutes(min: Int) = fmtDuration(min * 60)

/** 1 499 000 ms → "24:59"; acima de uma hora, "1:05:09" */
fun fmtClock(ms: Long): String {
    val s = ((ms + 999) / 1000).coerceAtLeast(0)
    val h = s / 3600
    val m = (s % 3600) / 60
    val sec = s % 60
    return if (h > 0) "$h:${pad(m.toInt())}:${pad(sec.toInt())}" else "${pad(m.toInt())}:${pad(sec.toInt())}"
}

fun pct(part: Long, total: Long): Int = if (total > 0) Math.round(part * 100.0 / total).toInt() else 0

// ---------- agregações ----------

data class Totals(val seconds: Int, val hits: Int, val misses: Int, val sessions: Int) {
    val questions get() = hits + misses
}

fun totals(studies: List<WatchStudy>) = Totals(
    seconds = studies.sumOf { it.duration },
    hits = studies.sumOf { it.hits },
    misses = studies.sumOf { it.misses },
    sessions = studies.size,
)

// ---------- constância ----------

data class Constancy(
    /** dias consecutivos até hoje (ou ontem, se hoje ainda não estudou) */
    val current: Int,
    val record: Int,
    /** dias desde o último estudo (0 = estudou hoje); null = nunca */
    val daysSinceLast: Int?,
)

fun constancy(dates: Collection<String>, ref: String): Constancy {
    val days = dates.toSortedSet()
    var record = 0
    var run = 0
    var prev: String? = null
    for (d in days) {
        run = if (prev != null && Dates.diffDays(d, prev) == 1) run + 1 else 1
        record = maxOf(record, run)
        prev = d
    }
    var current = 0
    var cursor = if (ref in days) ref else Dates.addDays(ref, -1)
    while (cursor in days) {
        current++
        cursor = Dates.addDays(cursor, -1)
    }
    val last = days.lastOrNull { it <= ref }
    return Constancy(current, record, last?.let { Dates.diffDays(ref, it) })
}

// ---------- ciclo ----------

data class CycleProgressItem(val item: CycleItem, /** segundos estudados atribuídos a este item */ val studied: Int) {
    val id get() = item.id
    val subjectId get() = item.subjectId
    /** minutos planejados */
    val duration get() = item.duration
    val done get() = studied >= duration * 60
}

/**
 * Distribui o tempo estudado (desde o início do ciclo) pelos itens da sequência:
 * cada estudo preenche o primeiro item incompleto da mesma disciplina; o excedente vai para o último item dela.
 */
fun cycleProgress(planning: PlanningLite, studies: List<WatchStudy>): List<CycleProgressItem> {
    val studied = IntArray(planning.cycle.size)
    val relevant = studies
        .filter { it.countInPlanning && it.date >= planning.cycleStartedAt }
        .sortedBy { it.date + (it.time ?: "") }
    for (s in relevant) {
        var remaining = s.duration
        val own = planning.cycle.indices.filter { planning.cycle[it].subjectId == s.subjectId }
        if (own.isEmpty()) continue
        for (i in own) {
            if (remaining <= 0) break
            val room = planning.cycle[i].duration * 60 - studied[i]
            if (room <= 0) continue
            val used = minOf(room, remaining)
            studied[i] += used
            remaining -= used
        }
        if (remaining > 0) studied[own.last()] += remaining
    }
    return planning.cycle.mapIndexed { i, item -> CycleProgressItem(item, studied[i]) }
}

// ---------- visão combinada ----------

/**
 * O recorte da conta somado ao que ainda não subiu: é o que as telas mostram.
 * Estudos pendentes com o mesmo id do recorte já chegaram ao servidor e contam uma vez só.
 */
class Overview(val snapshot: Snapshot?, val pending: Pending, val today: String = Dates.today()) {
    val plan get() = snapshot?.plan
    val subjects: List<SubjectLite> = snapshot?.subjects.orEmpty()
    val subjectById: Map<String, SubjectLite> = subjects.associateBy { it.id }
    val categories: List<CategoryLite> = snapshot?.categories.orEmpty().ifEmpty {
        listOf(CategoryLite("teoria", "Teoria"), CategoryLite("revisao", "Revisão"), CategoryLite("questoes", "Questões"))
    }

    val studies: List<WatchStudy> = run {
        val known = snapshot?.studies.orEmpty()
        val ids = known.map { it.id }.toSet()
        known + pending.studies.filter { it.id !in ids }.map { it.lite() }
    }

    val cycle: List<CycleProgressItem> = snapshot?.planning?.let { cycleProgress(it, studies) }.orEmpty()
    val next: CycleProgressItem? = cycle.firstOrNull { !it.done }
    val cycleDone get() = cycle.isNotEmpty() && cycle.all { it.done }
    val plannedSeconds get() = cycle.sumOf { it.duration * 60 }
    val cycleStudiedSeconds get() = cycle.sumOf { minOf(it.studied, it.duration * 60) }

    val todayTotals: Totals = totals(studies.filter { it.date == today })
    val weekTotals: Totals = totals(studies.filter { it.date >= Dates.startOfWeek(today) && it.date <= today })

    val studiedDates: Set<String> = (snapshot?.studiedDates.orEmpty() + pending.studies.map { it.date }).toSet()
    val constancy: Constancy = constancy(studiedDates, today)

    /** dias até a prova; null sem data */
    val daysToExam: Int? = plan?.examDate?.let { Dates.diffDays(it, today) }

    /** modo universidade: várias avaliações por disciplina no lugar de uma prova só */
    val universidade get() = plan?.kind == "universidade"
    val assessments: List<WatchAssessment> = snapshot?.assessments.orEmpty()
    val nextAssessment: WatchAssessment? = assessments.firstOrNull { it.date >= today }
    val lateAssessments: Int = assessments.count { it.date < today }
    fun assessmentsOf(subjectId: String) = assessments.filter { it.subjectId == subjectId }

    /** "hoje", "amanhã", "em 5 dias", "atrasada há 2 dias" */
    fun quando(date: String): String {
        val d = Dates.diffDays(date, today)
        return when {
            d == 0 -> "hoje"
            d == 1 -> "amanhã"
            d > 1 -> "em $d dias"
            d == -1 -> "atrasada desde ontem"
            else -> "atrasada há ${-d} dias"
        }
    }

    fun subject(id: String) = subjectById[id]
    fun subjectName(id: String) = subjectById[id]?.name ?: "Disciplina removida"
    fun subjectColor(id: String) = subjectById[id]?.color ?: "#cccccc"
}
