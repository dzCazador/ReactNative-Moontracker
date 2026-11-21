# backTracker

App móvil para Android diseñada para bateristas que necesitan disparar pistas de acompañamiento (backing tracks) en actuaciones en vivo. Reproduce temas musicales con un loop intermedio continuo (gapless loop), transiciones suaves entre canciones y operación 100% offline una vez cargados los audios en el dispositivo.

Construida con **React Native + Expo SDK 58**, **TypeScript**, almacenamiento local con **expo-sqlite** y motor de audio nativo con `react-native-track-player`.

---

## Tabla de contenidos

- [Descripción](#descripción)
- [Características principales](#características-principales)
- [Stack tecnológico](#stack-tecnológico)
- [Arquitectura de audio](#arquitectura-de-audio)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Plan de desarrollo (carpeta `TODO/`)](#plan-de-desarrollo-carpeta-todo)
- [Requisitos previos](#requisitos-previos)
- [Instalación](#instalación)
- [Scripts disponibles](#scripts-disponibles)
- [Ejecutar en desarrollo](#ejecutar-en-desarrollo)
- [Build de desarrollo (EAS)](#build-de-desarrollo-eas)
- [Notas importantes](#notas-importantes)
- [Licencia](#licencia)

---

## Descripción

**backTracker** es una aplicación de escenario pensada para ser utilizada en vivo por un baterista. Permite armar setlists ordenadas, asignar una pista principal a cada tema y un sonido intermedio (ambiente, pad o loop) que cicla sin interrupciones entre canción y canción.

El flujo en vivo es el siguiente:

1. La app inicia en **Standby** con el loop intermedio reproduciéndose en bucle continuo.
2. Al presionar el botón **"Siguiente"**, el loop hace un *fade-out* suave y arranca instantáneamente la pista principal del tema.
3. Al finalizar la pista automáticamente, se dispara un *fade-in* del loop intermedio del siguiente tema y queda ciclando hasta la próxima acción del baterista.

Todo funciona **100% offline** una vez importados o descargados los archivos de audio al almacenamiento interno de la app.

---

## Características principales

| Área | Detalle |
|------|---------|
| **Setlists** | Crear, editar, duplicar y eliminar listas de temas ordenadas. |
| **Pista principal** | Archivo de audio por canción (estéreo/panned: click/guía L, secuencia R). |
| **Loop intermedio** | Audio de fondo que cicla en bucle continuo sin cortes (gapless). |
| **Configuración por canción** | Loop global por defecto, loop personalizado por canción o silencio. |
| **Modo en vivo** | Pantalla de alto contraste, botones de gran tamaño, bloqueo de gestos accidentales, wake lock y visualización de progreso. |
| **Audio en segundo plano** | Reproducción con pantalla bloqueada mediante servicio en primer plano de Android. |
| **Importación de audio** | Soporte WAV, OGG, FLAC. Copia segura al almacenamiento interno de la app. |
| **Descarga prep-time** | Descargar audios desde URL (Google Drive, Mega, enlaces directos) antes del show. |
| **Offline 100%** | Ninguna ruta de reproducción depende de conexión a red durante el show. |

---

## Stack tecnológico

| Capa | Tecnología | Propósito |
|------|-----------|-----------|
| Runtime | Expo SDK 58 + React Native 0.88 | Base de la app móvil (Development Build / CNG) |
| Lenguaje | TypeScript (`strict: true`) | Seguridad de tipos |
| Motor de audio | `react-native-track-player` | Reproducción en segundo plano, eventos, servicio en primer plano de Android |
| BD local | `expo-sqlite` | Metadatos estructurados (setlists, canciones, asignaciones) |
| Almacenamiento | `expo-file-system` | Copia/importación de audio al sandbox de la app |
| Selección de archivos | `expo-document-picker` | Elegir WAV/OGG/FLAC del dispositivo (SAF) |
| Wake lock | `expo-keep-awake` | Evitar suspensión de pantalla en modo vivo |
| Navegación | `@react-navigation/native-stack` | Flujos Admin / Modo En Vivo |
| Manejo de estado | Zustand | Estado predecible de UI y audio |
| Validación | Zod | Validación en runtime de importaciones/config |
| Pruebas | Jest + React Native Testing Library | Unitarias e integración |

---

## Arquitectura de audio

La app utiliza un modelo de **doble canal (dos decks)** coordinado por una máquina de estados:

- **Deck A — Pista principal:** Reproduce la canción actual una vez (one-shot). Fuente puede ser estéreo/panned (click/guía izquierdo, secuencia derecho).
- **Deck B — Loop intermedio:** Reproduce ambiente/pad/loop en bucle continuo con reproducción gapless habilitada.

### Estados de la máquina

| Estado | Descripción |
|--------|-------------|
| `IDLE` | Sin setlist cargada / sin audio preparado. |
| `LOADING` | Resolviendo assets y preparando reproductores. |
| `STANDBY_LOOPING` | Loop intermedio reproduciéndose; esperando acción del baterista. |
| `TRANSITION_LOOP_TO_MAIN` | Fade out del loop, inicio de la pista principal. |
| `MAIN_PLAYING` | Pista principal reproduciéndose; loop detenido o silencioso. |
| `TRANSITION_MAIN_TO_NEXT_LOOP` | Pista principal finalizó; fade in del siguiente loop intermedio. |
| `PAUSED` | Pausa manual (configurable). |
| `ERROR` | Error de audio o archivo recuperable / no recuperable. |

---

## Estructura del proyecto

```
backtracker/
├── TODO/                    # Plan de desarrollo por etapas (00 a 06)
├── docs/                    # Documentación técnica (setup, cambios nativos)
├── src/
│   ├── app/                 # Rutas de navegación (Admin / En Vivo)
│   ├── components/          # Componentes compartidos (UI)
│   ├── config/              # Feature flags y configuración
│   ├── data/
│   │   ├── db/              # Esquema, migraciones y repositorios SQLite
│   │   └── models/          # Tipos de datos (setlists, canciones, assets)
│   ├── features/
│   │   ├── audio/           # Motor de audio, fades, máquina de estados
│   │   ├── library/         # Biblioteca de audio e importación
│   │   ├── live/            # Pantalla de modo en vivo
│   │   ├── setlists/        # Gestión de setlists y canciones
│   │   └── settings/        # Ajustes globales
│   ├── lib/                 # Utilidades (logger, helpers, errores, validación)
│   ├── providers/           # Proveedores de estado y tema
│   ├── services/            # Servicios de archivo y descarga
│   ├── shims/               # Shims de compatibilidad para web
│   └── types/               # Tipos globales de TypeScript
├── app.config.ts            # Configuración de Expo y EAS
├── eas.json                 # Perfiles de build (development, preview, production)
├── package.json             # Dependencias y scripts
└── README.md                # Este archivo
```

---

## Plan de desarrollo (carpeta `TODO/`)

La carpeta `TODO/` contiene los planes de trabajo divididos en 7 etapas, cada una en un archivo Markdown numerado con checkboxes, criterios de aceptación y detalles técnicos:

| Archivo | Etapa | Estado |
|---------|-------|--------|
| `00-arquitectura-y-stack.md` | Arquitectura y stack tecnológico | ✅ Completada |
| `01-setup-e-infraestructura.md` | Configuración e infraestructura | ✅ Completada |
| `02-modelo-datos-y-almacenamiento.md` | Modelo de datos y almacenamiento | ✅ Completada |
| `03-motor-audio-y-gapless-loop.md` | Motor de audio y loop gapless | ✅ Completada |
| `04-ui-gestion-setlists.md` | UI: Gestión de setlists | ✅ Completada |
| `05-ui-modo-vivo-escenario.md` | UI: Modo en vivo de escenario | ⏳ Pendiente |
| `06-testing-y-optimizacion-android.md` | Testing y optimización en Android | ⏳ Pendiente |

Cada archivo contiene tareas accionables (`- [ ]`), criterios de aceptación y notas técnicas listas para ejecutar en futuras sesiones.

---

## Requisitos previos

- **Node.js** 18 o superior
- **npm** o **yarn**
- **Expo CLI** (opcional, se usa `npx`)
- **Cuenta de Expo** (para EAS Build)
- **Android Studio** y **SDK de Android** (para build local o emulador)
- **Dispositivo Android físico** (recomendado para pruebas de audio en segundo plano)

---

## Instalación

```bash
# Clonar el repositorio
git clone https://github.com/dzCazador/ReactNative-Moontracker.git
cd backTracker

# Instalar dependencias
npm install

# Verificar tipo y lint
npm run typecheck
npm run lint
```

---

## Scripts disponibles

| Script | Descripción |
|--------|-------------|
| `npm start` | Inicia el servidor de desarrollo de Expo |
| `npm run android` | Ejecuta la app en Android (requiere `expo run:android`) |
| `npm run web` | Ejecuta la app en el navegador web |
| `npm run lint` | Ejecuta ESLint sobre el proyecto |
| `npm run typecheck` | Ejecuta TypeScript en modo estricto (`tsc --noEmit`) |
| `npm run test` | Ejecuta las pruebas unitarias con Jest |
| `npm run prebuild` | Genera los proyectos nativos `android/` e `ios/` (CNG) |

> **Nota:** Las carpetas `android/` e `ios/` se generan con Continuous Native Generation (CNG). No editarlas a mano salvo lo documentado en `docs/native-changes.md`.

---

## Ejecutar en desarrollo

### En el navegador web
```bash
npm run web
# Luego presiona la tecla 'w' en la terminal de Expo
```
> **Limitación:** En web no funcionan el audio en segundo plano, wake lock ni el servicio en primer plano de Android. Solo se pueden navegar las pantallas y probar la UI.

### En emulador o dispositivo Android
```bash
npx expo start
# Luego presiona 'a' para Android, o escanea el QR con la app Expo
```

> **Importante:** Expo Go **no incluye** los módulos nativos de `react-native-track-player` ni `expo-keep-awake`. Para probar audio en segundo plano y wake lock se requiere un **Development Build**.

---

## Build de desarrollo (EAS)

Para generar un APK de desarrollo con todas las capacidades nativas (audio en segundo plano, wake lock, servicio en primer plano):

```bash
# 1. Iniciar sesión en Expo (primera vez)
eas login

# 2. Generar el build de desarrollo para Android
eas build --profile development --platform android
```

Cuando termine, EAS te proporcionará un enlace para descargar el `.apk`. Instálalo en tu dispositivo Android para probar la app con todas las funcionalidades nativas activas.

Los perfiles de build están definidos en `eas.json`:
- `development`: para pruebas en dispositivo con cliente de desarrollo de Expo
- `preview`: para distribución interna
- `production`: para release

---

## Notas importantes

- **Expo Go no es suficiente:** Las funcionalidades de audio en segundo plano, wake lock y servicio en primer plano requieren código nativo que Expo Go no incluye. Usa siempre un Development Build para validar estas características.
- **Audio 100% offline:** La reproducción en vivo lee exclusivamente archivos copiados al almacenamiento interno de la app. Ninguna ruta de playback depende de URLs de descarga en tiempo de ejecución.
- **Modo avión:** Se recomienda activar modo avión o "No Molestar" antes de un show en vivo para evitar interrupciones por llamadas o notificaciones. La app no puede bloquear llamadas ni notificaciones del sistema por limitaciones de Android.
- **Descarga prep-time:** La descarga de audios desde URL es una operación de preparación (antes del show). El playback en vivo no requiere red y no realiza peticiones de red durante la actuación.

---

## Licencia

Este proyecto es de uso privado para la aplicación backTracker.

---

*Documentación adicional disponible en `docs/setup.md` y `docs/native-changes.md`.*
