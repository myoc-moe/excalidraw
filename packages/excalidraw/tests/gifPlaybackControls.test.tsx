import { MIME_TYPES } from "@excalidraw/common";

import type { ExcalidrawImageElement, FileId } from "@excalidraw/element/types";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import {
  act,
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
} from "./test-utils";

import type { DataURL } from "../types";

// MyOC: the GIF controls sit under the on-screen bottom edge of the image, at
// its on-screen centre, for every viewport flip.

const { h } = window;

const GIF = "gif-file" as FileId;
const WIDTH = 1200;
const HEIGHT = 900;

const addGifFile = (gifDecodeStatus?: "deferred") => {
  act(() => {
    h.app.api.addFiles([
      {
        id: GIF,
        fileName: "a.gif",
        mimeType: MIME_TYPES.gif,
        dataURL: "data:image/gif;base64,AAAA" as DataURL,
        created: Date.now(),
      },
    ]);
  });
  // addFiles starts an image load. Replace its cache entry with a decoded
  // two frame GIF, or a deferred one.
  h.app.imageCache.set(
    GIF,
    gifDecodeStatus
      ? { image: new Image(), mimeType: MIME_TYPES.gif, gifDecodeStatus }
      : {
          image: new Image(),
          mimeType: MIME_TYPES.gif,
          gif: {
            frames: [
              document.createElement("canvas"),
              document.createElement("canvas"),
            ],
            delays: [50, 50],
            width: 200,
            height: 150,
          },
        },
  );
};

/** a 200 by 150 GIF at (200, 300) */
const gifSetup = async (
  opts: {
    angle?: number;
    gifDecodeStatus?: "deferred";
    viewpointFlip?: { horizontal: boolean; vertical: boolean };
  } = {},
) => {
  await render(<Excalidraw handleKeyboardGlobally={true} />);
  const gif = API.createElement({
    type: "image",
    id: "gif-el",
    fileId: GIF,
    x: 200,
    y: 300,
    width: 200,
    height: 150,
    angle: opts.angle ?? 0,
    status: "saved",
  } as any) as unknown as ExcalidrawImageElement;
  API.setElements([gif]);
  addGifFile(opts.gifDecodeStatus);
  API.setSelectedElements([gif as any]);
  act(() =>
    API.setAppState({
      scrollX: 0,
      scrollY: 0,
      zoom: { value: 1 as any },
      viewpointFlip: opts.viewpointFlip ?? {
        horizontal: false,
        vertical: false,
      },
    }),
  );
};

const barStyle = () => {
  const bar = document.querySelector<HTMLElement>(
    ".gif-playback-controls:not(.gif-playback-controls--deferred)",
  );
  expect(bar).not.toBeNull();
  return { left: parseFloat(bar!.style.left), top: parseFloat(bar!.style.top) };
};

const loadLargeStyle = () => {
  const wrapper = document.querySelector<HTMLElement>(
    ".gif-playback-controls--deferred",
  );
  expect(wrapper).not.toBeNull();
  return {
    left: parseFloat(wrapper!.style.left),
    top: parseFloat(wrapper!.style.top),
  };
};

describe("GIF playback controls position", () => {
  beforeAll(() => {
    mockBoundingClientRect({ width: WIDTH, height: HEIGHT });
  });

  afterAll(() => {
    restoreOriginalGetBoundingClientRect();
  });

  // the scene box x 200..400, y 300..450 on screen (zoom 1, no scroll)
  it.each([
    ["no", { horizontal: false, vertical: false }, 300, 450],
    ["a horizontal", { horizontal: true, vertical: false }, WIDTH - 300, 450],
    ["a vertical", { horizontal: false, vertical: true }, 300, HEIGHT - 300],
    [
      "a horizontal and vertical",
      { horizontal: true, vertical: true },
      WIDTH - 300,
      HEIGHT - 300,
    ],
  ])(
    "puts the bar under the on-screen bottom edge for %s viewport flip",
    async (_, viewpointFlip, centreX, bottom) => {
      await gifSetup({ viewpointFlip });
      expect(h.state.width).toBe(WIDTH);
      expect(h.state.height).toBe(HEIGHT);
      const { left, top } = barStyle();
      expect(left).toBeCloseTo(centreX);
      expect(top).toBeCloseTo(bottom + 16);
    },
  );

  it("puts the bar under the on-screen bottom edge of a rotated GIF for a vertical viewport flip", async () => {
    // a quarter turn about the centre (300, 375): the bounds are
    // x 225..375, y 275..475 in scene space. The scene top edge (y 275) is
    // the on-screen bottom edge.
    await gifSetup({
      angle: Math.PI / 2,
      viewpointFlip: { horizontal: false, vertical: true },
    });
    const { left, top } = barStyle();
    expect(left).toBeCloseTo(300);
    expect(top).toBeCloseTo(HEIGHT - 275 + 16);
  });

  it.each([
    ["no", { horizontal: false, vertical: false }, 400, 450],
    ["a horizontal", { horizontal: true, vertical: false }, WIDTH - 200, 450],
    ["a vertical", { horizontal: false, vertical: true }, 400, HEIGHT - 300],
    [
      "a horizontal and vertical",
      { horizontal: true, vertical: true },
      WIDTH - 200,
      HEIGHT - 300,
    ],
  ])(
    "puts the Load Large GIF button at the on-screen bottom-right corner for %s viewport flip",
    async (_, viewpointFlip, right, bottom) => {
      await gifSetup({ viewpointFlip, gifDecodeStatus: "deferred" });
      const { left, top } = loadLargeStyle();
      expect(left).toBeCloseTo(right);
      expect(top).toBeCloseTo(bottom);
    },
  );
});
