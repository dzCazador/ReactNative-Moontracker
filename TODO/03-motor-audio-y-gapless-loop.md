# 03 - Motor de Audio y Loop Gapless

## Objetivo
Implementar un motor de audio confiable de doble deck para uso en escena: loops intermedios gapless, fades suaves, disparo manual/instantáneo de la siguiente pista y transición automática cuando termina una pista principal.

## Dependencias
- Máquina de estados de `00-arquitectura-y-stack.md` aprobada.
- Configuración nativa de audio/segundo plano de `01-setup-e-infraestructura.md` completa.
- Resolución de setlist/audio de `02-modelo-datos-y-almacenamiento.md` disponible.

## Entregables
- [x] Servicio/adaptadores del motor de audio implementados.
- [x] Orquestador/máquina de estados de doble deck implementado.
- [ ] Loop intermedio gapless validado en dispositivos Android. (pendiente: requiere dispositivo físico)
- [x] Estrategia de transición fade-out/fade-in implementada y ajustable.
- [x] Logging de eventos y rutas de recuperación para fiabilidad en vivo.

## Tareas

### 1. Abstracción del Motor de Audio
- [x] Definir la interfaz `AudioEngine` para aislar detalles específicos de la librería.
- [x] Implementar adaptador para el motor seleccionado (`react-native-track-player` recomendado).
- [x] Definir contrato de capacidades: preload, play, stop, pause, seek (opcional), setVolume, setLoop, getPosition, getDuration, eventos.
- [x] Normalizar los eventos del motor a eventos del dominio de la app (`MAIN_ENDED`, `PLAYBACK_ERROR`, `AUDIO_FOCUS_LOST`, etc.).
- [x] Asegurar que la inicialización del motor sea idempotente y sobreviva a cambios del ciclo de vida de la app.

### 2. Orquestador de Doble Deck
- [x] Implementar `LivePlaybackController` / orquestador de la máquina de estados.
- [x] Modelar dos decks lógicos:
  - [x] Deck A: pista principal (one-shot).
  - [x] Deck B: loop intermedio (loop habilitado).
- [x] Aplicar una única cola de comandos / mutex para las acciones de transición.
- [x] Implementar `loadSetlist`, `prepare`, `triggerNext`, `stop`, `recover`.
- [x] Prevenir el doble disparo con bloqueo + ventana de debounce (configurable).
- [x] Exponer estado observable para la UI (estado actual, canción actual, siguiente canción, progreso, errores).

### 3. Implementación del Loop Gapless
- [x] Configurar la reproducción del loop intermedio para looping continuo.
- [ ] Validar el comportamiento del loop con archivos de loop cortos y largos (WAV/OGG/FLAC según soporte). (pendiente: dispositivo físico)
- [x] Si el loop del motor tiene un gap audible, implementar estrategia de respaldo:
  - [x] Assets de loop continuo preprocesados.
  - [ ] Workaround de loop con doble buffer/programación (solo si es factible).
  - [ ] Spike de motor alternativo (con tiempo limitado).
- [x] Documentar formatos probados y ajustes de exportación recomendados para archivos de loop.
- [x] Agregar diagnósticos de timestamps de inicio/fin del loop en modo debug.

### 4. Lógica de Fade y Transiciones
- [x] Implementar fade-out del loop intermedio en `TRIGGER_NEXT`.
- [x] Implementar el inicio de la pista principal inmediatamente después/al inicio del fade (definir tiempo exacto; priorizar la respuesta percibida como instantánea).
- [x] Implementar fade-in del siguiente intermedio cuando se dispara `MAIN_ENDED`.
- [x] Hacer las duraciones de fade configurables (predeterminados globales + anulación por canción).
- [x] Usar rampa de volumen con pasos suaves (ej., intervalos de 16-60ms) y acotar a [0,1].
- [x] Garantizar el reinicio del volumen al nivel esperado después de las transiciones.
- [x] Cancelar fades en curso cuando comienza una nueva transición.

### 5. Detección del Fin de la Pista Principal y Avance Automático
- [x] Suscribirse al evento confiable de fin de pista del motor.
- [x] Prevenir eventos de fin duplicados.
- [x] Resolver el siguiente intermedio usando las reglas de precedencia del modelo de datos.
- [x] Si la siguiente canción no tiene intermedio ni predeterminado global, entrar en espera silenciosa con estado explícito.
- [x] Precargar/preparar la siguiente pista principal cuando sea factible para reducir la latencia del disparo.
- [x] Manejar la última canción de la setlist: definir comportamiento (detener, loop del último intermedio o espera silenciosa).

### 6. Manejo de Segundo Plano, Foco y Ciclo de Vida
- [x] Mantener la reproducción funcional con la pantalla bloqueada (servicio en primer plano/notificación según sea necesario).
- [x] Manejar cambios de foco de audio (pérdida transitoria, ducking, pérdida permanente) con política configurable.
- [x] Manejar transiciones de segundo plano/primer plano de la app sin desincronizar el estado de la UI.
- [x] Manejar de forma segura los eventos de desconexión de Bluetooth/auriculares (definir si pausar o continuar).
- [x] Restaurar el estado después de una interrupción cuando sea posible.
- [x] Garantizar que el playback en vivo no requiera red: todas las fuentes de audio provienen del almacenamiento interno.

### 7. Manejo de Errores y Observabilidad
- [x] Definir categorías de error: archivo faltante, fallo de decodificación, fallo de inicialización del motor, pérdida de foco, desconocido.
- [x] Implementar estado de error seguro para el usuario con acciones de recuperación (reintentar, omitir, recargar).
- [x] Agregar logs estructurados de transición: timestamp, evento, fromState, toState, songId, deck, volumen, resultado.
- [x] Agregar overlay de debug/panel solo-dev para el estado actual y los últimos eventos.
- [x] Capturar métricas de latencia de disparo y duración de transición.

## Notas Técnicas
- **Objetivo de latencia:** El disparo manual hasta el inicio audible de la pista principal debe sentirse inmediato (<100ms percibidos, medir en dispositivo).
- **Sin gaps de silencio:** Priorizar la calidad del loop gapless por sobre crossfades elaborados.
- **Hilos:** Evitar trabajo JS pesado durante el disparo; precomputar los siguientes assets.
- **Fuente de reloj:** Usar timestamps monótonos para tiempos de latencia/fade cuando sea posible.
- **Formatos de audio:** WAV/FLAC pueden ser más grandes; OGG puede ser eficiente. Validar el comportamiento de decodificación/loop por formato en Android.
- **Offline en vivo:** El motor de audio solo debe leer archivos internos gestionados por la app; ninguna ruta de reproducción debe depender de una URL de descarga.

## Criterios de Aceptación
- [x] Presionar "Next" durante la espera hace fade out del intermedio e inicia la pista principal de forma confiable.
- [x] El fin de la pista principal transiciona automáticamente al loop intermedio siguiente correcto.
- [ ] El loop intermedio se reproduce sin gap/click audible en los dispositivos de prueba soportados. (pendiente: dispositivo físico)
- [x] El doble toque/doble disparo durante la transición no inicia múltiples pistas ni corrompe el estado.
- [ ] La reproducción continúa con la pantalla bloqueada en la configuración de Development/Production build. (pendiente: dispositivo físico)
- [x] Un archivo de audio faltante/corrupto produce un estado de error recuperable, no un crash de la app.
- [x] Los logs/métricas son suficientes para diagnosticar fallos de transición en dispositivo.
- [ ] La reproducción en vivo funciona con el modo avión activado. (pendiente: dispositivo físico)
