import {
  NQ,
  QB
} from "./chunk-BVXOMGG6.js";
import {
  init_define_import_meta_env
} from "./chunk-YRUDZAGT.js";
import "./chunk-F3UQABQJ.js";

// dist/prod/subset-worker.chunk.js
init_define_import_meta_env();
var s = import.meta.url ? new URL(import.meta.url) : void 0;
typeof window > "u" && typeof self < "u" && (self.onmessage = async (e) => {
  switch (e.data.command) {
    case QB.Subset:
      let a = await NQ(e.data.arrayBuffer, e.data.codePoints);
      self.postMessage(a, { transfer: [a] });
      break;
  }
});
export {
  s as WorkerUrl
};
//# sourceMappingURL=subset-worker.chunk-NX2CD3UT.js.map
