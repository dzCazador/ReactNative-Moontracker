// Shim de AssetRegistry para entorno web.
// expo-asset intenta importar AssetRegistry desde 'react-native', pero en
// react-native-web@0.19.x no está exportado desde dist/exports/.
// Este shim proporciona una implementación mínima y no operativa para que el
// bundling de web no falle. En Android nativo se usa el módulo real.
const AssetRegistry = {
  // getAssetByID y registerAsset son utilizados por expo-asset en runtime.
  // En web no cargamos assets desde el bundle de esta forma, por lo que
  // devolvemos valores vacíos/sin operación.
  getAssetByID: () => null,
  registerAsset: () => ({ __packager_asset: true, hash: '', name: '', type: '', httpServerLocation: '', fileHash: '', scales: [] }),
};

export default AssetRegistry;
export { AssetRegistry };
