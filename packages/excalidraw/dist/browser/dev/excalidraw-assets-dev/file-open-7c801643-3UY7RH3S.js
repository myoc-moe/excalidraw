import {
  init_define_import_meta_env
} from "./chunk-YRUDZAGT.js";
import "./chunk-F3UQABQJ.js";

// ../../node_modules/browser-fs-access/dist/file-open-7c801643.js
init_define_import_meta_env();
var e = async (e2 = [{}]) => (Array.isArray(e2) || (e2 = [e2]), new Promise((t, n) => {
  const a = document.createElement("input");
  a.type = "file";
  const i = [...e2.map((e3) => e3.mimeTypes || []), ...e2.map((e3) => e3.extensions || [])].join();
  a.multiple = e2[0].multiple || false, a.accept = i || "";
  const c = (e3) => {
    "function" == typeof l && l(), t(e3);
  }, l = e2[0].legacySetup && e2[0].legacySetup(c, () => l(n), a);
  a.addEventListener("change", () => {
    c(a.multiple ? Array.from(a.files) : a.files[0]);
  }), a.click();
}));
export {
  e as default
};
//# sourceMappingURL=file-open-7c801643-3UY7RH3S.js.map
