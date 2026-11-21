# Setup — BackTracker (Etapa 01)

> Documentación de configuración, desarrollo y calidad del proyecto. Los archivos de código fuente (identificadores, comentarios, strings) están en inglés; esta guía está en castellano por convención del plan del proyecto.

## 1. Requisitos

- Node.js >= 20 (se usó v24.14.0)
- npm >= 10 (se usó 11.19.1)
- JDK 17 (Android)
- Android SDK con `ANDROID_HOME` / `ANDROID_SDK_ROOT` definido
- Un dispositivo Android físico o emulador para pruebas de desarrollo build

## 2. Instalación

```bash
# En la raíz del repositorio (D:\Programacion\react-native\backTracker)
npm install
```

Las dependencias nativas se resuelven con `npx expo install` (versiones compatibles con Expo SDK 58).

## 3. Scripts disponibles

| Script | Propósito |
|--------|-----------|
| `npm start` | Inicia el servidor de desarrollo Expo (Metro) |
| `npm run android` | Inicia Metro y conecta a Android |
| `npm run typecheck` | `tsc --noEmit` con `strict: true` |
| `npm run lint` | `expo lint` (ESLint + Prettier, flat config) |
| `npm run test` | Jest con preset `jest-expo` |
| `npm run prebuild` | `expo prebuild` (genera `android/` e `ios/` vía CNG) |

## 4. Development Build / Prebuild

Expo Go **no es suficiente** para audio en segundo plano, wake lock ni config plugins nativos. Se requiere un Development Build.

```bash
# Generar proyectos nativos (CNG)
npm run prebuild

# Esto crea android/ (y ios/ en macOS). No editar a mano salvo lo documentado.

# Build de desarrollo local (requiere Android SDK / dispositivo conectado)
npx expo run:android

# O build en la nube con EAS
npx eas-cli build --profile development
```

Perfiles de build en `eas.json`: `development`, `preview`, `production`.

## 5. Configuración nativa (`app.config.ts`)

- Nombre: `backTracker`, package ID: `com.backtracker.app`, versión: `1.0.0`
- Tema: oscuro por defecto (`userInterfaceStyle: "dark"`)
- Plugins de Expo: `expo-router`, `expo-sqlite`, `expo-document-picker`
- Permisos Android declarados: `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, `WAKE_LOCK`, `POST_NOTIFICATIONS`, `INTERNET`
- `react-native-track-player` y `expo-keep-awake` son módulos gestionados (no van como config plugin); declaran sus propios permisos/servicio en el manifiesto.

> `react-native-track-player` no soporta la New Architecture; está deshabilitada implícitamente (no se usa `newArchEnabled`).

## 6. Cambios nativos manuales (`docs/native-changes.md`)

- `android/app/build.gradle`: `minSdkVersion` fijado a `24` (mínimo recomendado para Android moderno; el valor por defecto de Expo es inferior). Este cambio se pierde al volver a ejecutar `expo prebuild`; volver a aplicarlo o migrarlo a un config plugin.

## 7. Errores comunes Android

- `userInterfaceStyle`: instalar `expo-system-ui` si se requiere el control del tema de sistema.
- `FOREGROUND_SERVICE_MEDIA_PLAYBACK`: requiere Android 14+ (targetSdk 34); se declara como permiso, el tipo de servicio lo define el motor de audio en etapa 02.
- Rutas largas en Windows (>260 caracteres): habilitar long paths en Git o limpiar `node_modules` y volver a instalar.
- `expo-keep-awake` / `react-native-track-player` no se listan como config plugin en `app.config.ts` (no son plugins de Expo); listarlos rompe la resolución de config bajo Node 24.

## 8. Smoke-test en dispositivo físico

1. `npm install`
2. `npm run prebuild` (genera `android/`)
3. Conectar dispositivo Android con depuración USB habilitada
4. `npx expo run:android` (instala el development build)
5. La app arranca y muestra la pantalla de inicio
6. Navegar a "Admin / Gestión" y a "Modo En Vivo" (y volver)
7. En "Modo En Vivo", iniciar actuación y presionar atrás del sistema: debe mostrarse el diálogo de confirmación antes de salir
8. Verificar tema oscuro por defecto y botones con objetivo táctil grande (>= 48 dp, ideal 56 dp)

## 9. Estructura de carpetas (`src/`)

```
src/
  app/              # Rutas de Expo Router (_layout, pantallas placeholder)
    (admin)/        # Área Admin / Gestión
    (live)/         # Área Modo En Vivo (con guardia de salida)
  features/         # Pantallas de funcionalidad (placeholder)
  shared/           # Componentes, tema, utilidades, logger
  providers/        # Proveedores de tema y app
  lib/              # Logger, stores (Zustand)
  config/           # Variables de entorno y feature flags
  types/            # Tipos globales
```
