import type { UserIdleState, EditorInterface } from "@excalidraw/common";
import type {
  ExcalidrawElement,
  ExcalidrawImageElement,
  FileId,
  NonDeletedElementsMap,
  NonDeletedExcalidrawElement,
  NonDeletedSceneElementsMap,
} from "@excalidraw/element/types";

import type { MakeBrand } from "@excalidraw/common/utility-types";

import type {
  AppClassProperties,
  AppState,
  EmbedsValidationStatus,
  ElementsPendingErasure,
  InteractiveCanvasAppState,
  StaticCanvasAppState,
  SocketId,
  PendingExcalidrawElements,
} from "../types";
import type { RoughCanvas } from "roughjs/bin/canvas";
import type { Drawable } from "roughjs/bin/core";

export type RenderableElementsMap = NonDeletedElementsMap &
  MakeBrand<"RenderableElementsMap">;

/** MyOC: the spoiler input that the canvas and the SVG render share. A
 * predicate, not a set of ids: the App reads its live map through it, so the
 * render config keeps one identity and has no copy to keep in sync. */
export type SpoilerRenderConfig = {
  /** images of a hidden file draw only the cover (the ThumbHash blur or the
   grey box), never the image */
  isFileHidden: (fileId: FileId) => boolean;
};

export type StaticCanvasSpoilerConfig = SpoilerRenderConfig & {
  /** the "Show spoiler" button of the screen render. Null for an export,
   which draws no button. */
  overlay: {
    /** the localized label of the button */
    label: string;
    /** the id of the image whose button is under the pointer. A getter, so
     that a hover change repaints with no App render. */
    getHoveredElementId: () => ExcalidrawElement["id"] | null;
  } | null;
};

export type StaticCanvasRenderConfig = {
  canvasBackgroundColor: AppState["viewBackgroundColor"];
  // extra options passed to the renderer
  // ---------------------------------------------------------------------------
  imageCache: AppClassProperties["imageCache"];
  getGifFrameIndex?: (element: ExcalidrawImageElement) => number | undefined;
  imageTransitionDuration?: number;
  /** MyOC: hidden spoilered files. Not set when no file is hidden. */
  spoiler?: StaticCanvasSpoilerConfig;
  renderGrid: boolean;
  /** whether to render link icons on elements with links (never rendered
   when exporting). @default true */
  renderLinks?: boolean;
  /** when exporting the behavior is slightly different (e.g. we can't use
   CSS filters), and we disable render optimizations for best output */
  isExporting: boolean;
  embedsValidationStatus: EmbedsValidationStatus;
  elementsPendingErasure: ElementsPendingErasure;
  pendingFlowchartNodes: PendingExcalidrawElements | null;
  theme: AppState["theme"];
  gridColorBold?: string;
  gridColorRegular?: string;
};

export type SVGRenderConfig = {
  offsetX: number;
  offsetY: number;
  isExporting: boolean;
  exportWithDarkMode: boolean;
  renderEmbeddables: boolean;
  frameRendering: AppState["frameRendering"];
  canvasBackgroundColor: AppState["viewBackgroundColor"];
  embedsValidationStatus: EmbedsValidationStatus;
  /**
   * whether to attempt to reuse images as much as possible through symbols
   * (reduces SVG size, but may be incompoatible with some SVG renderers)
   *
   * @default true
   */
  reuseImages: boolean;
  /** MyOC: hidden spoilered files. Not set when no file is hidden. */
  spoiler?: SpoilerRenderConfig;
  theme: AppState["theme"];
};

export type InteractiveCanvasRenderConfig = {
  // collab-related state
  // ---------------------------------------------------------------------------
  remoteSelectedElementIds: Map<ExcalidrawElement["id"], SocketId[]>;
  remotePointerViewportCoords: Map<SocketId, { x: number; y: number }>;
  remotePointerUserStates: Map<SocketId, UserIdleState>;
  remotePointerUsernames: Map<SocketId, string>;
  remotePointerButton: Map<SocketId, string | undefined>;
  selectionColor: string;
  lastViewportPosition: { x: number; y: number };
  // extra options passed to the renderer
  // ---------------------------------------------------------------------------
  renderScrollbars?: boolean;
};

export type RenderInteractiveSceneCallback = {
  scrollBars?: ScrollBars;
};

export type StaticSceneRenderConfig = {
  canvas: HTMLCanvasElement;
  rc: RoughCanvas;
  elementsMap: RenderableElementsMap;
  allElementsMap: NonDeletedSceneElementsMap;
  visibleElements: readonly NonDeletedExcalidrawElement[];
  scale: number;
  appState: StaticCanvasAppState;
  renderConfig: StaticCanvasRenderConfig;
};

export type InteractiveSceneRenderAnimationState = {
  bindingHighlight: { runtime: number } | undefined;
};

export type InteractiveSceneRenderConfig = {
  app: AppClassProperties;
  canvas: HTMLCanvasElement | null;
  elementsMap: RenderableElementsMap;
  visibleElements: readonly NonDeletedExcalidrawElement[];
  selectedElements: readonly NonDeletedExcalidrawElement[];
  allElementsMap: NonDeletedSceneElementsMap;
  scale: number;
  appState: InteractiveCanvasAppState;
  renderConfig: InteractiveCanvasRenderConfig;
  editorInterface: EditorInterface;
  callback: (data: RenderInteractiveSceneCallback) => void;
  animationState?: InteractiveSceneRenderAnimationState;
  deltaTime: number;
};

export type NewElementSceneRenderConfig = {
  canvas: HTMLCanvasElement | null;
  rc: RoughCanvas;
  newElement: NonDeletedExcalidrawElement | null;
  elementsMap: RenderableElementsMap;
  allElementsMap: NonDeletedSceneElementsMap;
  scale: number;
  appState: AppState;
  renderConfig: StaticCanvasRenderConfig;
};

export type SceneScroll = {
  scrollX: number;
  scrollY: number;
};

export type ExportType =
  | "png"
  | "clipboard"
  | "clipboard-svg"
  | "backend"
  | "svg";

export type ScrollBars = {
  horizontal: {
    x: number;
    y: number;
    width: number;
    height: number;
    deltaMultiplier: number;
  } | null;
  vertical: {
    x: number;
    y: number;
    width: number;
    height: number;
    deltaMultiplier: number;
  } | null;
};

export type SVGPathString = string & { __brand: "SVGPathString" };

export type ElementShape =
  | Drawable
  | Drawable[]
  | Path2D
  | (Drawable | SVGPathString)[]
  | null;

export type ElementShapes = {
  rectangle: Drawable;
  ellipse: Drawable;
  diamond: Drawable;
  iframe: Drawable;
  embeddable: Drawable;
  freedraw: (Drawable | SVGPathString)[];
  arrow: Drawable[];
  line: Drawable[];
  text: null;
  image: null;
  frame: null;
  magicframe: null;
};
