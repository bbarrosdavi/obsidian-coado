import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.compose.compiler)
    alias(libs.plugins.kotlin.serialization)
}

android {
    namespace = "br.app.coado.shared"
    compileSdk = 37

    defaultConfig {
        minSdk = 26
    }

    // o servidor padrão do build de debug: o npm run dev visto do emulador, ou o que vier em
    // ./gradlew -Pcoado.server=http://192.168.3.2:5173 (o computador na rede de casa)
    val devServer = (project.findProperty("coado.server") as String?)?.takeIf { it.isNotBlank() } ?: "http://10.0.2.2:5173"

    buildTypes {
        debug {
            buildConfigField("String", "DEFAULT_SERVER", "\"$devServer\"")
        }
        release {
            buildConfigField("String", "DEFAULT_SERVER", "\"https://coado.app.br\"")
            consumerProguardFiles("consumer-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    testOptions {
        unitTests.isReturnDefaultValues = true
    }
}

kotlin {
    compilerOptions {
        jvmTarget = JvmTarget.JVM_17
    }
}

dependencies {
    api(platform(libs.androidx.compose.bom))
    api(libs.androidx.core.ktx)
    api(libs.androidx.compose.ui)
    api(libs.androidx.compose.foundation)
    api(libs.androidx.lifecycle.runtime.ktx)
    api(libs.androidx.datastore.preferences)
    api(libs.androidx.work.runtime)
    api(libs.play.wearable)
    api(libs.kotlinx.coroutines.android)
    api(libs.kotlinx.coroutines.play)
    api(libs.kotlinx.serialization.json)
    api(libs.okhttp)
    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
}
