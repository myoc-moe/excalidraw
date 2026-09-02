import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { configureGifWorkerUrl } from "@excalidraw/element";
import gifWorkerUrl from "modern-gif/worker?url";

import "../excalidraw-app/sentry";

import ExcalidrawApp from "./App";

configureGifWorkerUrl(gifWorkerUrl);

window.__EXCALIDRAW_SHA__ = import.meta.env.VITE_APP_GIT_SHA;
const rootElement = document.getElementById("root")!;
const root = createRoot(rootElement);
registerSW();
root.render(
  <StrictMode>
    <ExcalidrawApp />
  </StrictMode>,
);
