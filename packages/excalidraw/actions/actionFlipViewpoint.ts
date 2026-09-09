import { CODES, KEYS } from "@excalidraw/common";
import { CaptureUpdateAction } from "@excalidraw/element";

import { register } from "./register";

import type { AppState } from "../types";

const toggleViewpointFlip = (
  appState: Readonly<AppState>,
  axis: "horizontal" | "vertical",
) => ({
  appState: {
    viewpointFlip: {
      ...appState.viewpointFlip,
      [axis]: !appState.viewpointFlip[axis],
    },
  },
  captureUpdate: CaptureUpdateAction.NEVER,
});

export const actionFlipViewpointHorizontal = register({
  name: "flipViewpointHorizontal",
  label: "labels.flipViewpointHorizontal",
  viewMode: true,
  trackEvent: { category: "canvas" },
  perform: (_elements, appState) => toggleViewpointFlip(appState, "horizontal"),
  checked: (appState) => appState.viewpointFlip.horizontal,
  keyTest: (event) =>
    !event[KEYS.CTRL_OR_CMD] &&
    !event.altKey &&
    event.shiftKey &&
    event.code === CODES.R,
});

export const actionFlipViewpointVertical = register({
  name: "flipViewpointVertical",
  label: "labels.flipViewpointVertical",
  viewMode: true,
  trackEvent: { category: "canvas" },
  perform: (_elements, appState) => toggleViewpointFlip(appState, "vertical"),
  checked: (appState) => appState.viewpointFlip.vertical,
  keyTest: (event) =>
    !event[KEYS.CTRL_OR_CMD] &&
    event.altKey &&
    event.shiftKey &&
    event.code === CODES.R,
});
