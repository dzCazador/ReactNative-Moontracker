# 06 - Pruebas y Optimización de Android

## Objetivo
Validar la fiabilidad en el mundo real para actuaciones en vivo en Android: tiempos de audio, loops gapless, comportamiento en segundo plano, descarga prep-time, restricciones de batería/energía y preparación del build de producción.

## Dependencias
- Todas las etapas previas completadas o con funcionalidad suficiente para pruebas end-to-end.
- Dispositivos Android físicos disponibles para pruebas tipo ensayo.

## Entregables
- [ ] Plan de pruebas y checklist de ejecución para la matriz de dispositivos.
- [ ] Hallazgos de rendimiento/latencia/batería/descarga con criterios de aprobado/fallido.
- [ ] Lista de bugs priorizados por severidad de "show-stopper".
- [ ] Artefactos de build de producción (APK/AAB) y checklist de liberación.

## Tareas

### 1. Entorno de Pruebas y Matriz de Dispositivos
- [ ] Definir la versión mínima de Android soportada y los dispositivos objetivo.
- [ ] Probar en al menos 2-3 dispositivos Android físicos (distintos fabricantes si es posible: ej., Samsung, Xiaomi, Motorola/Pixel).
- [ ] Probar con auriculares cableados, auriculares/parlante Bluetooth y parlante del dispositivo.
- [ ] Probar con pantalla encendida, pantalla bloqueada, app en segundo plano y modos de ahorro de batería.
- [ ] Preparar assets de audio representativos: pistas cortas/largas, WAV/OGG/FLAC, distintas duraciones de loop.

### 2. Pruebas Funcionales de Audio
- [ ] Verificar que el loop de espera comienza al iniciar la actuación.
- [ ] Verificar que el NEXT manual hace fade out del loop e inicia la pista principal inmediatamente.
- [ ] Verificar que el fin de la pista principal dispara automáticamente el fade-in del siguiente intermedio.
- [ ] Verificar que el intermedio personalizado por canción anula el predeterminado global.
- [ ] Verificar que el modo silencio se comporta correctamente.
- [ ] Verificar que el comportamiento de la última canción coincide con la especificación definida.
- [ ] Verificar el manejo de archivos faltantes y las acciones de recuperación.
- [ ] Verificar que no hay doble disparo con toques rápidos/multi-touch.

### 3. Pruebas de Descarga desde Enlace (Prep-Time)
- [ ] Probar descargas con enlaces reales de Google Drive y Mega, además de enlaces directos.
- [ ] Verificar que los audios descargados se guardan en el almacenamiento interno y quedan disponibles tras reiniciar la app.
- [ ] Probar descarga de varios archivos y de carpetas/playlist completas, validando cada archivo del lote.
- [ ] Verificar la reanudación de una descarga interrumpida y la limpieza de archivos parciales.
- [ ] Probar enlaces inválidos, expirados o con autenticación, y verificar mensajes de error claros sin que la app se cierre.
- [ ] Probar espacio en disco insuficiente y verificar que la descarga se aborta con un error accionable.
- [ ] Verificar que el playback posterior funciona sin red y no depende de la URL de origen.

### 4. Validación de Loop Gapless y Latencia
- [ ] Escuchar clicks/gaps en el límite del loop entre formatos y dispositivos.
- [ ] Medir la latencia de disparo (presionar el botón hasta el inicio audible de la pista principal).
- [ ] Medir la consistencia de transición en ejecuciones repetidas (ej., 20+ transiciones).
- [ ] Prueba de estrés con una setlist de actuación larga (30+ canciones o ciclos repetidos).
- [ ] Validar la suavidad del fade (sin ruido de cremallera/zipper noise, sin saltos abruptos).
- [ ] Registrar evidencia de audio/video para los fallos.

### 5. Pruebas de Sistema Android / Energía / Segundo Plano
- [ ] Bloqueo de pantalla durante el loop de espera: la reproducción continúa.
- [ ] Bloqueo de pantalla durante la pista principal: la reproducción continúa y transiciona correctamente.
- [ ] Notificación entrante: sin interrupción/crash.
- [ ] Interrupción por llamada telefónica/foco de audio: el comportamiento coincide con la política.
- [ ] Desconexión/reconexión de Bluetooth: comportamiento definido y recuperación.
- [ ] Ahorro de batería habilitado: verificar que no hay kill/detención inesperada.
- [ ] Restricciones de segundo plano del fabricante (OEM): documentar los ajustes requeridos por el usuario.
- [ ] Wake lock liberado después de salir del Modo En Vivo.
- [ ] Modo avión activado: la reproducción en vivo funciona sin red.

### 6. Rendimiento y Estabilidad
- [ ] Perfilar la capacidad de respuesta del hilo JS/UI durante transiciones.
- [ ] Monitorear el uso de memoria en sesiones largas.
- [ ] Verificar fugas de file handles o recursos del reproductor después de inicios/detenciones de actuación repetidos.
- [ ] Validar el tiempo de inicio de la app y el tiempo de carga de setlist con bibliotecas grandes.
- [ ] Ejecutar controles estáticos: lint, typecheck, pruebas unitarias.
- [ ] Agregar/ejecutar pruebas de integración para las transiciones de la máquina de estados (cuando sea factible).

### 7. Build de Producción y Preparación de Liberación
- [ ] Configurar versionado de la app, nombre de paquete, iconos, splash y auditoría de permisos (incluido `INTERNET` para descarga).
- [ ] Generar APK/AAB de producción mediante EAS o flujo local de Gradle (documentar la ruta elegida).
- [ ] Verificar que el comportamiento del build de liberación coincide con el dev build para audio/segundo plano/wake lock/descarga.
- [ ] Probar instalación/actualización en un dispositivo limpio.
- [ ] Verificar firma/configuración y preparación para Play Store (si se publica).
- [ ] Preparar notas de liberación y limitaciones conocidas.

### 8. Documentación y Entrega
- [ ] Documentar formatos de audio soportados y ajustes de exportación recomendados.
- [ ] Documentar proveedores de descarga soportados (Google Drive, Mega, enlaces directos) y sus limitaciones.
- [ ] Documentar consejos de configuración específicos por dispositivo/fabricante (OEM) para un uso en vivo confiable.
- [ ] Crear guía de resolución de problemas (sin audio, gap en el loop, app eliminada, archivo faltante, descarga fallida).
- [ ] Crear checklist pre-actuación para el baterista/operador.
- [ ] Registrar criterios finales de go/no-go para uso en vivo.

## Matriz de Pruebas Sugerida
| Área | Escenario | Resultado Esperado | Estado |
|---|---|---|---|
| Disparo | NEXT durante espera | El loop hace fade out, la pista principal inicia inmediatamente | [ ] |
| Transición automática | Termina la pista principal | El siguiente loop hace fade in y cicla | [ ] |
| Gapless | Límite del loop | Sin click/gap audible | [ ] |
| Segundo plano | Pantalla bloqueada | La reproducción continúa | [ ] |
| Fiabilidad | 30+ transiciones | Sin crash, sin desincronización | [ ] |
| Recuperación | Archivo faltante | Se muestra error, app estable | [ ] |
| Descarga prep-time | Enlace real (Google Drive/Mega) | Audios descargados, persistidos y reproducibles offline | [ ] |
| Descarga prep-time | Enlace inválido/expirado | Error claro, sin crash, sin entradas corruptas | [ ] |
| Descarga prep-time | Espacio insuficiente | Descarga abortada con error accionable | [ ] |
| Descarga prep-time | Carpeta/playlist | Todos los archivos válidos se descargan y quedan disponibles | [ ] |

## Criterios de Aceptación
- [ ] Todos los escenarios "show-stopper" pasan en los dispositivos Android físicos objetivo.
- [ ] La calidad del loop gapless es aceptable para uso en vivo (o se aplica el respaldo documentado).
- [ ] La latencia de disparo es consistentemente baja y se siente inmediata para el baterista.
- [ ] Las descargas desde enlace funcionan con proveedores reales, reanudan y limpian descargas parciales.
- [ ] El playback en vivo funciona sin red y sin depender de URL de descarga.
- [ ] Sin crashes/congelamientos durante una simulación de ensayo extendida.
- [ ] El build de liberación (APK/AAB) se genera y se valida en dispositivo.
- [ ] Las limitaciones conocidas y las instrucciones de configuración por fabricante (OEM) están documentadas.
