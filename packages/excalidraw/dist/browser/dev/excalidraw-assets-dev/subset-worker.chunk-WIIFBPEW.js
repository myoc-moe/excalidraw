import {
  Commands,
  subsetToBinary
} from "./chunk-XJJ5WULL.js";
import {
  init_define_import_meta_env
} from "./chunk-YRUDZAGT.js";
import "./chunk-F3UQABQJ.js";

// subset/subset-worker.chunk.ts
init_define_import_meta_env();
var WorkerUrl = import.meta.url ? new URL(import.meta.url) : void 0;
if (typeof window === "undefined" && typeof self !== "undefined") {
  self.onmessage = async (e) => {
    switch (e.data.command) {
      case Commands.Subset:
        const buffer = await subsetToBinary(
          e.data.arrayBuffer,
          e.data.codePoints
        );
        self.postMessage(buffer, { transfer: [buffer] });
        break;
    }
  };
}
export {
  WorkerUrl
};
//# sourceMappingURL=subset-worker.chunk-WIIFBPEW.js.map
