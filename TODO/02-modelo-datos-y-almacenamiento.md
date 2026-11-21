# 02 - Modelo de Datos y Almacenamiento

## Objetivo
Diseñar e implementar la capa de datos local offline para setlists, canciones, assets de audio y configuración de loop intermedio, incluyendo la importación/copia segura de archivos de audio y la descarga prep-time desde URLs hacia el almacenamiento gestionado por la app.

## Dependencias
- `00-arquitectura-y-stack.md` finalizado.
- `01-setup-e-infraestructura.md` completado (paquetes de BD/sistema de archivos/descarga configurados).

## Entregables
- [x] Esquema de SQLite y migraciones definidos.
- [x] Capa de repositorios/servicios para operaciones CRUD.
- [x] Pipeline de importación de audio que copia archivos al almacenamiento interno de la app.
- [x] Pipeline de importación por URL (descarga prep-time) con reanudación y verificación.
- [x] Validación de datos y controles de integridad.
- [ ] Estrategia de datos semilla/predeterminados (sonido intermedio predeterminado global). (pendiente)

## Modelo de Datos (Propuesto)

### Entidades

#### `audio_assets`
Almacena metadatos de todos los archivos de audio gestionados (pistas principales y loops intermedios).
- [x] `id` (TEXT/UUID, PK)
- [x] `type` (`MAIN_TRACK` | `INTERMEDIATE_LOOP`)
- [x] `display_name` (TEXT)
- [x] `original_filename` (TEXT)
- [x] `internal_uri` (TEXT, ruta gestionada por la app)
- [x] `external_source_uri` (TEXT, nullable, solo informativo)
- [x] `source_url` (TEXT, nullable, URL de descarga prep-time; solo informativo)
- [x] `file_extension` (TEXT: wav/ogg/flac/mp3/etc.)
- [x] `mime_type` (TEXT, nullable)
- [x] `duration_ms` (INTEGER, nullable hasta sondear)
- [x] `file_size_bytes` (INTEGER, nullable)
- [x] `sample_rate` (INTEGER, nullable)
- [x] `channels` (INTEGER, nullable)
- [x] `loudness_hint_db` (REAL, nullable, uso futuro)
- [x] `is_missing` (BOOLEAN por defecto false)
- [x] `created_at` (TEXT ISO)
- [x] `updated_at` (TEXT ISO)

#### `setlists`
- [x] `id` (TEXT/UUID, PK)
- [x] `name` (TEXT)
- [x] `description` (TEXT, nullable)
- [x] `default_intermediate_audio_id` (FK -> `audio_assets.id`, nullable)
- [x] `created_at` (TEXT ISO)
- [x] `updated_at` (TEXT ISO)
- [x] `last_played_at` (TEXT ISO, nullable)

#### `setlist_items`
Representa una canción ordenada en una setlist.
- [x] `id` (TEXT/UUID, PK)
- [x] `setlist_id` (FK -> `setlists.id`, indexado)
- [x] `position` (INTEGER, indexado, único por setlist)
- [x] `song_title` (TEXT)
- [x] `artist` (TEXT, nullable)
- [x] `main_audio_id` (FK -> `audio_assets.id`, requerido)
- [x] `intermediate_audio_id` (FK -> `audio_assets.id`, nullable; anula el predeterminado de la setlist)
- [x] `intermediate_mode` (`GLOBAL_DEFAULT` | `CUSTOM` | `SILENCE`)
- [x] `notes` (TEXT, nullable)
- [x] `fade_out_loop_ms` (INTEGER, nullable; anulación)
- [x] `fade_in_loop_ms` (INTEGER, nullable; anulación)
- [x] `created_at` (TEXT ISO)
- [x] `updated_at` (TEXT ISO)

#### `app_settings` (o clave-valor)
- [x] `key` (TEXT PK)
- [x] `value_json` (TEXT)
- [x] `updated_at` (TEXT ISO)

Claves sugeridas:
- `global_default_intermediate_audio_id`
- `default_fade_out_ms`
- `default_fade_in_ms`
- `live_mode_lock_enabled`
- `debug_audio_logs_enabled`

## Tareas

### 1. Esquema de BD y Migraciones
- [x] Elegir el enfoque de BD: `expo-sqlite` (recomendado) con ejecutor de migraciones.
- [x] Crear migración(es) inicial(es) para todas las tablas e índices.
- [x] Agregar claves foráneas y comportamiento `ON DELETE` (documentar decisiones).
- [x] Agregar restricción de unicidad para (`setlist_id`, `position`).
- [x] Agregar índices para búsqueda y ordenamiento de setlists.
- [x] Implementar tabla de seguimiento de versión de migraciones.
- [x] Crear utilidad de reset/migración para pruebas de desarrollo (solo debug).

### 2. Capa de Repositorios
- [x] Implementar `AudioAssetRepository` (crear, listar, getById, markMissing, eliminar).
- [x] Implementar `SetlistRepository` (CRUD, duplicar setlist, listar con conteos).
- [x] Implementar `SetlistItemRepository` (agregar/eliminar/reordenar/mover, actualizar configuración intermedia).
- [x] Implementar operación transaccional de reordenamiento para evitar posiciones duplicadas.
- [x] Implementar consulta para cargar una setlist completa para el Modo En Vivo en orden de reproducción.
- [x] Implementar controles de integridad para archivos faltantes y referencias rotas.

### 3. Importación de Audio y Gestión de Archivos
- [x] Implementar flujo de selección de archivos para formatos soportados: WAV, OGG, FLAC (y opcionalmente MP3/AAC si se aprueba).
- [x] Validar extensión/MIME del archivo antes de importar.
- [x] Copiar el archivo seleccionado al almacenamiento gestionado por la app (ej., `FileSystem.documentDirectory + 'audio/'`).
- [x] Generar nombre de archivo interno estable (UUID + extensión original) para evitar colisiones.
- [x] Persistir metadatos en `audio_assets`.
- [x] Sondear y almacenar duración/tamaño cuando sea posible.
- [x] Manejar importaciones duplicadas (preguntar: reutilizar el existente o crear una nueva copia).
- [x] Implementar eliminación segura: eliminar la fila de BD y el archivo solo cuando no queden referencias (o estrategia de soft-delete).
- [x] Implementar detección de "archivo faltante" y flujo de revinculación.

#### Importación por URL (Descarga prep-time)
- [x] Implementar flujo de descarga de uno o varios audios desde URL (Google Drive, Mega y enlaces directos admitidos por la librería elegida).
- [x] Resolver y validar el enlace antes de descargar (formato de URL, proveedor, tipo de archivo esperado).
- [x] Descargar al almacenamiento gestionado por la app y persistir la URI interna en `audio_assets`.
- [x] Validar el formato (extensión/MIME) una vez completada la descarga; rechazar o marcar formatos no soportados.
- [x] Soportar carpetas/playlist completas cuando el proveedor lo permita, validando cada archivo del lote.
- [x] Implementar reanudación de descargas interrumpidas (`createDownloadResumable` o equivalente).
- [x] Verificar espacio en disco antes y durante la descarga; abortar con error accionable si no hay espacio suficiente.
- [x] Limpiar descargas parciales o temporales que no se hayan completado.
- [x] Manejar errores de red, enlaces inválidos/expirados y enlaces con autenticación, con mensajes claros para el usuario.
- [x] Registrar `source_url` solo como metadato informativo; nunca reproducir desde la URL.

### 4. Reglas de Configuración del Sonido Intermedio
- [x] Soportar el ajuste de audio intermedio predeterminado global.
- [x] Soportar la anulación predeterminada intermedia a nivel de setlist (opcional pero útil).
- [x] Soportar el modo intermedio por canción: `GLOBAL_DEFAULT`, `CUSTOM`, `SILENCE`.
- [x] Resolver el intermedio efectivo en runtime con precedencia determinista:
  1. Canción `SILENCE` -> sin loop
  2. Canción `CUSTOM` -> intermedio de la canción
  3. Predeterminado de la setlist -> intermedio de la setlist
  4. Predeterminado global -> ajuste de la app
  5. Nada configurado -> silencio + indicador de advertencia
- [x] Persistir la lógica de resolución en una función pura con pruebas unitarias.

### 5. Validación de Datos y Manejo de Errores
- [x] Validar campos requeridos antes de escribir en la BD.
- [x] Manejar fallos de transacciones de BD y mostrar errores de UI accionables.
- [x] Prevenir referencias huérfanas de ítems de setlist/audio.
- [x] Agregar logging para fallos de importación y descarga (permiso denegado, fallo de copia, formato no soportado, error de red, espacio insuficiente).
- [x] Asegurar que todas las operaciones de reproducción funcionen completamente offline.

## Notas Técnicas
- **Reordenamiento de Posiciones:** Usar transacciones. Las posiciones temporales (offsets negativos o grandes) pueden evitar colisiones de restricciones de unicidad durante el reordenamiento.
- **URIs de Archivos:** Almacenar solo URIs/rutas internas propiedad de la app como fuente de reproducción. Las content URIs externas pueden expirar y las URLs de descarga son solo informativas.
- **Descargas prep-time:** La descarga es una operación de preparación; el playback en vivo es 100% offline. Descargar a `FileSystem.documentDirectory + 'audio/'` (o equivalente gestionado por la app), reanudar lo interrumpido y limpiar archivos parciales.
- **Rendimiento:** Para el modo en vivo, precargar los ítems de la setlist y los metadatos de audio resueltos en una consulta/join.
- **Respaldo/exportación (futuro):** Diseñar el esquema pensando en exportación/importación futura, pero fuera del alcance del MVP.

## Criterios de Aceptación
- [x] La base de datos se inicializa y migra limpiamente en instalación fresca y actualización.
- [x] El usuario puede importar un archivo de audio local y verlo persistido después de reiniciar la app.
- [x] El usuario puede descargar audios desde una URL (Google Drive, Mega, enlace directo) y verlos persistidos después de reiniciar la app.
- [x] Las descargas se reanudan tras una interrupción y las descargas parciales se limpian.
- [x] Los archivos importados o descargados se copian al almacenamiento gestionado por la app y son reproducibles desde la URI interna.
- [x] Las setlists y sus ítems soportan CRUD y persistencia estable del reordenamiento.
- [x] La configuración intermedia por canción soporta global/personalizado/silencio con resolución determinista.
- [x] Las referencias a archivos faltantes se detectan y se muestran sin que la app se cierre.
- [x] Todas las operaciones de reproducción funcionan sin conectividad de red.
