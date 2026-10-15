package br.app.coado.watch.ui

import br.app.coado.shared.ui.PALETAS
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import br.app.coado.shared.Marca
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import androidx.wear.compose.material3.Icon
import br.app.coado.shared.R
import br.app.coado.shared.data.SyncStatus
import br.app.coado.shared.model.LocalPrefs
import br.app.coado.shared.model.Overview
import br.app.coado.shared.model.TimerPrefs
import br.app.coado.shared.model.Transport
import br.app.coado.shared.ui.Cores
import br.app.coado.watch.BuildConfig
import br.app.coado.watch.CoadoWatchApp
import kotlinx.coroutines.launch
import java.text.DateFormat
import java.util.Date

/** Durações do pomodoro (sincronizadas com a conta), avisos, animações, tema e a conexão */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun SettingsScreen(
    app: CoadoWatchApp,
    prefs: LocalPrefs,
    view: Overview,
    syncStatus: SyncStatus,
    notice: String,
    edit: (InputField) -> Unit,
) {
    val scope = rememberCoroutineScope()
    val timer = prefs.timerPrefs ?: view.snapshot?.timerPrefs ?: TimerPrefs()
    var confirmSignOut by rememberSaveable { mutableStateOf(false) }

    fun setTimer(fn: (TimerPrefs) -> TimerPrefs) {
        scope.launch {
            app.store.updatePrefs { it.copy(timerPrefs = fn(timer), prefsDirty = true) }
            app.sync.enqueue()
        }
    }
    fun setPrefs(fn: (LocalPrefs) -> LocalPrefs) = scope.launch { app.store.updatePrefs(fn) }

    WheelScreen {
        section("Pomodoro")
        item { StepperRow("Estudo (min)", "${timer.pomodoroStudy}", { setTimer { it.copy(pomodoroStudy = (it.pomodoroStudy - 5).coerceAtLeast(5)) } }, { setTimer { it.copy(pomodoroStudy = (it.pomodoroStudy + 5).coerceAtMost(180)) } }, timer.pomodoroStudy > 5, timer.pomodoroStudy < 180) }
        item { StepperRow("Pausa curta (min)", "${timer.pomodoroShort}", { setTimer { it.copy(pomodoroShort = (it.pomodoroShort - 1).coerceAtLeast(1)) } }, { setTimer { it.copy(pomodoroShort = (it.pomodoroShort + 1).coerceAtMost(60)) } }, timer.pomodoroShort > 1, timer.pomodoroShort < 60) }
        item { StepperRow("Pausa longa (min)", "${timer.pomodoroLong}", { setTimer { it.copy(pomodoroLong = (it.pomodoroLong - 5).coerceAtLeast(5)) } }, { setTimer { it.copy(pomodoroLong = (it.pomodoroLong + 5).coerceAtMost(120)) } }, timer.pomodoroLong > 5, timer.pomodoroLong < 120) }
        item { StepperRow("Rodadas até a longa", "${timer.pomodoroRounds}", { setTimer { it.copy(pomodoroRounds = (it.pomodoroRounds - 1).coerceAtLeast(1)) } }, { setTimer { it.copy(pomodoroRounds = (it.pomodoroRounds + 1).coerceAtMost(12)) } }, timer.pomodoroRounds > 1, timer.pomodoroRounds < 12) }
        if (prefs.prefsDirty) note("durações ainda não enviadas à conta", color = Cores.Warn)
        item { ToggleRow("Continuar sozinho", prefs.autoContinue, { v -> setPrefs { it.copy(autoContinue = v) } }, subtitle = "a etapa seguinte começa ao fim da anterior") }
        item { ToggleRow("Vibrar", prefs.vibrate, { v -> setPrefs { it.copy(vibrate = v) } }) }
        item { ToggleRow("Som ao terminar", timer.sound, { v -> setTimer { it.copy(sound = v) } }) }
        item { ToggleRow("Animações", prefs.animations, { v -> setPrefs { it.copy(animations = v) } }, subtitle = "a ampulheta e as transições; desligue para poupar bateria") }

        section("Tema")
        item {
            FlowRow(
                Modifier.fillMaxWidth().padding(horizontal = 6.dp),
                horizontalArrangement = Arrangement.spacedBy(4.dp, Alignment.CenterHorizontally),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                PALETAS.forEach { p -> Chip(p.nome, Cores.paleta.id == p.id, { Cores.escolher(app, p.id) }, color = p.marca[5]) }
            }
        }

        section("Conta")
        item {
            Row(Modifier.fillMaxWidth().padding(horizontal = 4.dp), horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally)) {
                Chip("Pelo celular", prefs.transport == Transport.PHONE, { setPrefs { it.copy(transport = Transport.PHONE) } })
                Chip("Direto", prefs.transport == Transport.DIRECT, { setPrefs { it.copy(transport = Transport.DIRECT) } })
            }
        }
        if (prefs.transport == Transport.PHONE) {
            item {
                Pill(
                    "Conta pelo celular",
                    subtitle = if (view.snapshot != null) "recorte recebido: ${view.subjects.size} disciplinas" else "abra o Coado no celular pareado",
                    leading = { Icon(painterResource(R.drawable.ic_phone), null, tint = Cores.Brand300, modifier = Modifier.size(18.dp)) },
                )
            }
        } else {
            item {
                Pill(
                    if (prefs.signedIn) prefs.accountName.ifBlank { "Pareado" } else "Não pareado",
                    subtitle = if (prefs.signedIn) prefs.accountEmail else "gere o código em Configurações → Relógio no site",
                    leading = { Icon(painterResource(R.drawable.ic_link), null, tint = if (prefs.signedIn) Cores.Ok else Cores.Muted, modifier = Modifier.size(18.dp)) },
                )
            }
            item { PillButton(if (prefs.signedIn) "Parear outra conta" else "Parear com código", { edit(InputField.CODE) }, icon = R.drawable.ic_link, primary = !prefs.signedIn) }
            item { Pill("Servidor", subtitle = prefs.server.ifBlank { app.server }, onClick = { edit(InputField.SERVER) }) }
            if (prefs.signedIn) {
                item {
                    if (confirmSignOut) PillButton("Sair mesmo?", { scope.launch { runCatching { app.api.logout(app.server, prefs.token) }; app.store.signOut(); confirmSignOut = false } }, icon = R.drawable.ic_logout, color = Cores.Bad, textColor = Cores.Bg)
                    else PillButton("Sair da conta", { confirmSignOut = true }, icon = R.drawable.ic_logout, primary = false, textColor = Cores.Bad)
                }
            }
        }
        if (notice.isNotBlank()) note(notice, color = Cores.Brand300)
        item {
            PillButton(
                when (syncStatus) {
                    is SyncStatus.Syncing -> "Sincronizando…"
                    else -> "Sincronizar agora"
                },
                { scope.launch { app.sync.syncNow() } },
                icon = R.drawable.ic_sync,
                primary = false,
                enabled = syncStatus !is SyncStatus.Syncing,
            )
        }
        note(
            when {
                syncStatus is SyncStatus.Error -> syncStatus.message
                prefs.lastSyncAt > 0 -> "última: ${DateFormat.getTimeInstance(DateFormat.SHORT).format(Date(prefs.lastSyncAt))}"
                else -> "ainda sem dados da conta"
            },
            color = if (syncStatus is SyncStatus.Error) Cores.Bad else Cores.Muted,
        )
        note("${Marca.NOME} ${BuildConfig.VERSION_NAME} · relógio")
        gap(12.dp)
    }
}
