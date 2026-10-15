package br.app.coado.phone.ui

import br.app.coado.shared.Marca
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import br.app.coado.shared.model.AuthConfig
import br.app.coado.shared.ui.Cores
import br.app.coado.shared.ui.StudyArt
import java.time.LocalTime

private fun moment(): Pair<String, String> {
    val h = LocalTime.now().hour
    return when {
        h < 5 -> "Ainda acordado?" to "A madrugada é silenciosa. Um bloco de cada vez."
        h < 12 -> "Bom dia!" to "Mesa arrumada, cabeça fresca. Bora começar."
        h < 18 -> "Boa tarde." to "Hora de mais um bloco de estudos."
        else -> "Boa noite." to "Um passo por vez. Bora estudar?"
    }
}

/** A tela de entrada do site, nativa: o login é com o Google, pelo aparelho */
@Composable
fun LoginScreen(
    config: AuthConfig?,
    configError: String?,
    busy: Boolean,
    error: String?,
    server: String,
    devBuild: Boolean,
    onGoogle: () -> Unit,
    onDev: (name: String) -> Unit,
    onServer: (String) -> Unit,
    onRetry: () -> Unit,
) {
    val (hello, line) = moment()
    var showServer by rememberSaveable { mutableStateOf(false) }
    var serverDraft by rememberSaveable { mutableStateOf(server) }
    var name by rememberSaveable { mutableStateOf("Visitante") }

    Column(
        Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background).systemBarsPadding().padding(horizontal = 28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        StudyArt(Modifier.size(120.dp), level = 1f, resting = true)
        Text(Marca.SLUG, style = MaterialTheme.typography.headlineMedium, color = MaterialTheme.colorScheme.onBackground)
        Spacer(Modifier.height(18.dp))
        Text(hello, style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.onBackground, textAlign = TextAlign.Center)
        Text(line, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 4.dp))
        Spacer(Modifier.height(28.dp))

        when {
            busy -> CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
            configError != null -> {
                Text(configError, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.error, textAlign = TextAlign.Center)
                Spacer(Modifier.height(10.dp))
                OutlinedButton(onClick = onRetry) { Text("Passar outro") }
            }
            config == null -> CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
            else -> {
                Button(
                    onClick = onGoogle,
                    enabled = config.google && !config.googleClientId.isNullOrBlank(),
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Cores.Brand600, contentColor = Cores.Brand50),
                    modifier = Modifier.fillMaxWidth().height(50.dp),
                ) { Text("Entrar com o Google", style = MaterialTheme.typography.labelLarge) }
                if (!config.google) {
                    Text("O login com Google não está configurado neste servidor.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 8.dp))
                }
                if (config.devLogin) {
                    Spacer(Modifier.height(10.dp))
                    OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Nome do visitante") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    OutlinedButton(onClick = { onDev(name.ifBlank { "Visitante" }) }, modifier = Modifier.fillMaxWidth().padding(top = 6.dp)) { Text("Entrar como visitante") }
                }
            }
        }
        if (error != null) {
            Text(error, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 12.dp))
        }

        Spacer(Modifier.height(28.dp))
        if (devBuild || showServer) {
            if (showServer) {
                OutlinedTextField(value = serverDraft, onValueChange = { serverDraft = it }, label = { Text("Servidor") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                TextButton(onClick = { onServer(serverDraft.trim()); showServer = false }) { Text("Usar este servidor") }
            } else {
                TextButton(onClick = { showServer = true }) { Text(server, style = MaterialTheme.typography.bodySmall) }
            }
        } else {
            TextButton(onClick = { showServer = true }) { Text("Outro servidor", style = MaterialTheme.typography.bodySmall) }
        }
    }
}
