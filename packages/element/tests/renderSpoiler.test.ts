import rough from "roughjs/bin/rough";
import { rgbaToThumbHash } from "thumbhash";
import { vi } from "vitest";

import { arrayToMap, MIME_TYPES, THEME } from "@excalidraw/common";

import type {
  AppClassProperties,
  SpoilerVisibility,
  StaticCanvasAppState,
} from "@excalidraw/excalidraw/types";
import type {
  RenderableElementsMap,
  StaticCanvasRenderConfig,
} from "@excalidraw/excalidraw/scene/types";

import { getThumbHashPlaceholder } from "../src/image";
import { newImageElement } from "../src/newElement";
import { elementWithCanvasCache, renderElement } from "../src/renderElement";
import { ShapeCache } from "../src/shape";

import type {
  ExcalidrawImageElement,
  FileId,
  ImageCrop,
  NonDeleted,
  NonDeletedSceneElementsMap,
} from "../src/types";

// MyOC: a spoilered file with the state "hidden" draws the placeholder (the
// ThumbHash blur, or the grey box) and never the image, the GIF frame or the
// cross-fade. The tests use a mock context, as renderImageCrop.test.ts does.

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

const FILE_ID = "spoiler-file" as FileId;
const OTHER_FILE_ID = "other-file" as FileId;

const createImage = (naturalWidth: number, naturalHeight: number) => {
  const image = new Image();
  Object.defineProperty(image, "naturalWidth", { value: naturalWidth });
  Object.defineProperty(image, "naturalHeight", { value: naturalHeight });
  return image;
};

// a different colour gives a different hash, so each test file has its own blur
const createThumbHash = (width: number, height: number, shade = 128) => {
  const rgba = new Uint8Array(width * height * 4).fill(shade);
  const bytes = rgbaToThumbHash(width, height, rgba);
  return btoa(String.fromCharCode(...bytes));
};

const createElement = (
  opts: {
    thumbHash?: string | null;
    crop?: ImageCrop | null;
    fileId?: FileId | null;
    status?: "pending" | "saved" | "error";
  } = {},
) =>
  newImageElement({
    type: "image",
    x: 0,
    y: 0,
    width: 400,
    height: 300,
    status: opts.status ?? "saved",
    fileId: opts.fileId === undefined ? FILE_ID : opts.fileId,
    thumbHash: opts.thumbHash ?? null,
    crop: opts.crop ?? null,
  });

type SpoilerMap = Map<FileId, SpoilerVisibility>;

const renderImages = (
  elements: NonDeleted<ExcalidrawImageElement>[],
  imageCache: AppClassProperties["imageCache"],
  opts: {
    spoileredFiles?: SpoilerMap;
    isExporting?: boolean;
    theme?: typeof THEME.LIGHT | typeof THEME.DARK;
    imageTransitionDuration?: number;
  } = {},
) => {
  const theme = opts.theme ?? THEME.LIGHT;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d")!;
  const elementsMap = arrayToMap(elements);
  const renderConfig: StaticCanvasRenderConfig = {
    canvasBackgroundColor: "#ffffff",
    imageCache,
    imageTransitionDuration: opts.imageTransitionDuration,
    spoileredFiles: opts.spoileredFiles,
    renderGrid: false,
    isExporting: opts.isExporting ?? false,
    embedsValidationStatus: new Map(),
    elementsPendingErasure: new Set(),
    pendingFlowchartNodes: null,
    theme,
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
    theme,
    viewBackgroundColor: "#ffffff",
  } as unknown as StaticCanvasAppState;

  for (const element of elements) {
    renderElement(
      element,
      elementsMap as unknown as RenderableElementsMap,
      elementsMap as unknown as NonDeletedSceneElementsMap,
      rough.canvas(canvas),
      context,
      renderConfig,
      appState,
    );
  }
};

const renderImage = (
  element: NonDeleted<ExcalidrawImageElement>,
  imageCache: AppClassProperties["imageCache"],
  opts: Parameters<typeof renderImages>[2] = {},
) => renderImages([element], imageCache, opts);

/** source rectangles of every drawImage call that drew `source` */
const getSourceRects = (
  drawImage: ReturnType<typeof vi.spyOn>,
  source: CanvasImageSource,
) =>
  drawImage.mock.calls
    .filter((args: unknown[]) => args[0] === source)
    .map((args: unknown[]) => args.slice(1, 5));

const getDrawCount = (
  drawImage: ReturnType<typeof vi.spyOn>,
  source: CanvasImageSource,
) => getSourceRects(drawImage, source).length;

/** draws of the built-in grey placeholder icon (an svg data URL image) */
const getIconDrawCount = (drawImage: ReturnType<typeof vi.spyOn>) =>
  drawImage.mock.calls.filter(
    (args: unknown[]) =>
      args[0] instanceof HTMLImageElement &&
      (args[0] as HTMLImageElement).src.startsWith(`data:${MIME_TYPES.svg}`),
  ).length;

const createCache = (
  full: HTMLImageElement,
  extra: Record<string, unknown> = {},
  fileId: FileId = FILE_ID,
): AppClassProperties["imageCache"] =>
  new Map([[fileId, { image: full, mimeType: MIME_TYPES.jpg, ...extra }]]);

describe("static render of a spoilered file", () => {
  let drawImage: ReturnType<typeof vi.spyOn>;
  let fillRect: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // the canvas mock binds prototype methods when a context is made, so the
    // spies must exist before renderElement creates its element canvas
    drawImage = vi.spyOn(CanvasRenderingContext2D.prototype, "drawImage");
    fillRect = vi.spyOn(CanvasRenderingContext2D.prototype, "fillRect");
  });

  afterEach(() => {
    drawImage.mockRestore();
    fillRect.mockRestore();
  });

  describe("hidden file with a ThumbHash", () => {
    it("draws the blur and not the image", () => {
      const element = createElement({ thumbHash: createThumbHash(64, 48, 10) });
      const blur = getThumbHashPlaceholder(element.thumbHash!)!;
      const full = createImage(FULL_WIDTH, FULL_HEIGHT);

      renderImage(element, createCache(full), {
        spoileredFiles: new Map([[FILE_ID, "hidden"]]),
      });

      expect(getDrawCount(drawImage, blur)).toBeGreaterThan(0);
      expect(getDrawCount(drawImage, full)).toBe(0);
    });

    it("draws the blur over the whole element when the element has no crop", () => {
      const element = createElement({ thumbHash: createThumbHash(64, 48, 20) });
      const blur = getThumbHashPlaceholder(element.thumbHash!)!;
      const full = createImage(FULL_WIDTH, FULL_HEIGHT);

      renderImage(element, createCache(full), {
        spoileredFiles: new Map([[FILE_ID, "hidden"]]),
      });

      expect(getSourceRects(drawImage, blur)).toEqual([
        [0, 0, blur.width, blur.height],
      ]);
    });

    it("draws the blur and not the image when exporting", () => {
      const element = createElement({ thumbHash: createThumbHash(64, 48, 30) });
      const blur = getThumbHashPlaceholder(element.thumbHash!)!;
      const full = createImage(FULL_WIDTH, FULL_HEIGHT);

      renderImage(element, createCache(full), {
        spoileredFiles: new Map([[FILE_ID, "hidden"]]),
        isExporting: true,
      });

      expect(getDrawCount(drawImage, blur)).toBe(1);
      expect(getDrawCount(drawImage, full)).toBe(0);
    });

    it("draws the blur when the image is not in the cache yet", () => {
      const element = createElement({ thumbHash: createThumbHash(64, 48, 40) });
      const blur = getThumbHashPlaceholder(element.thumbHash!)!;

      renderImage(element, new Map(), {
        spoileredFiles: new Map([[FILE_ID, "hidden"]]),
        isExporting: true,
      });

      expect(getDrawCount(drawImage, blur)).toBe(1);
    });

    it("does not draw the grey placeholder", () => {
      const element = createElement({ thumbHash: createThumbHash(64, 48, 50) });
      const full = createImage(FULL_WIDTH, FULL_HEIGHT);

      renderImage(element, createCache(full), {
        spoileredFiles: new Map([[FILE_ID, "hidden"]]),
        isExporting: true,
      });

      expect(getIconDrawCount(drawImage)).toBe(0);
      expect(fillRect).not.toHaveBeenCalled();
    });
  });

  describe("hidden file with no ThumbHash", () => {
    it("draws the grey placeholder and not the image", () => {
      const element = createElement();
      const full = createImage(FULL_WIDTH, FULL_HEIGHT);

      renderImage(element, createCache(full), {
        spoileredFiles: new Map([[FILE_ID, "hidden"]]),
        isExporting: true,
      });

      expect(fillRect).toHaveBeenCalledWith(0, 0, 400, 300);
      expect(getIconDrawCount(drawImage)).toBe(1);
      expect(getDrawCount(drawImage, full)).toBe(0);
    });

    it("draws the grey placeholder in the screen render path", () => {
      const element = createElement();
      const full = createImage(FULL_WIDTH, FULL_HEIGHT);

      renderImage(element, createCache(full), {
        spoileredFiles: new Map([[FILE_ID, "hidden"]]),
      });

      expect(fillRect).toHaveBeenCalledWith(0, 0, 400, 300);
      expect(getDrawCount(drawImage, full)).toBe(0);
    });

    it("draws the grey placeholder when the ThumbHash does not decode", () => {
      const element = createElement({ thumbHash: "not a thumbhash !!" });
      const full = createImage(FULL_WIDTH, FULL_HEIGHT);
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      renderImage(element, createCache(full), {
        spoileredFiles: new Map([[FILE_ID, "hidden"]]),
        isExporting: true,
      });
      consoleError.mockRestore();

      expect(fillRect).toHaveBeenCalledWith(0, 0, 400, 300);
      expect(getDrawCount(drawImage, full)).toBe(0);
    });

    it("does not draw the blur", () => {
      const element = createElement();
      const full = createImage(FULL_WIDTH, FULL_HEIGHT);
      const unrelatedBlur = getThumbHashPlaceholder(createThumbHash(8, 8, 60))!;

      renderImage(element, createCache(full), {
        spoileredFiles: new Map([[FILE_ID, "hidden"]]),
        isExporting: true,
      });

      expect(getDrawCount(drawImage, unrelatedBlur)).toBe(0);
    });
  });

  describe("hidden file with a crop", () => {
    it("uses the crop rectangle for the blur", () => {
      const element = createElement({
        thumbHash: createThumbHash(64, 48, 70),
        crop: CROP,
      });
      const blur = getThumbHashPlaceholder(element.thumbHash!)!;
      const full = createImage(FULL_WIDTH, FULL_HEIGHT);
      const scaleX = blur.width / FULL_WIDTH;
      const scaleY = blur.height / FULL_HEIGHT;

      renderImage(element, createCache(full), {
        spoileredFiles: new Map([[FILE_ID, "hidden"]]),
        isExporting: true,
      });

      expect(getSourceRects(drawImage, blur)).toEqual([
        [
          CROP.x * scaleX,
          CROP.y * scaleY,
          CROP.width * scaleX,
          CROP.height * scaleY,
        ],
      ]);
      expect(getDrawCount(drawImage, full)).toBe(0);
    });

    it("uses the crop rectangle for the blur in the screen render path", () => {
      const element = createElement({
        thumbHash: createThumbHash(64, 48, 80),
        crop: CROP,
      });
      const blur = getThumbHashPlaceholder(element.thumbHash!)!;
      const scaleX = blur.width / FULL_WIDTH;
      const scaleY = blur.height / FULL_HEIGHT;

      renderImage(element, createCache(createImage(FULL_WIDTH, FULL_HEIGHT)), {
        spoileredFiles: new Map([[FILE_ID, "hidden"]]),
      });

      expect(getSourceRects(drawImage, blur)).toEqual([
        [
          CROP.x * scaleX,
          CROP.y * scaleY,
          CROP.width * scaleX,
          CROP.height * scaleY,
        ],
      ]);
    });
  });

  describe("shown or unmarked file", () => {
    it("draws the real image for a shown file", () => {
      const element = createElement({ thumbHash: createThumbHash(64, 48, 90) });
      const blur = getThumbHashPlaceholder(element.thumbHash!)!;
      const full = createImage(FULL_WIDTH, FULL_HEIGHT);

      renderImage(element, createCache(full), {
        spoileredFiles: new Map([[FILE_ID, "shown"]]),
        isExporting: true,
      });

      expect(getSourceRects(drawImage, full)).toEqual([
        [0, 0, FULL_WIDTH, FULL_HEIGHT],
      ]);
      expect(getDrawCount(drawImage, blur)).toBe(0);
    });

    it("draws the real image for a shown file in the screen render path", () => {
      const element = createElement({ thumbHash: createThumbHash(64, 48, 91) });
      const full = createImage(FULL_WIDTH, FULL_HEIGHT);

      renderImage(element, createCache(full), {
        spoileredFiles: new Map([[FILE_ID, "shown"]]),
      });

      expect(getDrawCount(drawImage, full)).toBe(1);
    });

    it("draws the real image, with its crop, for a shown file", () => {
      const element = createElement({
        thumbHash: createThumbHash(64, 48, 92),
        crop: CROP,
      });
      const full = createImage(FULL_WIDTH, FULL_HEIGHT);

      renderImage(element, createCache(full), {
        spoileredFiles: new Map([[FILE_ID, "shown"]]),
        isExporting: true,
      });

      expect(getSourceRects(drawImage, full)).toEqual([[400, 300, 800, 600]]);
    });

    it("draws the real image for an unmarked file", () => {
      const element = createElement({
        thumbHash: createThumbHash(64, 48, 100),
      });
      const blur = getThumbHashPlaceholder(element.thumbHash!)!;
      const full = createImage(FULL_WIDTH, FULL_HEIGHT);

      renderImage(element, createCache(full), {
        spoileredFiles: new Map([[OTHER_FILE_ID, "hidden"]]),
        isExporting: true,
      });

      expect(getDrawCount(drawImage, full)).toBe(1);
      expect(getDrawCount(drawImage, blur)).toBe(0);
    });

    it("draws the real image when the map is empty", () => {
      const full = createImage(FULL_WIDTH, FULL_HEIGHT);

      renderImage(createElement(), createCache(full), {
        spoileredFiles: new Map(),
        isExporting: true,
      });

      expect(getDrawCount(drawImage, full)).toBe(1);
    });

    it("draws the real image when the render config has no map", () => {
      const full = createImage(FULL_WIDTH, FULL_HEIGHT);

      renderImage(createElement(), createCache(full), { isExporting: true });

      expect(getDrawCount(drawImage, full)).toBe(1);
    });

    it("draws no image for an element with no file id, also when other files are hidden", () => {
      const full = createImage(FULL_WIDTH, FULL_HEIGHT);

      renderImage(createElement({ fileId: null }), createCache(full), {
        spoileredFiles: new Map([[FILE_ID, "hidden"]]),
        isExporting: true,
      });

      expect(getDrawCount(drawImage, full)).toBe(0);
    });
  });

  describe("two files in one scene", () => {
    it("hides the hidden file and draws the other one", () => {
      const hiddenElement = createElement({
        thumbHash: createThumbHash(64, 48, 110),
      });
      const shownElement = createElement({
        fileId: OTHER_FILE_ID,
        thumbHash: createThumbHash(64, 48, 120),
      });
      const hiddenBlur = getThumbHashPlaceholder(hiddenElement.thumbHash!)!;
      const shownBlur = getThumbHashPlaceholder(shownElement.thumbHash!)!;
      const hiddenFull = createImage(FULL_WIDTH, FULL_HEIGHT);
      const shownFull = createImage(FULL_WIDTH, FULL_HEIGHT);
      const imageCache: AppClassProperties["imageCache"] = new Map([
        [FILE_ID, { image: hiddenFull, mimeType: MIME_TYPES.jpg }],
        [OTHER_FILE_ID, { image: shownFull, mimeType: MIME_TYPES.jpg }],
      ]);

      renderImages([hiddenElement, shownElement], imageCache, {
        spoileredFiles: new Map<FileId, SpoilerVisibility>([
          [FILE_ID, "hidden"],
          [OTHER_FILE_ID, "shown"],
        ]),
        isExporting: true,
      });

      expect(getDrawCount(drawImage, hiddenBlur)).toBe(1);
      expect(getDrawCount(drawImage, hiddenFull)).toBe(0);
      expect(getDrawCount(drawImage, shownFull)).toBe(1);
      expect(getDrawCount(drawImage, shownBlur)).toBe(0);
    });

    it("hides every element that shows the hidden file", () => {
      const first = createElement({ thumbHash: createThumbHash(64, 48, 130) });
      const second = createElement({ thumbHash: createThumbHash(64, 48, 130) });
      const full = createImage(FULL_WIDTH, FULL_HEIGHT);

      renderImages([first, second], createCache(full), {
        spoileredFiles: new Map([[FILE_ID, "hidden"]]),
        isExporting: true,
      });

      expect(getDrawCount(drawImage, full)).toBe(0);
    });
  });

  describe("change of state", () => {
    it("draws the real image after the map entry changes to shown and the cache clears", () => {
      const element = createElement({
        thumbHash: createThumbHash(64, 48, 140),
      });
      const blur = getThumbHashPlaceholder(element.thumbHash!)!;
      const full = createImage(FULL_WIDTH, FULL_HEIGHT);
      const imageCache = createCache(full);
      const spoileredFiles: SpoilerMap = new Map([[FILE_ID, "hidden"]]);

      renderImage(element, imageCache, { spoileredFiles });
      expect(getDrawCount(drawImage, full)).toBe(0);
      expect(getDrawCount(drawImage, blur)).toBe(1);

      // the App mutates the same map, then clears the cache of the element
      spoileredFiles.set(FILE_ID, "shown");
      ShapeCache.delete(element);
      drawImage.mockClear();

      renderImage(element, imageCache, { spoileredFiles });
      expect(getDrawCount(drawImage, full)).toBe(1);
      expect(getDrawCount(drawImage, blur)).toBe(0);
    });

    it("draws the blur after the map entry changes to hidden and the cache clears", () => {
      const element = createElement({
        thumbHash: createThumbHash(64, 48, 150),
      });
      const blur = getThumbHashPlaceholder(element.thumbHash!)!;
      const full = createImage(FULL_WIDTH, FULL_HEIGHT);
      const imageCache = createCache(full);
      const spoileredFiles: SpoilerMap = new Map([[FILE_ID, "shown"]]);

      renderImage(element, imageCache, { spoileredFiles });
      expect(getDrawCount(drawImage, full)).toBe(1);

      spoileredFiles.set(FILE_ID, "hidden");
      ShapeCache.delete(element);
      drawImage.mockClear();

      renderImage(element, imageCache, { spoileredFiles });
      expect(getDrawCount(drawImage, full)).toBe(0);
      expect(getDrawCount(drawImage, blur)).toBe(1);
    });

    it("keeps the element canvas of a file that did not change", () => {
      const changed = createElement({
        thumbHash: createThumbHash(64, 48, 160),
      });
      const untouched = createElement({
        fileId: OTHER_FILE_ID,
        thumbHash: createThumbHash(64, 48, 170),
      });
      const imageCache: AppClassProperties["imageCache"] = new Map([
        [
          FILE_ID,
          {
            image: createImage(FULL_WIDTH, FULL_HEIGHT),
            mimeType: MIME_TYPES.jpg,
          },
        ],
        [
          OTHER_FILE_ID,
          {
            image: createImage(FULL_WIDTH, FULL_HEIGHT),
            mimeType: MIME_TYPES.jpg,
          },
        ],
      ]);
      const spoileredFiles: SpoilerMap = new Map<FileId, SpoilerVisibility>([
        [FILE_ID, "hidden"],
        [OTHER_FILE_ID, "hidden"],
      ]);

      renderImages([changed, untouched], imageCache, { spoileredFiles });
      const untouchedCanvas = elementWithCanvasCache.get(untouched);
      const changedCanvas = elementWithCanvasCache.get(changed);
      expect(untouchedCanvas).toBeDefined();
      expect(changedCanvas).toBeDefined();

      // the App clears the cache of the elements of the changed file only
      spoileredFiles.set(FILE_ID, "shown");
      ShapeCache.delete(changed);
      expect(elementWithCanvasCache.get(changed)).toBeUndefined();
      expect(elementWithCanvasCache.get(untouched)).toBe(untouchedCanvas);

      renderImages([changed, untouched], imageCache, { spoileredFiles });
      expect(elementWithCanvasCache.get(untouched)).toBe(untouchedCanvas);
      expect(elementWithCanvasCache.get(changed)).not.toBe(changedCanvas);
    });

    it("keeps the cached canvas of an element when nothing clears the cache", () => {
      const element = createElement({
        thumbHash: createThumbHash(64, 48, 180),
      });
      const imageCache = createCache(createImage(FULL_WIDTH, FULL_HEIGHT));
      const spoileredFiles: SpoilerMap = new Map([[FILE_ID, "hidden"]]);

      renderImage(element, imageCache, { spoileredFiles });
      const cached = elementWithCanvasCache.get(element);

      renderImage(element, imageCache, { spoileredFiles });
      expect(elementWithCanvasCache.get(element)).toBe(cached);
    });
  });

  describe("progressive load", () => {
    it("does not use the cross-fade for a hidden file", () => {
      const element = createElement({
        thumbHash: createThumbHash(64, 48, 190),
      });
      const blur = getThumbHashPlaceholder(element.thumbHash!)!;
      const thumbnail = createImage(FULL_WIDTH / 4, FULL_HEIGHT / 4);
      const full = createImage(FULL_WIDTH, FULL_HEIGHT);
      const imageCache = createCache(full, {
        placeholderImage: thumbnail,
        transitionStart: performance.now(),
      });

      renderImage(element, imageCache, {
        spoileredFiles: new Map([[FILE_ID, "hidden"]]),
        imageTransitionDuration: 60_000,
      });

      expect(getDrawCount(drawImage, thumbnail)).toBe(0);
      expect(getDrawCount(drawImage, full)).toBe(0);
      expect(getDrawCount(drawImage, blur)).toBe(1);
    });

    it("does not draw the thumbnail of a file that still loads", () => {
      const element = createElement({
        thumbHash: createThumbHash(64, 48, 191),
      });
      const blur = getThumbHashPlaceholder(element.thumbHash!)!;
      const thumbnail = createImage(FULL_WIDTH / 4, FULL_HEIGHT / 4);
      const imageCache = createCache(thumbnail, { isPlaceholder: true });

      renderImage(element, imageCache, {
        spoileredFiles: new Map([[FILE_ID, "hidden"]]),
        isExporting: true,
      });

      expect(getDrawCount(drawImage, thumbnail)).toBe(0);
      expect(getDrawCount(drawImage, blur)).toBe(1);
    });

    it("draws no image and no thumbnail when the cross-fade has ended and the file is hidden", () => {
      const element = createElement({
        thumbHash: createThumbHash(64, 48, 192),
      });
      const thumbnail = createImage(FULL_WIDTH / 4, FULL_HEIGHT / 4);
      const full = createImage(FULL_WIDTH, FULL_HEIGHT);
      const entry = {
        image: full,
        mimeType: MIME_TYPES.jpg,
        placeholderImage: thumbnail,
        // the cross-fade is over in time
        transitionStart: performance.now() - 120_000,
      };
      const imageCache: AppClassProperties["imageCache"] = new Map([
        [FILE_ID, entry],
      ]);

      renderImage(element, imageCache, {
        spoileredFiles: new Map([[FILE_ID, "hidden"]]),
        imageTransitionDuration: 60_000,
      });

      expect(getDrawCount(drawImage, full)).toBe(0);
      expect(getDrawCount(drawImage, thumbnail)).toBe(0);
    });

    it("keeps the element canvas of a hidden file with a cross-fade start", () => {
      const element = createElement({
        thumbHash: createThumbHash(64, 48, 194),
      });
      const imageCache = createCache(createImage(FULL_WIDTH, FULL_HEIGHT), {
        placeholderImage: createImage(FULL_WIDTH / 4, FULL_HEIGHT / 4),
        transitionStart: performance.now(),
      });
      const spoileredFiles: SpoilerMap = new Map([[FILE_ID, "hidden"]]);

      renderImage(element, imageCache, {
        spoileredFiles,
        imageTransitionDuration: 60_000,
      });
      const cached = elementWithCanvasCache.get(element);
      expect(cached).toBeDefined();

      renderImage(element, imageCache, {
        spoileredFiles,
        imageTransitionDuration: 60_000,
      });
      expect(elementWithCanvasCache.get(element)).toBe(cached);
    });

    it("clears the cross-fade state of a hidden file", () => {
      const element = createElement({
        thumbHash: createThumbHash(64, 48, 195),
      });
      const imageCache = createCache(createImage(FULL_WIDTH, FULL_HEIGHT), {
        placeholderImage: createImage(FULL_WIDTH / 4, FULL_HEIGHT / 4),
        transitionStart: performance.now(),
      });

      renderImage(element, imageCache, {
        spoileredFiles: new Map([[FILE_ID, "hidden"]]),
        imageTransitionDuration: 60_000,
      });

      const entry = imageCache.get(FILE_ID)!;
      expect(entry.transitionStart).toBeUndefined();
      expect(entry.placeholderImage).toBeUndefined();
    });

    it("does not cross-fade from a stale thumbnail when the file is shown later", () => {
      const element = createElement({
        thumbHash: createThumbHash(64, 48, 196),
      });
      const thumbnail = createImage(FULL_WIDTH / 4, FULL_HEIGHT / 4);
      const full = createImage(FULL_WIDTH, FULL_HEIGHT);
      const imageCache = createCache(full, {
        placeholderImage: thumbnail,
        transitionStart: performance.now(),
      });
      const spoileredFiles: SpoilerMap = new Map([[FILE_ID, "hidden"]]);

      renderImage(element, imageCache, {
        spoileredFiles,
        imageTransitionDuration: 60_000,
      });

      spoileredFiles.set(FILE_ID, "shown");
      ShapeCache.delete(element);
      drawImage.mockClear();
      renderImage(element, imageCache, {
        spoileredFiles,
        imageTransitionDuration: 60_000,
      });

      expect(getDrawCount(drawImage, thumbnail)).toBe(0);
      expect(getSourceRects(drawImage, full)).toEqual([
        [0, 0, FULL_WIDTH, FULL_HEIGHT],
      ]);
    });

    it("draws the real image, with no thumbnail, after the file is shown", () => {
      const element = createElement({
        thumbHash: createThumbHash(64, 48, 193),
      });
      const thumbnail = createImage(FULL_WIDTH / 4, FULL_HEIGHT / 4);
      const full = createImage(FULL_WIDTH, FULL_HEIGHT);
      const imageCache = createCache(full, {
        placeholderImage: thumbnail,
        transitionStart: performance.now() - 120_000,
      });

      renderImage(element, imageCache, {
        spoileredFiles: new Map([[FILE_ID, "shown"]]),
        imageTransitionDuration: 60_000,
      });

      expect(getDrawCount(drawImage, full)).toBe(1);
      expect(getDrawCount(drawImage, thumbnail)).toBe(0);
    });
  });

  describe("GIF", () => {
    const createGifFrames = () => [
      document.createElement("canvas"),
      document.createElement("canvas"),
    ];

    it("does not draw a GIF frame for a hidden file", () => {
      const element = createElement({
        thumbHash: createThumbHash(64, 48, 200),
      });
      const blur = getThumbHashPlaceholder(element.thumbHash!)!;
      const full = createImage(FULL_WIDTH, FULL_HEIGHT);
      const frames = createGifFrames();
      const imageCache = createCache(full, {
        mimeType: MIME_TYPES.gif,
        gifDecodeStatus: "success",
        gif: { frames, delays: [100, 100], width: 100, height: 100 },
      });

      renderImage(element, imageCache, {
        spoileredFiles: new Map([[FILE_ID, "hidden"]]),
        isExporting: true,
      });

      expect(getDrawCount(drawImage, frames[0])).toBe(0);
      expect(getDrawCount(drawImage, full)).toBe(0);
      expect(getDrawCount(drawImage, blur)).toBe(1);
    });

    it("draws the GIF frame for a shown file", () => {
      const element = createElement({
        thumbHash: createThumbHash(64, 48, 201),
      });
      const full = createImage(FULL_WIDTH, FULL_HEIGHT);
      const frames = createGifFrames();
      const imageCache = createCache(full, {
        mimeType: MIME_TYPES.gif,
        gifDecodeStatus: "success",
        gif: { frames, delays: [100, 100], width: 100, height: 100 },
      });

      renderImage(element, imageCache, {
        spoileredFiles: new Map([[FILE_ID, "shown"]]),
        isExporting: true,
      });

      expect(getDrawCount(drawImage, frames[0])).toBe(1);
    });

    it("draws the blur once for a hidden file with a pending GIF decode", () => {
      const element = createElement({
        thumbHash: createThumbHash(64, 48, 202),
      });
      const blur = getThumbHashPlaceholder(element.thumbHash!)!;
      const imageCache = createCache(createImage(FULL_WIDTH, FULL_HEIGHT), {
        mimeType: MIME_TYPES.gif,
        gifDecodeStatus: "pending",
      });

      renderImage(element, imageCache, {
        spoileredFiles: new Map([[FILE_ID, "hidden"]]),
        isExporting: true,
      });

      expect(getDrawCount(drawImage, blur)).toBe(1);
    });
  });

  describe("theme", () => {
    it("draws the blur in dark mode", () => {
      const element = createElement({
        thumbHash: createThumbHash(64, 48, 210),
      });
      const blur = getThumbHashPlaceholder(element.thumbHash!)!;
      const full = createImage(FULL_WIDTH, FULL_HEIGHT);

      renderImage(element, createCache(full), {
        spoileredFiles: new Map([[FILE_ID, "hidden"]]),
        theme: THEME.DARK,
      });

      expect(getDrawCount(drawImage, blur)).toBe(1);
      expect(getDrawCount(drawImage, full)).toBe(0);
    });

    it("draws the blur in light and dark mode with the same source rectangle", () => {
      const element = createElement({
        thumbHash: createThumbHash(64, 48, 211),
        crop: CROP,
      });
      const blur = getThumbHashPlaceholder(element.thumbHash!)!;
      const full = createImage(FULL_WIDTH, FULL_HEIGHT);
      const spoileredFiles: SpoilerMap = new Map([[FILE_ID, "hidden"]]);

      renderImage(element, createCache(full), {
        spoileredFiles,
        theme: THEME.LIGHT,
      });
      const lightRects = getSourceRects(drawImage, blur);

      drawImage.mockClear();
      // a theme change regenerates the element canvas
      renderImage(element, createCache(full), {
        spoileredFiles,
        theme: THEME.DARK,
      });
      const darkRects = getSourceRects(drawImage, blur);

      expect(lightRects.length).toBe(1);
      expect(darkRects).toEqual(lightRects);
    });

    it("draws the blur of an SVG file in dark mode with no colour inversion", () => {
      const element = createElement({
        thumbHash: createThumbHash(64, 48, 212),
      });
      const blur = getThumbHashPlaceholder(element.thumbHash!)!;
      const full = createImage(FULL_WIDTH, FULL_HEIGHT);

      renderImage(element, createCache(full, { mimeType: MIME_TYPES.svg }), {
        spoileredFiles: new Map([[FILE_ID, "hidden"]]),
        theme: THEME.DARK,
        isExporting: true,
      });

      expect(getDrawCount(drawImage, blur)).toBe(1);
      expect(getDrawCount(drawImage, full)).toBe(0);
    });

    it("draws the grey placeholder in dark mode", () => {
      const full = createImage(FULL_WIDTH, FULL_HEIGHT);

      renderImage(createElement(), createCache(full), {
        spoileredFiles: new Map([[FILE_ID, "hidden"]]),
        theme: THEME.DARK,
        isExporting: true,
      });

      expect(fillRect).toHaveBeenCalledWith(0, 0, 400, 300);
      expect(getDrawCount(drawImage, full)).toBe(0);
    });
  });

  describe("element status", () => {
    it("draws the error placeholder and not the image for a hidden file in error", () => {
      const element = createElement({
        status: "error",
        thumbHash: createThumbHash(64, 48, 220),
      });
      const blur = getThumbHashPlaceholder(element.thumbHash!)!;
      const full = createImage(FULL_WIDTH, FULL_HEIGHT);

      renderImage(element, createCache(full), {
        spoileredFiles: new Map([[FILE_ID, "hidden"]]),
        isExporting: true,
      });

      expect(getDrawCount(drawImage, full)).toBe(0);
      expect(getDrawCount(drawImage, blur)).toBe(0);
    });
  });
});
