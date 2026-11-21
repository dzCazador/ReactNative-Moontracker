# backTracker

App de pistas de acompañamiento para actuaciones en vivo (offline-first), construida con React Native + Expo SDK 58 y TypeScript.

## Etapa 01 — Configuración e infraestructura (completada)

- Expo + TypeScript (`strict: true`) con alias `@/` → `src/`
- ESLint + Prettier, scripts `typecheck`, `lint`, `test`, `prebuild`
- `app.config.ts`, `eas.json`, config plugins y permisos Android
- Prebuild ejecutado: se generó `android/` sin errores de configuración
- Esqueleto de navegación con Expo Router: Admin / Gestión y Modo En Vivo, guardia de salida en Modo En Vivo, tema oscuro por defecto
- Logger estructurado, feature flags, error boundary y componentes con objetivos táctiles grandes

## Comandos

```bash
npm install
npm run typecheck   # tsc --noEmit
npm run lint        # expo lint
npm run test        # jest
npm run prebuild    # expo prebuild (genera android/)
```

## Documentación

- `docs/setup.md` — pasos de instalación, scripts, prebuild/dev build, errores comunes Android y checklist de smoke-test en dispositivo físico.
- `docs/native-changes.md` — cambios manuales en el proyecto nativo (`minSdkVersion = 24` en `android/app/build.gradle`).

## Notas

- Expo Go no soporta audio en segundo plano ni wake lock; se requiere Development Build.
- `android/` e `ios/` se generan con `npx expo prebuild` (CNG); no editarlas a mano salvo lo documentado.
