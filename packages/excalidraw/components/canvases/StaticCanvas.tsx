import React, { useEffect, useRef } from "react";

import { isShallowEqual } from "@excalidraw/common";
import { hasActiveGifDecode } from "@excalidraw/element";

import type {
  NonDeletedExcalidrawElement,
  NonDeletedSceneElementsMap,
} from "@excalidraw/element/types";

import { isRenderThrottlingEnabled } from "../../reactUtils";
import { renderStaticScene } from "../../renderer/staticScene";

import type {
  RenderableElementsMap,
  StaticCanvasRenderConfig,
} from "../../scene/types";
import type {
  AppClassProperties,
  AppState,
  StaticCanvasAppState,
} from "../../types";
import type { RoughCanvas } from "roughjs/bin/canvas";

type StaticCanvasProps = {
  app: AppClassProperties;
  canvas: HTMLCanvasElement;
  rc: RoughCanvas;
  elementsMap: RenderableElementsMap;
  allElementsMap: NonDeletedSceneElementsMap;
  visibleElements: readonly NonDeletedExcalidrawElement[];
  canvasNonce: string;
  selectionNonce: number | undefined;
  scale: number;
  appState: StaticCanvasAppState;
  renderConfig: StaticCanvasRenderConfig;
};

const StaticCanvas = (props: StaticCanvasProps) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const isComponentMounted = useRef(false);
  const propsRef = useRef(props);
  const renderCanvasRef = useRef<() => void>(() => {});
  const transitionFrameRef = useRef<number | null>(null);
  propsRef.current = props;

  const renderCanvas = React.useCallback(() => {
    const currentProps = propsRef.current;
    const wrapper = wrapperRef.current;
    if (!wrapper) {
      return;
    }

    const gridColorBold = getComputedStyle(wrapper)
      .getPropertyValue("--color-grid-bold")
      .trim();
    const gridColorRegular = getComputedStyle(wrapper)
      .getPropertyValue("--color-grid-regular")
      .trim();

    renderStaticScene(
      {
        canvas: currentProps.canvas,
        rc: currentProps.rc,
        scale: currentProps.scale,
        elementsMap: currentProps.elementsMap,
        allElementsMap: currentProps.allElementsMap,
        visibleElements: currentProps.visibleElements,
        appState: currentProps.appState,
        renderConfig: {
          ...currentProps.renderConfig,
          gridColorBold,
          gridColorRegular,
        },
      },
      isRenderThrottlingEnabled(),
    );

    const transitionDuration =
      currentProps.renderConfig.imageTransitionDuration ?? 0;
    const hasActiveTransition =
      transitionDuration > 0 &&
      currentProps.visibleElements.some((element) => {
        if (element.type !== "image" || !element.fileId) {
          return false;
        }
        const transitionStart = currentProps.renderConfig.imageCache.get(
          element.fileId,
        )?.transitionStart;
        return (
          transitionStart !== undefined &&
          performance.now() - transitionStart < transitionDuration
        );
      });
    const hasActiveGifDecodeInRender = hasActiveGifDecode(
      currentProps.visibleElements,
      currentProps.renderConfig.imageCache,
    );

    if (
      (hasActiveTransition || hasActiveGifDecodeInRender) &&
      transitionFrameRef.current === null
    ) {
      transitionFrameRef.current = requestAnimationFrame(() => {
        transitionFrameRef.current = null;
        renderCanvasRef.current();
      });
    }
  }, []);
  renderCanvasRef.current = renderCanvas;

  useEffect(() => {
    props.canvas.style.width = `${props.appState.width}px`;
    props.canvas.style.height = `${props.appState.height}px`;
    props.canvas.width = props.appState.width * props.scale;
    props.canvas.height = props.appState.height * props.scale;
  }, [props.appState.height, props.appState.width, props.canvas, props.scale]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) {
      return;
    }

    const canvas = props.canvas;

    if (!isComponentMounted.current) {
      isComponentMounted.current = true;

      wrapper.replaceChildren(canvas);
      canvas.classList.add("excalidraw__canvas", "static");
    }

    renderCanvas();
  });

  useEffect(() => {
    let scheduledFrame: number | null = null;
    const unsubscribe = props.app.imagePlaceholderUpdateEmitter.on(() => {
      if (scheduledFrame !== null) {
        return;
      }
      scheduledFrame = requestAnimationFrame(() => {
        scheduledFrame = null;
        renderCanvas();
      });
    });

    return () => {
      unsubscribe();
      if (scheduledFrame !== null) {
        cancelAnimationFrame(scheduledFrame);
      }
    };
  }, [props.app, renderCanvas]);

  useEffect(
    () => () => {
      if (transitionFrameRef.current !== null) {
        cancelAnimationFrame(transitionFrameRef.current);
      }
    },
    [],
  );

  return <div className="excalidraw__canvas-wrapper" ref={wrapperRef} />;
};

const getRelevantAppStateProps = (appState: AppState): StaticCanvasAppState => {
  const relevantAppStateProps = {
    zoom: appState.zoom,
    scrollX: appState.scrollX,
    scrollY: appState.scrollY,
    width: appState.width,
    height: appState.height,
    viewpointFlip: appState.viewpointFlip,
    viewModeEnabled: appState.viewModeEnabled,
    openDialog: appState.openDialog,
    hoveredElementIds: appState.hoveredElementIds,
    offsetLeft: appState.offsetLeft,
    offsetTop: appState.offsetTop,
    theme: appState.theme,
    shouldCacheIgnoreZoom: appState.shouldCacheIgnoreZoom,
    viewBackgroundColor: appState.viewBackgroundColor,
    exportScale: appState.exportScale,
    selectedElementsAreBeingDragged: appState.selectedElementsAreBeingDragged,
    gridSize: appState.gridSize,
    gridStep: appState.gridStep,
    frameRendering: appState.frameRendering,
    selectedElementIds: appState.selectedElementIds,
    frameToHighlight: appState.frameToHighlight,
    editingGroupId: appState.editingGroupId,
    currentHoveredFontFamily: appState.currentHoveredFontFamily,
    croppingElementId: appState.croppingElementId,
    suggestedBinding: appState.suggestedBinding,
  };

  return relevantAppStateProps;
};

const areEqual = (
  prevProps: StaticCanvasProps,
  nextProps: StaticCanvasProps,
) => {
  if (
    prevProps.canvasNonce !== nextProps.canvasNonce ||
    prevProps.scale !== nextProps.scale ||
    // we need to memoize on elementsMap because they may have renewed
    // even if canvasNonce didn't change (e.g. we filter elements out based
    // on appState)
    prevProps.elementsMap !== nextProps.elementsMap ||
    prevProps.visibleElements !== nextProps.visibleElements
  ) {
    return false;
  }

  return (
    isShallowEqual(
      // asserting AppState because we're being passed the whole AppState
      // but resolve to only the StaticCanvas-relevant props
      getRelevantAppStateProps(prevProps.appState as AppState),
      getRelevantAppStateProps(nextProps.appState as AppState),
    ) && isShallowEqual(prevProps.renderConfig, nextProps.renderConfig)
  );
};

export default React.memo(StaticCanvas, areEqual);
