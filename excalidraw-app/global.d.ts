import "@excalidraw/excalidraw/global";
import "@excalidraw/excalidraw/css";

import type { FileId } from "@excalidraw/element/types";

type MyocImageStatusDebug = {
  downstream: (progress?: number) => FileId | null;
  upstream: (progress?: number) => FileId | null;
  pending: () => FileId | null;
  failed: () => FileId | null;
  error: (text: string | null) => FileId | null;
  clear: () => FileId | null;
};

declare global {
  interface Window {
    __EXCALIDRAW_SHA__: string | undefined;
    myocImageStatusDebug?: MyocImageStatusDebug;
  }
}

export {};
