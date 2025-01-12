import {
  flowRendererV2,
  flowStyles
} from "./chunk-YHAAJ446.js";
import "./chunk-2MSSZBD2.js";
import {
  flowDb,
  parser$1
} from "./chunk-Y7U4N6CX.js";
import "./chunk-XNLA2J5D.js";
import "./chunk-3KFSU27M.js";
import "./chunk-IR433QOD.js";
import "./chunk-QAKPCERT.js";
import {
  require_dayjs_min,
  require_purify,
  setConfig
} from "./chunk-CYZWSHXB.js";
import {
  require_dist
} from "./chunk-232HUPMM.js";
import {
  init_define_import_meta_env
} from "./chunk-YRUDZAGT.js";
import {
  __toESM
} from "./chunk-F3UQABQJ.js";

// ../../node_modules/mermaid/dist/flowDiagram-v2-96b9c2cf.js
init_define_import_meta_env();
var import_dayjs = __toESM(require_dayjs_min(), 1);
var import_sanitize_url = __toESM(require_dist(), 1);
var import_dompurify = __toESM(require_purify(), 1);
var diagram = {
  parser: parser$1,
  db: flowDb,
  renderer: flowRendererV2,
  styles: flowStyles,
  init: (cnf) => {
    if (!cnf.flowchart) {
      cnf.flowchart = {};
    }
    cnf.flowchart.arrowMarkerAbsolute = cnf.arrowMarkerAbsolute;
    setConfig({ flowchart: { arrowMarkerAbsolute: cnf.arrowMarkerAbsolute } });
    flowRendererV2.setConf(cnf.flowchart);
    flowDb.clear();
    flowDb.setGen("gen-2");
  }
};
export {
  diagram
};
//# sourceMappingURL=flowDiagram-v2-96b9c2cf-OSLEKJ7Y.js.map
