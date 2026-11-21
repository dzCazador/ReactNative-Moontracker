# Cambios nativos manuales

Este documento registra ediciones manuales realizadas en el proyecto nativo generado por `expo prebuild` (CNG). Según la política del proyecto, estas carpetas (`android/`, `ios/`) no se editan a mano salvo que sea estrictamente necesario y quede documentado.

## Cambio: minSdkVersion = 24

- **Archivo:** `android/app/build.gradle`
- **Línea:** `defaultConfig.minSdkVersion`
- **Valor antes:** `rootProject.ext.minSdkVersion` (valor por defecto de Expo, inferior a 24)
- **Valor después:** `24`
- **Motivo:** Criterio de arquitectura: mínimo SDK 24 o superior recomendado para Android moderno.
- **Impacto:** Se pierde al volver a ejecutar `npx expo prebuild` (CNG regenera `android/`). Volver a aplicar el cambio o migrarlo a un config plugin de Expo antes de futuros prebuilds.
