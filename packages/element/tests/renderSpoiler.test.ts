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
import {
  getSpoilerOverlayLayout,
  getSpoilerOverlayColors,
  isPointInSpoilerButton,
  SPOILER_FOREGROUND_DARK,
  SPOILER_FOREGROUND_LIGHT,
} from "../src/spoilerOverlay";

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
    zoom?: number;
    getHoveredSpoilerElementId?: () => string | null;
    spoilerButtonLabel?: string;
    hasCenterStatus?: (fileId: FileId) => boolean;
  } = {},
) => {
  const theme = opts.theme ?? THEME.LIGHT;
  const { spoileredFiles } = opts;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d")!;
  const elementsMap = arrayToMap(elements);
  const renderConfig: StaticCanvasRenderConfig = {
    canvasBackgroundColor: "#ffffff",
    imageCache,
    imageTransitionDuration: opts.imageTransitionDuration,
    spoiler: spoileredFiles && {
      isFileHidden: (fileId) => spoileredFiles.get(fileId) === "hidden",
      overlay: {
        label: opts.spoilerButtonLabel ?? LABEL,
        getHoveredElementId: opts.getHoveredSpoilerElementId ?? (() => null),
        hasCenterStatus: opts.hasCenterStatus ?? (() => false),
      },
    },
    renderGrid: false,
    isExporting: opts.isExporting ?? false,
    embedsValidationStatus: new Map(),
    elementsPendingErasure: new Set(),
    pendingFlowchartNodes: null,
    theme,
  };
  const appState = {
    zoom: { value: opts.zoom ?? 1 },
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
    it("draws the grey box with no glyph and not the image", () => {
      const element = createElement();
      const full = createImage(FULL_WIDTH, FULL_HEIGHT);

      renderImage(element, createCache(full), {
        spoileredFiles: new Map([[FILE_ID, "hidden"]]),
        isExporting: true,
      });

      expect(fillRect).toHaveBeenCalledWith(0, 0, 400, 300);
      expect(getIconDrawCount(drawImage)).toBe(0);
      expect(getDrawCount(drawImage, full)).toBe(0);
    });

    it("draws no glyph in the screen render path", () => {
      renderImage(createElement(), new Map(), {
        spoileredFiles: new Map([[FILE_ID, "hidden"]]),
      });

      expect(fillRect).toHaveBeenCalledWith(0, 0, 400, 300);
      expect(getIconDrawCount(drawImage)).toBe(0);
    });

    it("clips the cover of a rounded image like the shown image", () => {
      const proto = CanvasRenderingContext2D.prototype as any;
      const hadRoundRect = "roundRect" in proto;
      // the canvas mock has no roundRect. Add it before the render makes a
      // context, as the mock binds the prototype methods then.
      proto.roundRect ??= function () {};
      const roundRect = vi.spyOn(proto, "roundRect");
      const clip = vi.spyOn(CanvasRenderingContext2D.prototype, "clip");
      const element = {
        ...createElement({ thumbHash: createThumbHash(64, 48, 21) }),
        roundness: { type: 3 },
      } as NonDeleted<ExcalidrawImageElement>;
      const full = createImage(FULL_WIDTH, FULL_HEIGHT);

      renderImage(element, createCache(full), {
        spoileredFiles: new Map([[FILE_ID, "hidden"]]),
        isExporting: true,
      });
      const hiddenCalls = roundRect.mock.calls.slice();
      const hiddenClips = clip.mock.calls.length;
      roundRect.mockClear();
      clip.mockClear();
      renderImage({ ...element }, createCache(full), {
        spoileredFiles: new Map([[FILE_ID, "shown"]]),
        isExporting: true,
      });

      expect(hiddenCalls).toHaveLength(1);
      expect(hiddenCalls).toEqual(roundRect.mock.calls);
      expect(hiddenClips).toBe(clip.mock.calls.length);
      expect(hiddenClips).toBeGreaterThan(0);
      roundRect.mockRestore();
      clip.mockRestore();
      if (!hadRoundRect) {
        delete proto.roundRect;
      }
    });

    it("keeps the glyph of the placeholder of a shown or unmarked file", () => {
      renderImage(createElement(), new Map(), {
        spoileredFiles: new Map([[FILE_ID, "shown"]]),
      });
      renderImage(createElement(), new Map(), { spoileredFiles: new Map() });
      renderImage(createElement(), new Map(), { isExporting: true });

      expect(getIconDrawCount(drawImage)).toBe(3);
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

    it("does not change the cross-fade state of a hidden file (the App ends it)", () => {
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
      expect(entry.transitionStart).toBeDefined();
      expect(entry.placeholderImage).toBeDefined();
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

      // the App ends the cross-fade when the file is hidden (App.spoiler.ts)
      const entry = imageCache.get(FILE_ID)!;
      delete entry.placeholderImage;
      delete entry.transitionStart;
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

    it("draws the grey box with no error glyph for a hidden file in error", () => {
      const element = createElement({
        status: "error",
        thumbHash: createThumbHash(64, 48, 221),
      });

      renderImage(element, new Map(), {
        spoileredFiles: new Map([[FILE_ID, "hidden"]]),
      });

      expect(fillRect).toHaveBeenCalledWith(0, 0, 400, 300);
      expect(getIconDrawCount(drawImage)).toBe(0);
    });

    it("keeps the error glyph for a shown file in error", () => {
      const element = createElement({
        status: "error",
        thumbHash: createThumbHash(64, 48, 222),
      });

      renderImage(element, new Map(), {
        spoileredFiles: new Map([[FILE_ID, "shown"]]),
      });

      expect(getIconDrawCount(drawImage)).toBe(1);
    });
  });
});

// -----------------------------------------------------------------------------
// MyOC: the eye-closed icon and the "Show spoiler" button (step 4)
// -----------------------------------------------------------------------------

const LABEL = "Show spoiler";

const createSizedElement = (
  width: number,
  height: number,
  opts: Parameters<typeof createElement>[0] & {
    angle?: number;
    scale?: [number, number];
    x?: number;
    y?: number;
  } = {},
) => {
  const element = createElement(opts);
  return {
    ...element,
    x: opts.x ?? 0,
    y: opts.y ?? 0,
    width,
    height,
    angle: (opts.angle ?? 0) as ExcalidrawImageElement["angle"],
    scale: opts.scale ?? [1, 1],
  } as NonDeleted<ExcalidrawImageElement>;
};

/** the button rect in screen px, relative to the element centre */
const toScreen = (
  rect: { x: number; y: number; width: number; height: number },
  element: { width: number; height: number },
  zoom: number,
) => ({
  dx: (rect.x - element.width / 2) * zoom,
  dy: (rect.y - element.height / 2) * zoom,
  width: rect.width * zoom,
  height: rect.height * zoom,
});

describe("spoiler overlay geometry", () => {
  const element = createSizedElement(400, 300);

  it.each([0.5, 1, 2, 4])(
    "keeps one on-screen size and the element centre at zoom %s",
    (zoom) => {
      const big = createSizedElement(400 / zoom + 400, 300 / zoom + 300);
      const reference = getSpoilerOverlayLayout(big, 1, LABEL);
      const layout = getSpoilerOverlayLayout(big, zoom, LABEL);

      expect(layout.button).not.toBeNull();
      const screen = toScreen(layout.button!, big, zoom);
      const referenceScreen = toScreen(reference.button!, big, 1);
      expect(screen.width).toBeCloseTo(referenceScreen.width);
      expect(screen.height).toBeCloseTo(24);
      expect(screen.dx).toBeCloseTo(referenceScreen.dx);
      expect(screen.dy).toBeCloseTo(referenceScreen.dy);
      // horizontally centred
      expect(layout.button!.x + layout.button!.width / 2).toBeCloseTo(
        big.width / 2,
      );
      expect(layout.icon!.x).toBeCloseTo(big.width / 2);
      expect(layout.icon!.size * zoom).toBeCloseTo(22);
    },
  );

  it("centres the icon and the button together on the element centre", () => {
    const { icon, button } = getSpoilerOverlayLayout(element, 1, LABEL);
    const top = icon!.y - icon!.size / 2;
    const bottom = button!.y + button!.height;
    expect((top + bottom) / 2).toBeCloseTo(element.height / 2);
    // the icon is above the button
    expect(icon!.y + icon!.size / 2).toBeLessThan(button!.y);
  });

  it("makes the button wider for a longer label", () => {
    const short = getSpoilerOverlayLayout(element, 1, "Show");
    const long = getSpoilerOverlayLayout(element, 1, "Show the spoiler now");
    expect(long.button!.width).toBeGreaterThan(short.button!.width);
  });

  describe("minimum on-screen size", () => {
    it("has no button and keeps the icon for a small element", () => {
      const small = createSizedElement(56, 44);
      const { icon, button } = getSpoilerOverlayLayout(small, 1, LABEL);
      expect(button).toBeNull();
      expect(icon).not.toBeNull();
      expect(icon!.x).toBe(28);
      expect(icon!.y).toBe(22);
    });

    it("drops the button when the zoom makes the element small", () => {
      expect(getSpoilerOverlayLayout(element, 1, LABEL).button).not.toBeNull();
      expect(getSpoilerOverlayLayout(element, 0.25, LABEL).button).toBeNull();
      expect(getSpoilerOverlayLayout(element, 0.25, LABEL).icon).not.toBeNull();
    });

    it("adds the button when the zoom makes a small element big", () => {
      const small = createSizedElement(56, 44);
      expect(getSpoilerOverlayLayout(small, 1, LABEL).button).toBeNull();
      expect(getSpoilerOverlayLayout(small, 4, LABEL).button).not.toBeNull();
    });

    it("has no button when only the width is too small", () => {
      const narrow = createSizedElement(80, 600);
      expect(getSpoilerOverlayLayout(narrow, 1, LABEL).button).toBeNull();
    });

    it("has no button when only the height is too small", () => {
      const flat = createSizedElement(800, 50);
      expect(getSpoilerOverlayLayout(flat, 1, LABEL).button).toBeNull();
    });

    it("keeps the button at the exact limit and drops it 1px below", () => {
      const { button } = getSpoilerOverlayLayout(element, 1, LABEL);
      // 8px free on each side
      const minWidth = button!.width + 16;
      const minHeight = 22 + 6 + 24 + 16;
      expect(
        getSpoilerOverlayLayout(
          createSizedElement(minWidth, minHeight),
          1,
          LABEL,
        ).button,
      ).not.toBeNull();
      expect(
        getSpoilerOverlayLayout(
          createSizedElement(minWidth - 1, minHeight),
          1,
          LABEL,
        ).button,
      ).toBeNull();
      expect(
        getSpoilerOverlayLayout(
          createSizedElement(minWidth, minHeight - 1),
          1,
          LABEL,
        ).button,
      ).toBeNull();
    });

    it("makes the icon smaller in a very small element", () => {
      const tiny = createSizedElement(20, 20);
      const { icon } = getSpoilerOverlayLayout(tiny, 1, LABEL);
      expect(icon!.size).toBe(10);
    });

    it("draws nothing when the icon would be smaller than 6px", () => {
      const tiny = createSizedElement(10, 10);
      expect(getSpoilerOverlayLayout(tiny, 1, LABEL)).toEqual({
        icon: null,
        button: null,
      });
    });
  });

  describe("hit test", () => {
    const center = (rect: {
      x: number;
      y: number;
      width: number;
      height: number;
    }) => ({
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
    });

    it("is true inside the button and false outside it", () => {
      const placed = createSizedElement(400, 300, { x: 100, y: 50 });
      const { button, icon } = getSpoilerOverlayLayout(placed, 1, LABEL);
      const c = center(button!);
      expect(
        isPointInSpoilerButton(placed, { x: 100 + c.x, y: 50 + c.y }, 1, LABEL),
      ).toBe(true);
      // the corners of the button are inside
      expect(
        isPointInSpoilerButton(
          placed,
          { x: 100 + button!.x, y: 50 + button!.y },
          1,
          LABEL,
        ),
      ).toBe(true);
      // on the icon, on the blur, outside the element
      expect(
        isPointInSpoilerButton(
          placed,
          { x: 100 + icon!.x, y: 50 + icon!.y },
          1,
          LABEL,
        ),
      ).toBe(false);
      expect(isPointInSpoilerButton(placed, { x: 110, y: 60 }, 1, LABEL)).toBe(
        false,
      );
      expect(isPointInSpoilerButton(placed, { x: 0, y: 0 }, 1, LABEL)).toBe(
        false,
      );
      expect(
        isPointInSpoilerButton(
          placed,
          { x: 100 + button!.x - 1, y: 50 + c.y },
          1,
          LABEL,
        ),
      ).toBe(false);
    });

    it("follows the zoom", () => {
      const placed = createSizedElement(400, 300);
      const atOne = getSpoilerOverlayLayout(placed, 1, LABEL).button!;
      // a point inside the button at zoom 1, just right of the button at
      // zoom 2 (the button is half as wide in scene units)
      const point = { x: atOne.x + 2, y: atOne.y + atOne.height / 2 };
      expect(isPointInSpoilerButton(placed, point, 1, LABEL)).toBe(true);
      expect(isPointInSpoilerButton(placed, point, 2, LABEL)).toBe(false);
    });

    it("is false for a small element", () => {
      const small = createSizedElement(56, 44);
      expect(isPointInSpoilerButton(small, { x: 28, y: 22 }, 1, LABEL)).toBe(
        false,
      );
    });

    it("follows the rotation", () => {
      const rotated = createSizedElement(400, 300, {
        angle: Math.PI / 2,
      });
      const { button } = getSpoilerOverlayLayout(rotated, 1, LABEL);
      const c = center(button!);
      // offset of the button centre from the element centre
      const dx = c.x - 200;
      const dy = c.y - 150;
      // a quarter turn clockwise: (dx, dy) goes to (-dy, dx)
      expect(
        isPointInSpoilerButton(rotated, { x: 200 - dy, y: 150 + dx }, 1, LABEL),
      ).toBe(true);
      // the unrotated position is outside the rotated button
      expect(
        isPointInSpoilerButton(rotated, { x: 200 + dx, y: 150 + dy }, 1, LABEL),
      ).toBe(false);
    });

    it("follows the element when it is rotated by a half turn", () => {
      const rotated = createSizedElement(400, 300, { angle: Math.PI });
      const { button } = getSpoilerOverlayLayout(rotated, 1, LABEL);
      const c = center(button!);
      expect(
        isPointInSpoilerButton(
          rotated,
          { x: 400 - c.x, y: 300 - c.y },
          1,
          LABEL,
        ),
      ).toBe(true);
      expect(isPointInSpoilerButton(rotated, c, 1, LABEL)).toBe(false);
    });

    it.each([[[-1, 1]], [[1, -1]], [[-1, -1]]] as [[number, number]][])(
      "keeps the button where it draws for the flip %j",
      (scale) => {
        const flipped = createSizedElement(400, 300, { scale });
        const { button } = getSpoilerOverlayLayout(flipped, 1, LABEL);
        const c = center(button!);
        // the draw cancels the flip, so the button is not mirrored
        expect(isPointInSpoilerButton(flipped, c, 1, LABEL)).toBe(true);
        expect(
          isPointInSpoilerButton(flipped, { x: c.x, y: 300 - c.y }, 1, LABEL),
        ).toBe(false);
      },
    );

    it("uses the flip and the rotation together", () => {
      const element = createSizedElement(400, 300, {
        angle: Math.PI / 2,
        scale: [1, -1],
      });
      const c = center(getSpoilerOverlayLayout(element, 1, LABEL).button!);
      const dx = c.x - 200;
      const dy = c.y - 150;
      expect(
        isPointInSpoilerButton(element, { x: 200 - dy, y: 150 + dx }, 1, LABEL),
      ).toBe(true);
    });
  });
});

/** the canvas mock writes colours in its own format: compare channels */
const channels = (color: string) =>
  color.startsWith("#")
    ? [1, 3, 5].map((index) => parseInt(color.slice(index, index + 2), 16))
    : color.match(/[\d.]+/g)!.map((part) => Math.round(parseFloat(part)));

const createColorThumbHash = (r: number, g: number, b: number) => {
  const rgba = new Uint8Array(16 * 16 * 4);
  for (let index = 0; index < rgba.length; index += 4) {
    rgba[index] = r;
    rgba[index + 1] = g;
    rgba[index + 2] = b;
    rgba[index + 3] = 255;
  }
  return btoa(String.fromCharCode(...rgbaToThumbHash(16, 16, rgba)));
};

const LIGHT_HASH = createColorThumbHash(235, 230, 220);
const DARK_HASH = createColorThumbHash(30, 35, 50);

/** sum of the r, g and b channels of an rgba() colour */
const brightness = (color: string) =>
  channels(color)
    .slice(0, 3)
    .reduce((sum, channel) => sum + channel, 0);

describe("spoiler overlay colours", () => {
  describe("with no ThumbHash (the grey placeholder)", () => {
    it("uses a dark icon and a light button in the light theme", () => {
      const colors = getSpoilerOverlayColors(null, false, "light");
      expect(colors.foreground).toBe(SPOILER_FOREGROUND_DARK);
      expect(brightness(colors.button)).toBeGreaterThan(3 * 200);
    });

    it("uses a white icon and a dark scrim in the dark theme", () => {
      const colors = getSpoilerOverlayColors(null, false, "dark");
      expect(colors.foreground).toBe(SPOILER_FOREGROUND_LIGHT);
      expect(brightness(colors.button)).toBeLessThan(3 * 40);
      expect(channels(colors.button)[3]).toBeGreaterThan(0.5);
    });

    it("uses the light theme when no theme is given", () => {
      expect(getSpoilerOverlayColors(null, false)).toEqual(
        getSpoilerOverlayColors(null, false, "light"),
      );
    });

    it("has a different hover colour in both themes", () => {
      for (const theme of ["light", "dark"] as const) {
        expect(getSpoilerOverlayColors(null, true, theme).button).not.toBe(
          getSpoilerOverlayColors(null, false, theme).button,
        );
      }
    });

    it("uses the placeholder colours for a ThumbHash that does not decode", () => {
      expect(
        getSpoilerOverlayColors("not a thumbhash!", false, "dark"),
      ).toEqual(getSpoilerOverlayColors(null, false, "dark"));
      expect(
        getSpoilerOverlayColors("not a thumbhash!", false, "light"),
      ).toEqual(getSpoilerOverlayColors(null, false, "light"));
    });
  });

  describe("with a ThumbHash", () => {
    it("uses a dark icon and a light button for a light average colour", () => {
      const colors = getSpoilerOverlayColors(LIGHT_HASH, false, "dark");
      expect(colors.foreground).toBe(SPOILER_FOREGROUND_DARK);
      expect(brightness(colors.button)).toBeGreaterThan(3 * 200);
    });

    it("uses a white icon and a dark button for a dark average colour", () => {
      const colors = getSpoilerOverlayColors(DARK_HASH, false, "light");
      expect(colors.foreground).toBe(SPOILER_FOREGROUND_LIGHT);
      expect(brightness(colors.button)).toBeLessThan(3 * 60);
    });

    it("does not use the theme when the ThumbHash decodes", () => {
      expect(getSpoilerOverlayColors(DARK_HASH, false, "light")).toEqual(
        getSpoilerOverlayColors(DARK_HASH, false, "dark"),
      );
    });

    it("uses a white icon for pure black and a dark icon for pure white", () => {
      expect(
        getSpoilerOverlayColors(createColorThumbHash(0, 0, 0), false)
          .foreground,
      ).toBe(SPOILER_FOREGROUND_LIGHT);
      expect(
        getSpoilerOverlayColors(createColorThumbHash(255, 255, 255), false)
          .foreground,
      ).toBe(SPOILER_FOREGROUND_DARK);
    });

    it("takes the hue of the average colour", () => {
      const red = channels(
        getSpoilerOverlayColors(createColorThumbHash(200, 20, 20), false)
          .button,
      );
      const blue = channels(
        getSpoilerOverlayColors(createColorThumbHash(20, 20, 200), false)
          .button,
      );
      expect(red[0]).toBeGreaterThan(red[2]);
      expect(blue[2]).toBeGreaterThan(blue[0]);
    });

    it("keeps more of the average colour on hover (dark cover: lighter)", () => {
      const normal = getSpoilerOverlayColors(DARK_HASH, false).button;
      const hovered = getSpoilerOverlayColors(DARK_HASH, true).button;
      expect(brightness(hovered)).toBeGreaterThan(brightness(normal));
    });

    it("keeps more of the average colour on hover (light cover: darker)", () => {
      const normal = getSpoilerOverlayColors(LIGHT_HASH, false).button;
      const hovered = getSpoilerOverlayColors(LIGHT_HASH, true).button;
      expect(brightness(hovered)).toBeLessThan(brightness(normal));
    });

    // WCAG contrast of the label against the opaque part of the button
    it.each([
      ["light", LIGHT_HASH],
      ["dark", DARK_HASH],
      ["mid grey", createColorThumbHash(128, 128, 128)],
      ["saturated", createColorThumbHash(40, 200, 90)],
    ])("gives the label a 4.5:1 contrast on a %s cover", (_, hash) => {
      const lum = (rgb: number[]) => {
        const [r, g, b] = rgb.map((channel) => {
          const c = channel / 255;
          return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      for (const hovered of [false, true]) {
        const colors = getSpoilerOverlayColors(hash, hovered);
        const button = lum(channels(colors.button).slice(0, 3));
        const label =
          colors.foreground === SPOILER_FOREGROUND_DARK
            ? lum([0x1d, 0x1d, 0x1b])
            : 1;
        const contrast =
          (Math.max(button, label) + 0.05) / (Math.min(button, label) + 0.05);
        expect(contrast).toBeGreaterThan(4.5);
      }
    });
  });
});

describe("spoiler overlay draw", () => {
  let fillText: ReturnType<typeof vi.spyOn>;
  let stroke: ReturnType<typeof vi.spyOn>;
  let fill: ReturnType<typeof vi.spyOn>;
  let scale: ReturnType<typeof vi.spyOn>;
  let fillStyles: string[];
  let fonts: string[];
  let strokeStyles: string[];
  let textStyles: string[];

  beforeEach(() => {
    fillStyles = [];
    fonts = [];
    strokeStyles = [];
    textStyles = [];
    fillText = vi.spyOn(CanvasRenderingContext2D.prototype, "fillText");
    const originalStroke = CanvasRenderingContext2D.prototype.stroke;
    stroke = vi.spyOn(CanvasRenderingContext2D.prototype, "stroke");
    scale = vi.spyOn(CanvasRenderingContext2D.prototype, "scale");
    const originalFill = CanvasRenderingContext2D.prototype.fill;
    fill = vi
      .spyOn(CanvasRenderingContext2D.prototype, "fill")
      .mockImplementation(function (
        this: CanvasRenderingContext2D,
        ...args: any[]
      ) {
        fillStyles.push(String(this.fillStyle));
        return (originalFill as any).apply(this, args);
      });
    fillText.mockImplementation(function (this: CanvasRenderingContext2D) {
      fonts.push(this.font);
      textStyles.push(String(this.fillStyle));
    });
    stroke.mockImplementation(function (
      this: CanvasRenderingContext2D,
      ...args: any[]
    ) {
      if (args[0] instanceof Path2D) {
        strokeStyles.push(String(this.strokeStyle));
      }
      return (originalStroke as any).apply(this, args);
    });
  });

  afterEach(() => {
    fillText.mockRestore();
    stroke.mockRestore();
    fill.mockRestore();
    scale.mockRestore();
  });

  const hidden = (): SpoilerMap => new Map([[FILE_ID, "hidden"]]);
  const labelCalls = () =>
    fillText.mock.calls.filter((args: unknown[]) => args[0] === LABEL);
  /** strokes of a Path2D: the icon */
  const iconStrokes = () =>
    stroke.mock.calls.filter((args: unknown[]) => args[0] instanceof Path2D);
  const contextsOf = (spy: ReturnType<typeof vi.spyOn>) =>
    spy.mock.contexts as CanvasRenderingContext2D[];

  it("draws the icon and the button for a hidden file", () => {
    const element = createSizedElement(400, 300, {
      thumbHash: createThumbHash(64, 48, 11),
    });
    renderImage(element, createCache(createImage(FULL_WIDTH, FULL_HEIGHT)), {
      spoileredFiles: hidden(),
    });
    expect(labelCalls()).toHaveLength(1);
    expect(iconStrokes()).toHaveLength(1);
  });

  it("draws no icon and no button, only the cover, while a centre status owns the centre", () => {
    const element = createSizedElement(400, 300, {
      thumbHash: createThumbHash(64, 48, 12),
    });
    const blur = getThumbHashPlaceholder(element.thumbHash!)!;
    const drawImage = vi.spyOn(CanvasRenderingContext2D.prototype, "drawImage");
    renderImage(element, createCache(createImage(FULL_WIDTH, FULL_HEIGHT)), {
      spoileredFiles: hidden(),
      hasCenterStatus: (fileId) => fileId === FILE_ID,
    });
    expect(labelCalls()).toHaveLength(0);
    expect(iconStrokes()).toHaveLength(0);
    expect(getDrawCount(drawImage, blur)).toBe(1);
    expect(elementWithCanvasCache.get(element)!.spoilerOverlayKey).toBe(null);
    drawImage.mockRestore();
  });

  it("draws the icon and the button again when the centre status ends", () => {
    const element = createSizedElement(400, 300);
    let busy = true;
    const opts = {
      spoileredFiles: hidden(),
      hasCenterStatus: () => busy,
    };
    renderImage(element, new Map(), opts);
    expect(labelCalls()).toHaveLength(0);
    busy = false;
    renderImage(element, new Map(), opts);
    expect(labelCalls()).toHaveLength(1);
  });

  it("draws the label at the button centre", () => {
    const element = createSizedElement(400, 300, {
      thumbHash: createThumbHash(64, 48, 12),
    });
    renderImage(element, new Map(), { spoileredFiles: hidden() });
    const { button } = getSpoilerOverlayLayout(element, 1, LABEL);
    expect(labelCalls()[0]).toEqual([
      LABEL,
      button!.x + button!.width / 2,
      button!.y + button!.height / 2,
    ]);
  });

  it("draws the icon and the button with no ThumbHash", () => {
    renderImage(createSizedElement(400, 300), new Map(), {
      spoileredFiles: hidden(),
    });
    expect(labelCalls()).toHaveLength(1);
    expect(iconStrokes()).toHaveLength(1);
    expect(fillStyles.map(channels)).toContainEqual(
      channels(getSpoilerOverlayColors(null, false, "light").button),
    );
  });

  it("draws the overlay in the element canvas, so it moves with the element", () => {
    const element = createSizedElement(400, 300, {
      thumbHash: createThumbHash(64, 48, 13),
    });
    renderImage(element, new Map(), { spoileredFiles: hidden() });
    const elementCanvas = elementWithCanvasCache.get(element)!.canvas;
    const labelIndex = fillText.mock.calls.findIndex(
      (args: unknown[]) => args[0] === LABEL,
    );
    expect(contextsOf(fillText)[labelIndex].canvas).toBe(elementCanvas);
  });

  it("uses the label from the render config", () => {
    renderImage(createSizedElement(400, 300), new Map(), {
      spoileredFiles: hidden(),
      spoilerButtonLabel: "Spoiler zeigen",
    });
    expect(fillText).toHaveBeenCalledWith(
      "Spoiler zeigen",
      expect.any(Number),
      expect.any(Number),
    );
    expect(labelCalls()).toHaveLength(0);
  });

  it.each([0.5, 1, 2, 4])("scales the font by 1 / zoom at zoom %s", (zoom) => {
    const element = createSizedElement(1000, 800, {
      thumbHash: createThumbHash(64, 48, 14),
    });
    renderImage(element, new Map(), { spoileredFiles: hidden(), zoom });
    expect(labelCalls()).toHaveLength(1);
    expect(fonts[0]).toContain(`${12 / zoom}px`);
  });

  it("draws only the icon below the minimum size", () => {
    renderImage(createSizedElement(56, 44), new Map(), {
      spoileredFiles: hidden(),
    });
    expect(labelCalls()).toHaveLength(0);
    expect(iconStrokes()).toHaveLength(1);
  });

  it("draws only the icon when zoomed out far", () => {
    renderImage(createSizedElement(400, 300), new Map(), {
      spoileredFiles: hidden(),
      zoom: 0.2,
    });
    expect(labelCalls()).toHaveLength(0);
    expect(iconStrokes()).toHaveLength(1);
  });

  it("draws no overlay when exporting", () => {
    renderImage(
      createSizedElement(400, 300, { thumbHash: createThumbHash(64, 48, 15) }),
      new Map(),
      { spoileredFiles: hidden(), isExporting: true },
    );
    expect(labelCalls()).toHaveLength(0);
    expect(iconStrokes()).toHaveLength(0);
  });

  it("draws no overlay for a shown file", () => {
    renderImage(
      createSizedElement(400, 300),
      createCache(createImage(FULL_WIDTH, FULL_HEIGHT)),
      { spoileredFiles: new Map([[FILE_ID, "shown"]]) },
    );
    expect(labelCalls()).toHaveLength(0);
    expect(iconStrokes()).toHaveLength(0);
  });

  it("draws no overlay for an unmarked file", () => {
    renderImage(
      createSizedElement(400, 300),
      createCache(createImage(FULL_WIDTH, FULL_HEIGHT)),
      { spoileredFiles: new Map([[OTHER_FILE_ID, "hidden"]]) },
    );
    expect(labelCalls()).toHaveLength(0);
  });

  it("draws the overlay of each hidden image once", () => {
    const a = createSizedElement(400, 300);
    const b = { ...createSizedElement(400, 300), id: "b", x: 500 };
    renderImages([a, b], new Map(), { spoileredFiles: hidden() });
    expect(labelCalls()).toHaveLength(2);
  });

  describe("hover", () => {
    it("draws the button in the hover colour", () => {
      const element = createSizedElement(400, 300);
      renderImage(element, new Map(), {
        spoileredFiles: hidden(),
        getHoveredSpoilerElementId: () => element.id,
      });
      expect(fillStyles.map(channels)).toContainEqual(
        channels(getSpoilerOverlayColors(null, true).button),
      );
      expect(fillStyles.map(channels)).not.toContainEqual(
        channels(getSpoilerOverlayColors(null, false).button),
      );
    });

    it("draws the button in the normal colour when another element is hovered", () => {
      renderImage(createSizedElement(400, 300), new Map(), {
        spoileredFiles: hidden(),
        getHoveredSpoilerElementId: () => "other",
      });
      expect(fillStyles.map(channels)).toContainEqual(
        channels(getSpoilerOverlayColors(null, false).button),
      );
      expect(fillStyles.map(channels)).not.toContainEqual(
        channels(getSpoilerOverlayColors(null, true).button),
      );
    });

    it("draws the ThumbHash hover colour", () => {
      const element = createSizedElement(400, 300, {
        thumbHash: createThumbHash(64, 48, 16),
      });
      renderImage(element, new Map(), {
        spoileredFiles: hidden(),
        getHoveredSpoilerElementId: () => element.id,
      });
      const expected = getSpoilerOverlayColors(element.thumbHash, true).button;
      expect(fillStyles.map(channels)).toContainEqual(channels(expected));
    });
  });

  describe("icon and label colour", () => {
    const expectForeground = (color: string) => {
      expect(strokeStyles.map(channels)).toEqual([channels(color)]);
      expect(textStyles.map(channels)).toEqual([channels(color)]);
    };

    it("is dark on a light ThumbHash", () => {
      renderImage(
        createSizedElement(400, 300, { thumbHash: LIGHT_HASH }),
        new Map(),
        { spoileredFiles: hidden() },
      );
      expectForeground(SPOILER_FOREGROUND_DARK);
    });

    it("is white on a dark ThumbHash", () => {
      renderImage(
        createSizedElement(400, 300, { thumbHash: DARK_HASH }),
        new Map(),
        { spoileredFiles: hidden() },
      );
      expectForeground(SPOILER_FOREGROUND_LIGHT);
    });

    it("is dark on the light-theme grey placeholder", () => {
      renderImage(createSizedElement(400, 300), new Map(), {
        spoileredFiles: hidden(),
        theme: THEME.LIGHT,
      });
      expectForeground(SPOILER_FOREGROUND_DARK);
    });

    it("is white on the dark-theme grey placeholder", () => {
      renderImage(createSizedElement(400, 300), new Map(), {
        spoileredFiles: hidden(),
        theme: THEME.DARK,
      });
      expectForeground(SPOILER_FOREGROUND_LIGHT);
    });

    it("follows the grey placeholder, not the ThumbHash, for a file in error", () => {
      // the error placeholder is the grey box even with a ThumbHash
      renderImage(
        createSizedElement(400, 300, { thumbHash: DARK_HASH, status: "error" }),
        new Map(),
        { spoileredFiles: hidden(), theme: THEME.LIGHT },
      );
      expectForeground(SPOILER_FOREGROUND_DARK);
    });

    it("draws no grey placeholder glyph under the overlay", () => {
      const drawImage = vi.spyOn(
        CanvasRenderingContext2D.prototype,
        "drawImage",
      );
      renderImage(createSizedElement(400, 300), new Map(), {
        spoileredFiles: hidden(),
      });
      expect(getIconDrawCount(drawImage)).toBe(0);
      drawImage.mockRestore();
    });
  });

  describe("element canvas cache key", () => {
    it("makes the element canvas again when the hover state changes", () => {
      const element = createSizedElement(400, 300);
      let hoveredId: string | null = null;
      const opts = {
        spoileredFiles: hidden(),
        getHoveredSpoilerElementId: () => hoveredId,
      };
      renderImage(element, new Map(), opts);
      const normal = elementWithCanvasCache.get(element);

      renderImage(element, new Map(), opts);
      expect(elementWithCanvasCache.get(element)).toBe(normal);

      hoveredId = element.id;
      renderImage(element, new Map(), opts);
      const hovered = elementWithCanvasCache.get(element);
      expect(hovered).not.toBe(normal);

      renderImage(element, new Map(), opts);
      expect(elementWithCanvasCache.get(element)).toBe(hovered);

      hoveredId = null;
      renderImage(element, new Map(), opts);
      expect(elementWithCanvasCache.get(element)).not.toBe(hovered);
    });

    it("keeps the element canvas of the other images when one is hovered", () => {
      const a = createSizedElement(400, 300);
      const b = {
        ...createSizedElement(400, 300),
        id: "b",
        x: 500,
      } as NonDeleted<ExcalidrawImageElement>;
      const c = {
        ...createSizedElement(400, 300, { fileId: OTHER_FILE_ID }),
        id: "c",
        x: 1000,
      } as NonDeleted<ExcalidrawImageElement>;
      let hoveredId: string | null = null;
      const imageCache = createCache(
        createImage(FULL_WIDTH, FULL_HEIGHT),
        {},
        OTHER_FILE_ID,
      );
      const opts = {
        spoileredFiles: hidden(),
        getHoveredSpoilerElementId: () => hoveredId,
      };
      renderImages([a, b, c], imageCache, opts);
      const before = [a, b, c].map((el) => elementWithCanvasCache.get(el));

      hoveredId = a.id;
      renderImages([a, b, c], imageCache, opts);
      expect(elementWithCanvasCache.get(a)).not.toBe(before[0]);
      expect(elementWithCanvasCache.get(b)).toBe(before[1]);
      expect(elementWithCanvasCache.get(c)).toBe(before[2]);
    });

    it("ignores the hover id for an image with no overlay", () => {
      const element = createSizedElement(400, 300);
      let hoveredId: string | null = null;
      const imageCache = createCache(createImage(FULL_WIDTH, FULL_HEIGHT));
      const opts = {
        spoileredFiles: new Map<FileId, SpoilerVisibility>([
          [FILE_ID, "shown"],
        ]),
        getHoveredSpoilerElementId: () => hoveredId,
      };
      renderImage(element, imageCache, opts);
      const cached = elementWithCanvasCache.get(element);
      hoveredId = element.id;
      renderImage(element, imageCache, opts);
      expect(elementWithCanvasCache.get(element)).toBe(cached);
    });

    it("has no overlay key for a shown or unmarked image", () => {
      const element = createSizedElement(400, 300);
      renderImage(element, createCache(createImage(FULL_WIDTH, FULL_HEIGHT)), {
        spoileredFiles: new Map(),
      });
      expect(elementWithCanvasCache.get(element)!.spoilerOverlayKey).toBe(null);
    });

    it("makes the element canvas again when the label changes", () => {
      const element = createSizedElement(400, 300);
      renderImage(element, new Map(), {
        spoileredFiles: hidden(),
        spoilerButtonLabel: "Show spoiler",
      });
      const english = elementWithCanvasCache.get(element);
      renderImage(element, new Map(), {
        spoileredFiles: hidden(),
        spoilerButtonLabel: "Spoiler zeigen",
      });
      expect(elementWithCanvasCache.get(element)).not.toBe(english);
    });

    it("makes the element canvas again when the file loads (the flip starts)", () => {
      const element = createSizedElement(400, 300, { scale: [-1, 1] });
      renderImage(element, new Map(), { spoileredFiles: hidden() });
      const pending = elementWithCanvasCache.get(element);
      renderImage(element, createCache(createImage(FULL_WIDTH, FULL_HEIGHT)), {
        spoileredFiles: hidden(),
      });
      expect(elementWithCanvasCache.get(element)).not.toBe(pending);
    });
  });

  describe("flip", () => {
    /** scale calls with a negative value on the element canvas */
    const flipCallsOn = (canvas: HTMLCanvasElement) =>
      scale.mock.calls.filter(
        (args: unknown[], index: number) =>
          contextsOf(scale)[index].canvas === canvas &&
          ((args[0] as number) < 0 || (args[1] as number) < 0),
      );

    it.each([[[-1, 1]], [[1, -1]], [[-1, -1]]] as [[number, number]][])(
      "cancels the flip %j in the element canvas of a loaded file",
      (flip) => {
        const element = createSizedElement(400, 300, { scale: flip });
        renderImage(
          element,
          createCache(createImage(FULL_WIDTH, FULL_HEIGHT)),
          { spoileredFiles: hidden() },
        );
        const elementCanvas = elementWithCanvasCache.get(element)!.canvas;
        expect(flipCallsOn(elementCanvas)).toEqual([flip]);
        // and the screen canvas applies the element flip
        expect(
          scale.mock.calls.filter(
            (args: unknown[], index: number) =>
              contextsOf(scale)[index].canvas !== elementCanvas &&
              args[0] === flip[0] &&
              args[1] === flip[1],
          ),
        ).toHaveLength(1);
      },
    );

    it("does not cancel a flip that the screen canvas does not apply (file not loaded)", () => {
      const element = createSizedElement(400, 300, { scale: [-1, 1] });
      renderImage(element, new Map(), { spoileredFiles: hidden() });
      const elementCanvas = elementWithCanvasCache.get(element)!.canvas;
      expect(flipCallsOn(elementCanvas)).toEqual([]);
    });

    it("does not flip an element that is not flipped", () => {
      const element = createSizedElement(400, 300);
      renderImage(element, createCache(createImage(FULL_WIDTH, FULL_HEIGHT)), {
        spoileredFiles: hidden(),
      });
      expect(flipCallsOn(elementWithCanvasCache.get(element)!.canvas)).toEqual(
        [],
      );
    });
  });
});
