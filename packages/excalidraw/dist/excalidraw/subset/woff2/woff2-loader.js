/**
 * DON'T depend on anything from the outside like `promiseTry`, as this module is part of a separate lazy-loaded chunk.
 *
 * Including anything from the main chunk would include the whole chunk by default.
 * Even it it would be tree-shaken during build, it won't be tree-shaken in dev.
 *
 * In the future consider separating common utils into a separate shared chunk.
 */
import binary from "./woff2-wasm";
import bindings from "./woff2-bindings";
let loadedWasm = null;
// re-map from internal vector into byte array
function convertFromVecToUint8Array(vector) {
    const arr = [];
    for (let i = 0, l = vector.size(); i < l; i++) {
        arr.push(vector.get(i));
    }
    return new Uint8Array(arr);
}
// TODO: consider adding support for fetching the wasm from an URL (external CDN, data URL, etc.)
const load = () => {
    return new Promise((resolve, reject) => {
        try {
            // initializing the module manually, so that we could pass in the wasm binary
            // note that the `bindings.then` is not not promise/A+ compliant, hence the need for another explicit try/catch
            bindings({ wasmBinary: binary }).then((module) => {
                try {
                    // re-exporting only compress and decompress functions (also avoids infinite loop inside emscripten bindings)
                    const woff2 = {
                        compress: (buffer) => convertFromVecToUint8Array(module.woff2Enc(buffer, buffer.byteLength)),
                        decompress: (buffer) => convertFromVecToUint8Array(module.woff2Dec(buffer, buffer.byteLength)),
                    };
                    resolve(woff2);
                }
                catch (e) {
                    reject(e);
                }
            });
        }
        catch (e) {
            reject(e);
        }
    });
};
// lazy loaded default export
export default () => {
    if (!loadedWasm) {
        loadedWasm = load();
    }
    return loadedWasm;
};
