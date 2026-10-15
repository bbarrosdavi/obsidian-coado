pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("androidx.*")
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google {
            content {
                includeGroupByRegex("androidx.*")
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
            }
        }
        mavenCentral()
    }
}

rootProject.name = "coado-android"
// shared: modelo, lógica do ciclo, timer, sync e tema, usados pelos dois apps
// phone: o site inteiro (WebView autenticada) + login Google nativo + pomodoro nativo + ponte com o relógio
// watch: o pomodoro no pulso, que chega à conta pelo celular (Data Layer) ou direto (código)
include(":shared", ":phone", ":watch")
