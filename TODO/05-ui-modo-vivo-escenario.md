# 05 - UI: Modo En Vivo en Escenario

## Objetivo
Entregar una pantalla de actuación en vivo segura para el baterista: alto contraste, controles grandes, carga cognitiva mínima y fuerte protección contra acciones accidentales durante una actuación.

## Dependencias
- Controlador de reproducción/máquina de estados de `03-motor-audio-y-gapless-loop.md` listos.
- Flujo de preparación de setlist de `04-ui-gestion-setlists.md` listo.

## Entregables
- [ ] Pantalla de Modo En Vivo con layout enfocado a la actuación.
- [ ] Control gigante "Next" con salvaguardas anti-accidentes.
- [ ] Estado en tiempo real: canción actual, siguiente canción, estado del loop, progreso.
- [ ] Wake lock de pantalla y protecciones de sesión en vivo.
- [ ] Controles de emergencia/seguros (pausa/detener/salir con confirmación).

## Tareas

### 1. Layout de la Pantalla En Vivo
- [ ] Diseñar una variante de tema oscuro, negro puro/alto contraste para visibilidad en escena.
- [ ] Mostrar el nombre de la setlist actual y la posición actual (ej., Canción 2/10).
- [ ] Mostrar el título de la **Canción Actual** en tipografía muy grande.
- [ ] Mostrar claramente el título de la **Siguiente Canción**.
- [ ] Mostrar el estado de reproducción: `STANDBY_LOOPING`, `TRANSITION`, `MAIN_PLAYING`, `ERROR`.
- [ ] Mostrar el estado del loop intermedio: nombre del loop activo, silencio o personalizado.
- [ ] Mostrar el progreso de la pista principal (transcurrido/restante) con una barra grande y legible.
- [ ] Mantener el layout utilizable bajo iluminación de escena y distancia (longitud de brazo).

### 2. Controles Primarios En Vivo
- [ ] Implementar botón gigante **NEXT / TRIGGER** (acción primaria).
- [ ] Ubicar el botón primario en una zona segura para el pulgar y fácil de alcanzar; evitar bordes que provoquen toques accidentales.
- [ ] Proveer retroalimentación visual inmediata al presionar (color/ripple/cambio de estado).
- [ ] Deshabilitar o bloquear el botón durante la ventana de transición para prevenir el doble disparo.
- [ ] Mostrar un estado claro "ARMED" / "TRANSITIONING" / "PLAYING" cerca del botón.
- [ ] Gesto secundario opcional (solo si es más seguro que el toque): evaluar cuidadosamente; por defecto solo botón.

### 3. Protecciones Anti-Accidentes
- [ ] Agregar confirmación para acciones destructivas/interruptivas (Salir del Modo En Vivo, Detener Actuación, Reiniciar).
- [ ] Requerir long-press para acciones peligrosas.
- [ ] Ignorar multi-touch accidental o toques rápidos repetidos durante el bloqueo.
- [ ] Prevenir navegación accidental hacia atrás; interceptar el back de hardware con diálogo de confirmación.
- [ ] Mantener los controles críticos separados para evitar toques erróneos.
- [ ] Proveer un modo opcional "Live Lock" que oculte los controles no esenciales.

### 4. Pantalla, Energía y Comportamiento del Sistema
- [ ] Activar el wake lock cuando la pantalla del Modo En Vivo está enfocada.
- [ ] Liberar el wake lock al salir del Modo En Vivo.
- [ ] Manejar de forma elegante el segundo plano/primer plano de la app; resincronizar la UI con el estado del motor al volver.
- [ ] Mostrar advertencia si la optimización de batería puede interrumpir la reproducción (informativo, no bloqueante).
- [ ] Tener en cuenta el brillo de la pantalla/legibilidad (no forzar cambios de brillo inseguros sin control del usuario).

### 5. UX de Errores y Recuperación
- [ ] Mostrar banner de error no bloqueante para problemas recuperables (siguiente archivo faltante, problema de decodificación).
- [ ] Proveer acciones de recuperación rápidas: reintentar carga, omitir canción, ir a la setlist.
- [ ] Si la pista principal falla en el momento del disparo, mantener la app estable e indicar el estado de respaldo.
- [ ] Registrar detalles del error para depuración mientras se muestra un mensaje amigable en escena.

### 6. Flujo de la Sesión En Vivo
- [ ] La acción "Comenzar Actuación" carga la setlist e ingresa a `STANDBY_LOOPING`.
- [ ] "Next" dispara la transición loop->principal.
- [ ] Al terminar la pista principal, la UI se actualiza automáticamente al siguiente estado de espera de loop/principal.
- [ ] El comportamiento al final de la setlist se define y se muestra claramente.
- [ ] "Finalizar Actuación" detiene la reproducción y libera recursos.

## Mapeo de Estado de la UI
| Estado del Motor | Indicador de UI | Control Primario | Notas |
|---|---|---|---|
| `STANDBY_LOOPING` | Loop activo / indicador sutil pulsante | NEXT habilitado | Mostrar la siguiente canción prominentemente |
| `TRANSITION_LOOP_TO_MAIN` | Etiqueta "Transicionando" | NEXT bloqueado | Ventana de bloqueo corta |
| `MAIN_PLAYING` | Reproduciendo + progreso | NEXT bloqueado/deshabilitado (o configurable) | Evitar salto accidental salvo que se soporte explícitamente |
| `TRANSITION_MAIN_TO_NEXT_LOOP` | Avanzando automáticamente | NEXT bloqueado | Resolver el siguiente loop |
| `ERROR` | Banner rojo/de error | Reintentar/Omitir | Sin crash, mensaje accionable |

## Criterios de Aceptación
- [ ] El baterista puede identificar la canción actual, la siguiente y el estado del loop de un vistazo.
- [ ] El botón NEXT es grande, fácil de alcanzar y está protegido contra el doble disparo.
- [ ] La pantalla permanece despierta durante el Modo En Vivo.
- [ ] El Modo En Vivo maneja el bloqueo de pantalla/regreso de segundo plano sin desincronización de UI/audio.
- [ ] Las acciones de salida/detención requieren confirmación y no pueden dispararse accidentalmente.
- [ ] Los errores son visibles y recuperables sin reiniciar la app.
- [ ] La UI permanece legible y utilizable en condiciones oscuras de escenario.
- [ ] El Modo En Vivo funciona con el modo avión activado.
