import rough from "roughjs/bin/rough";
import { rgbaToThumbHash } from "thumbhash";
import { vi } from "vitest";

import { arrayToMap, MIME_TYPES, THEME } from "@excalidraw/common";

import type {
  AppClassProperties,
  StaticCanvasAppState,
} from "@excalidraw/excalidraw/types";
import type {
  RenderableElementsMap,
  StaticCanvasRenderConfig,
} from "@excalidraw/excalidraw/scene/types";

import { getThumbHashPlaceholder } from "../src/image";
import { newImageElement } from "../src/newElement";
import { renderElement } from "../src/renderElement";

import type {
  ExcalidrawImageElement,
  FileId,
  ImageCrop,
  NonDeleted,
  NonDeletedSceneElementsMap,
} from "../src/types";

// MyOC: the crop of an image element is in the pixels of the image that the
// user cropped. The blur (ThumbHash), the thumbnail and the cross-fade
// thumbnail have other pixel sizes, so the renderer must scale the crop.

const FULL_WIDTH = 1600;
const FULL_HEIGHT = 1200;

const CROP: ImageCrop = {
  x: 400,
  y: 300,
  width: 800,
  height: 600,
  naturalWidth: FULL_WIDTH,
  naturalHeight: FULL_HEIGHT,
};

const FILE_ID = "crop-file" as FileId;

const createImage = (naturalWidth: number, naturalHeight: number) => {
  const image = new Image();
  Object.defineProperty(image, "naturalWidth", { value: naturalWidth });
  Object.defineProperty(image, "naturalHeight", { value: naturalHeight });
  return image;
};

const createThumbHash = (width: number, height: number) => {
  const rgba = new Uint8Array(width * height * 4).fill(128);
  const bytes = rgbaToThumbHash(width, height, rgba);
  return btoa(String.fromCharCode(...bytes));
};

const createElement = (thumbHash: string | null = null) =>
  newImageElement({
    type: "image",
    x: 0,
    y: 0,
    width: 400,
    height: 300,
    status: "saved",
    fileId: FILE_ID,
    thumbHash,
    crop: CROP,
  });

const renderImage = (
  element: NonDeleted<ExcalidrawImageElement>,
  imageCache: AppClassProperties["imageCache"],
  opts: { isExporting: boolean; imageTransitionDuration?: number },
) => {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d")!;
  const elementsMap = arrayToMap([element]);
  const renderConfig: StaticCanvasRenderConfig = {
    canvasBackgroundColor: "#ffffff",
    imageCache,
    imageTransitionDuration: opts.imageTransitionDuration,
    renderGrid: false,
    isExporting: opts.isExporting,
    embedsValidationStatus: new Map(),
    elementsPendingErasure: new Set(),
    pendingFlowchartNodes: null,
    theme: THEME.LIGHT,
  };
  const appState = {
    zoom: { value: 1 },
    scrollX: 0,
    scrollY: 0,
    frameRendering: {
      enabled: false,
      outline: false,
      name: false,
      clip: false,
    },
    openDialog: null,
    selectedElementIds: {},
    hoveredElementIds: {},
    croppingElementId: null,
    shouldCacheIgnoreZoom: false,
    theme: THEME.LIGHT,
    viewBackgroundColor: "#ffffff",
  } as unknown as StaticCanvasAppState;

  renderElement(
    element,
    elementsMap as unknown as RenderableElementsMap,
    elementsMap as unknown as NonDeletedSceneElementsMap,
    rough.canvas(canvas),
    context,
    renderConfig,
    appState,
  );
};

/** source rectangles of every drawImage call that drew `source` */
const getSourceRects = (
  drawImage: ReturnType<typeof vi.spyOn>,
  source: CanvasImageSource,
) =>
  drawImage.mock.calls
    .filter((args: unknown[]) => args[0] === source)
    .map((args: unknown[]) => args.slice(1, 5));

describe("cropped image while it loads progressively", () => {
  let drawImage: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // the canvas mock binds prototype methods when a context is made, so the
    // spy must exist before renderElement creates its element canvas
    drawImage = vi.spyOn(CanvasRenderingContext2D.prototype, "drawImage");
  });

  afterEach(() => {
    drawImage.mockRestore();
  });

  it("scales the crop to the thumbnail size", () => {
    const thumbnail = createImage(FULL_WIDTH / 4, FULL_HEIGHT / 4);
    const imageCache: AppClassProperties["imageCache"] = new Map([
      [
        FILE_ID,
        { image: thumbnail, mimeType: MIME_TYPES.jpg, isPlaceholder: true },
      ],
    ]);

    renderImage(createElement(), imageCache, { isExporting: true });

    expect(getSourceRects(drawImage, thumbnail)).toEqual([[100, 75, 200, 150]]);
  });

  it("scales the crop to the ThumbHash size for the blur", () => {
    const element = createElement(createThumbHash(64, 48));
    const blur = getThumbHashPlaceholder(element.thumbHash!)!;
    const scaleX = blur.width / FULL_WIDTH;
    const scaleY = blur.height / FULL_HEIGHT;

    renderImage(element, new Map(), { isExporting: true });

    expect(getSourceRects(drawImage, blur)).toEqual([
      [
        CROP.x * scaleX,
        CROP.y * scaleY,
        CROP.width * scaleX,
        CROP.height * scaleY,
      ],
    ]);
  });

  it("crops the thumbnail under the cross-fade to the full image", () => {
    const thumbnail = createImage(FULL_WIDTH / 4, FULL_HEIGHT / 4);
    const full = createImage(FULL_WIDTH, FULL_HEIGHT);
    const imageCache: AppClassProperties["imageCache"] = new Map([
      [
        FILE_ID,
        {
          image: full,
          mimeType: MIME_TYPES.jpg,
          placeholderImage: thumbnail,
          transitionStart: performance.now(),
        },
      ],
    ]);

    renderImage(createElement(), imageCache, {
      isExporting: false,
      imageTransitionDuration: 60_000,
    });

    expect(getSourceRects(drawImage, thumbnail)).toEqual([[100, 75, 200, 150]]);
    expect(getSourceRects(drawImage, full)).toEqual([[400, 300, 800, 600]]);
  });

  it("draws the whole thumbnail when the element has no crop", () => {
    const thumbnail = createImage(FULL_WIDTH / 4, FULL_HEIGHT / 4);
    const imageCache: AppClassProperties["imageCache"] = new Map([
      [
        FILE_ID,
        { image: thumbnail, mimeType: MIME_TYPES.jpg, isPlaceholder: true },
      ],
    ]);

    renderImage({ ...createElement(), crop: null }, imageCache, {
      isExporting: true,
    });

    expect(getSourceRects(drawImage, thumbnail)).toEqual([[0, 0, 400, 300]]);
  });

  it("keeps the crop as it is when the crop has no natural size", () => {
    const thumbnail = createImage(FULL_WIDTH / 4, FULL_HEIGHT / 4);
    const imageCache: AppClassProperties["imageCache"] = new Map([
      [
        FILE_ID,
        { image: thumbnail, mimeType: MIME_TYPES.jpg, isPlaceholder: true },
      ],
    ]);

    renderImage(
      {
        ...createElement(),
        crop: { ...CROP, naturalWidth: 0, naturalHeight: 0 },
      },
      imageCache,
      { isExporting: true },
    );

    expect(getSourceRects(drawImage, thumbnail)).toEqual([
      [400, 300, 800, 600],
    ]);
  });

  it("keeps the crop as it is for the full image", () => {
    const full = createImage(FULL_WIDTH, FULL_HEIGHT);
    const imageCache: AppClassProperties["imageCache"] = new Map([
      [FILE_ID, { image: full, mimeType: MIME_TYPES.jpg }],
    ]);

    renderImage(createElement(), imageCache, { isExporting: true });

    expect(getSourceRects(drawImage, full)).toEqual([[400, 300, 800, 600]]);
  });
});
