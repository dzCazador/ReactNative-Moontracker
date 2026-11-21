// Shim de WebAssembly para expo-sqlite en entorno web.
// expo-sqlite intenta cargar ./wa-sqlite/wa-sqlite.wasm que no existe
// en react-native-web. Este shim proporciona una fábrica vacía para que
// el bundling de web no falle. En Android nativo se usa el módulo real.
export default function WaSQLiteFactory() {
  return {
    // API mínima para evitar fallos en runtime; en web SQLite no está disponible.
    cwrap: () => () => {},
    ccall: () => null,
    FS: { root: {} },
    _malloc: () => 0,
    _free: () => {},
    addOnPreRun: () => {},
    addOnPostRun: () => {},
    addOnExit: () => {},
    addOnExit: () => {},
    setStatus: () => {},
    locateFile: () => '',
    wasmMemory: { buffer: new ArrayBuffer(0) },
  };
}
