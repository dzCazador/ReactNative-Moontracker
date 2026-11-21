/**
 * Tipado de las rutas del navegador Admin.
 * Se comparte entre `App.tsx` y las pantallas para que `useNavigation()` y
 * `useRoute()` inferan correctamente los nombres de ruta y parámetros.
 */

export type RootStackParamList = {
  Admin: undefined;
  Library: undefined;
  Setlists: undefined;
  SetlistDetail: { setlistId: string };
  Settings: undefined;
  Live: undefined;
};
