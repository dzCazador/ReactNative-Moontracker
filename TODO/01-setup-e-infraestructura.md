# 01 - Configuración e Infraestructura

## Objetivo
Arrancar el proyecto Expo + TypeScript con las capacidades nativas requeridas para audio en segundo plano, wake lock, almacenamiento local, descarga prep-time de audios y una base de navegación segura para los modos admin/en vivo.

## Dependencias
- Decisiones de `00-arquitectura-y-stack.md` aprobadas (motor de audio, BD, navegación, manejo de estado, descarga prep-time).

## Entregables
- [x] App Expo inicializada con TypeScript y configuración estricta.
- [x] Development Build/prebuild workflow funcional en Android.
- [x] Permisos/configuración/plugins de Android para audio/segundo plano/wake lock/almacenamiento/descarga configurados.
- [x] Esqueleto de navegación base con puntos de entrada a los modos Admin y En Vivo.
- [x] Entorno y scripts documentados.

## Tareas

### 1. Inicialización del Proyecto
- [x] Inicializar la app Expo con plantilla de TypeScript en la raíz del repositorio (o confirmar la estructura elegida).
- [x] Habilitar el modo estricto de TypeScript en `tsconfig.json`.
- [x] Configurar aliases de ruta (`@/`) si se desea; asegurar la alineación de configuración de Metro/Babel/TS.
- [x] Agregar ESLint + Prettier + reglas de lint de TypeScript.
- [x] Agregar scripts básicos: `start`, `android`, `ios` (opcional), `lint`, `typecheck`, `test`, `prebuild`.
- [x] Crear entradas en `.gitignore` para artefactos de Expo/Android/build y archivos de entorno local.

### 2. Development Build / Prebuild de Expo
- [x] Instalar los prerrequisitos del flujo de trabajo de EAS CLI (documentado, no asumido globalmente).
- [x] Crear/configurar `app.config.ts` (preferido) o `app.json` con nombre de la app, package id, versión, configuración de Android.
- [x] Configurar los perfiles de build de EAS en `eas.json` (`development`, `preview`, `production`).
- [x] Agregar los config plugins requeridos por las librerías seleccionadas (audio, sqlite, document picker, descarga, etc.).
- [x] Ejecutar prebuild y verificar que el proyecto Android generado compila.
- [ ] Crear y probar un Development Build en un dispositivo Android físico. (pendiente: no hay Android SDK ni dispositivo en este entorno)
- [x] Documentar la limitación "Expo Go no soportado" para las funcionalidades de audio/segundo plano.

### 3. Permisos de Android y Capacidades Nativas
- [x] Configurar el nombre de paquete de Android y el SDK mínimo (elegir según dispositivos objetivo; documentar el criterio).
- [x] Agregar/verificar los permisos requeridos por el motor de audio seleccionado:
  - [x] `FOREGROUND_SERVICE` (y el tipo específico de foreground service según lo requiera el SDK/target).
  - [x] `WAKE_LOCK`.
  - [x] `POST_NOTIFICATIONS` si se requiere para la notificación de reproducción en Android 13+.
  - [x] `INTERNET` (permiso estándar de Android): la red se usa solo para la descarga prep-time, nunca para el playback en vivo.
  - [x] Permisos de lectura de medios/audio según sea necesario para el flujo de importación (preferir SAF/document picker; evitar permisos amplios de almacenamiento cuando sea posible).
- [x] Configurar el servicio en primer plano/canal de notificaciones para reproducción (específico de la librería).
- [x] Configurar el foco de audio y el comportamiento de reproducción en segundo plano según la documentación del motor de audio.
- [ ] Asegurar que la app pueda continuar la reproducción con la pantalla bloqueada (validación en dev build).
- [x] Documentar los ajustes de optimización de batería/ajustes manuales del fabricante (Samsung/Xiaomi/etc.) para los usuarios finales.

### 4. Infraestructura Base de la App
- [x] Crear la composición de providers de la app: tema, BD, estado, navegación, arranque del servicio de audio.
- [x] Implementar error boundary y una estrategia básica de crash/logging.
- [x] Implementar módulo de entorno/configuración para feature flags (ej., logs de audio de depuración).
- [x] Agregar utilidad de logger estructurado (logs verbosos solo en dev para transiciones de audio y descargas).
- [x] Configurar la estructura de carpetas de `00-arquitectura-y-stack.md`.

### 5. Esqueleto de Navegación
- [x] Implementar el contenedor de navegación y el navegador raíz.
- [x] Crear dos áreas primarias:
  - [x] **Admin/Gestión:** setlists, canciones, biblioteca de audio/importación/descarga, ajustes.
  - [x] **Modo En Vivo:** pantalla de actuación en escenario con salidas accidentales restringidas.
- [x] Agregar pantallas/rutas placeholder con nombres claros.
- [x] Definir guardias de navegación para el Modo En Vivo (confirmar antes de salir de una actuación activa).
- [x] Asegurar tema oscuro por defecto y línea base de objetivos táctiles grandes en los componentes compartidos.

### 6. Experiencia de Desarrollador / Puertas de Calidad
- [x] Configurar los comandos `typecheck`, `lint` y `test` en forma apta para CI.
- [ ] Agregar hook de pre-commit (opcional) para lint/typecheck en archivos staging.
- [x] Agregar `README` o `docs/setup.md` con pasos de configuración, errores comunes de Android e instrucciones de dev build.
- [x] Agregar una checklist de smoke-test para validación en dispositivo físico.

## Notas Técnicas
- **SAF / Almacenamiento:** Preferir copiar los archivos seleccionados al almacenamiento interno de la app mediante `expo-file-system` después de la selección con document picker. Persistir la URI/ruta propiedad de la app.
- **Descarga prep-time:** `INTERNET` es un permiso estándar de Android y la red se usa solo para descargar audios durante la preparación. El playback en vivo debe funcionar sin red y no debe iniciar ninguna petición de red.
- **Audio en segundo plano:** Validar con Development Build temprano; no postergar hasta que la UI esté completa.
- **Wake lock:** Aplicar solo en la pantalla de Modo En Vivo; liberar al salir/segundo plano según corresponda.
- **Android 13+:** Puede requerirse permiso de notificaciones para la notificación visible del servicio de reproducción.

## Criterios de Aceptación
- [x] `npm run lint` y `npm run typecheck` pasan en una configuración limpia.
- [ ] La app se lanza en un Android Development Build en un dispositivo físico.
- [x] La navegación puede moverse entre la pantalla placeholder de Admin y la de En Vivo.
- [x] El manifest/config de Android incluye las capacidades requeridas de audio/segundo plano/wake lock/descarga para el motor seleccionado.
- [x] La documentación explica claramente el flujo de prebuild/dev build y las limitaciones de Expo Go.
- [x] No se implementan funcionalidades de la app más allá del esqueleto/infraestructura en esta etapa.
