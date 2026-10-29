import React from "react";
import { vi } from "vitest";

import { KEYS, MIME_TYPES, arrayToMap } from "@excalidraw/common";

import { Excalidraw } from "@excalidraw/excalidraw";

import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { Keyboard, Pointer } from "@excalidraw/excalidraw/tests/helpers/ui";
import {
  GlobalTestState,
  render,
  unmountComponent,
} from "@excalidraw/excalidraw/tests/test-utils";

import type { NormalizedZoomValue } from "@excalidraw/excalidraw/types";

import { getTransformHandles } from "../src/transformHandles";

import type { ExcalidrawImageElement, FileId, ImageCrop } from "../src/types";

// MyOC: during a progressive load, imageCache holds a small thumbnail. The
// crop stays in the pixels of the full image, so crop editing must not use the
// pixel size of the thumbnail.

const { h } = window;
const mouse = new Pointer("mouse");

const FILE_ID = "crop-thumbnail-file" as FileId;

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

const createImage = (naturalWidth: number, naturalHeight: number) => {
  const image = new Image();
  Object.defineProperty(image, "naturalWidth", { value: naturalWidth });
  Object.defineProperty(image, "naturalHeight", { value: naturalHeight });
  return image;
};

const getImageElement = () => h.elements[0] as ExcalidrawImageElement;

beforeEach(async () => {
  unmountComponent();
  mouse.reset();
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();

  Object.assign(document, {
    elementFromPoint: () => GlobalTestState.canvas,
  });
  await render(<Excalidraw handleKeyboardGlobally={true} />);
  API.setAppState({ zoom: { value: 1 as NormalizedZoomValue } });

  const image = {
    ...API.createElement({
      type: "image",
      x: 0,
      y: 0,
      width: 400,
      height: 300,
      fileId: FILE_ID,
      status: "saved",
    }),
    crop: CROP,
  };
  API.setElements([image]);
  h.app.imageCache.set(FILE_ID, {
    image: createImage(FULL_WIDTH / 4, FULL_HEIGHT / 4),
    mimeType: MIME_TYPES.jpg,
    isPlaceholder: true,
  });
  API.setAppState({ selectedElementIds: { [image.id]: true } });
  Keyboard.keyDown(KEYS.ENTER);
  expect(h.state.croppingElementId).toBe(image.id);
});

describe("crop an image while its thumbnail shows", () => {
  it("moves the crop in full image pixels when the user drags the image", () => {
    // the uncropped image is 800 px wide on the canvas, so 1 canvas px is
    // 2 px of the full image
    mouse.downAt(200, 150);
    // pointer events only: a mousemove before the pointermove would move the
    // previous pointer coords and leave no offset for the crop drag
    mouse.move(20, 10);
    mouse.up();

    const crop = getImageElement().crop!;
    expect(crop.x).toBeCloseTo(CROP.x - 40);
    expect(crop.y).toBeCloseTo(CROP.y - 20);
    expect(crop.width).toBe(CROP.width);
    expect(crop.height).toBe(CROP.height);
    expect(crop.naturalWidth).toBe(FULL_WIDTH);
    expect(crop.naturalHeight).toBe(FULL_HEIGHT);
  });

  it("resizes the crop in full image pixels when the user drags a handle", () => {
    const element = getImageElement();
    const [handleX, handleY, handleWidth, handleHeight] = getTransformHandles(
      element,
      h.state.zoom,
      arrayToMap(h.elements),
      "mouse",
      {},
    ).e!;
    const startX = handleX + handleWidth / 2;
    const startY = handleY + handleHeight / 2;

    mouse.downAt(startX, startY);
    mouse.moveTo(startX - 40, startY);
    mouse.up();

    const next = getImageElement();
    expect(next.width).toBeCloseTo(360);
    expect(next.crop!.x).toBeCloseTo(CROP.x);
    expect(next.crop!.width).toBeCloseTo(720);
    expect(next.crop!.height).toBeCloseTo(CROP.height);
    expect(next.crop!.naturalWidth).toBe(FULL_WIDTH);
    expect(next.crop!.naturalHeight).toBe(FULL_HEIGHT);
  });
});
