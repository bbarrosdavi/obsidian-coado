# kotlinx.serialization: as classes @Serializable e os serializers gerados
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**
-keepclassmembers class br.app.coado.** {
    *** Companion;
}
-keepclasseswithmembers class br.app.coado.** {
    kotlinx.serialization.KSerializer serializer(...);
}
-keep,includedescriptorclasses class br.app.coado.**$$serializer { *; }
