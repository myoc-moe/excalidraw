import type { ViewpointFlip } from "@excalidraw/common";

import type { Zoom } from "../types";

export const applyZoomAndViewpointFlip = (
  context: CanvasRenderingContext2D,
  appState: {
    width: number;
    height: number;
    zoom: Zoom;
    viewpointFlip: ViewpointFlip;
  },
) => {
  context.scale(appState.zoom.value, appState.zoom.value);

  if (appState.viewpointFlip.horizontal) {
    context.translate(appState.width / appState.zoom.value, 0);
  }
  if (appState.viewpointFlip.vertical) {
    context.translate(0, appState.height / appState.zoom.value);
  }

  context.scale(
    appState.viewpointFlip.horizontal ? -1 : 1,
    appState.viewpointFlip.vertical ? -1 : 1,
  );
};
