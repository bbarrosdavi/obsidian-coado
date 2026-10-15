package br.app.coado.phone.auth

import android.app.Activity
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential

/** O usuário desistiu do login */
class SignInCancelled : Exception("Login cancelado.")

/**
 * Sign in with Google pelo Credential Manager. O id_token sai com a audiência do client id web
 * do Coado ([serverClientId], que a api informa em /auth/config), e a api o valida com as chaves
 * públicas do Google: o mesmo caminho do login do site, sem passar por uma WebView.
 */
suspend fun signInWithGoogle(activity: Activity, serverClientId: String): String {
    val option = GetSignInWithGoogleOption.Builder(serverClientId).build()
    val request = GetCredentialRequest.Builder().addCredentialOption(option).build()
    val result = try {
        CredentialManager.create(activity).getCredential(activity, request)
    } catch (e: GetCredentialCancellationException) {
        throw SignInCancelled()
    } catch (e: GetCredentialException) {
        throw IllegalStateException(e.message ?: "O Google não respondeu ao login (${e.type}).", e)
    }
    val credential = result.credential
    if (credential is CustomCredential && credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
        return GoogleIdTokenCredential.createFrom(credential.data).idToken
    }
    throw IllegalStateException("O Google devolveu uma credencial inesperada.")
}
