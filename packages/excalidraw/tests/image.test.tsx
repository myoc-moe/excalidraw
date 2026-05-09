import { MIME_TYPES, randomId, reseed } from "@excalidraw/common";

import type { FileId } from "@excalidraw/element/types";

import * as blobModule from "../data/blob";
import * as filesystemModule from "../data/filesystem";
import { Excalidraw } from "../index";
import { createPasteEvent } from "../clipboard";

import { API } from "./helpers/api";
import { mockMultipleHTMLImageElements } from "./helpers/mocks";
import { UI } from "./helpers/ui";
import { GlobalTestState, render, waitFor } from "./test-utils";
import {
  DEER_IMAGE_DIMENSIONS,
  SMILEY_IMAGE_DIMENSIONS,
} from "./fixtures/constants";
import { INITIALIZED_IMAGE_PROPS } from "./helpers/constants";

const { h } = window;

export const setupImageTest = async (
  sizes: { width: number; height: number }[],
  compressImageFile = async (file: File) => file,
) => {
  await render(
    <Excalidraw
      compressImageFile={compressImageFile}
      autoFocus={true}
      handleKeyboardGlobally={true}
    />,
  );

  h.state.height = 1000;

  mockMultipleHTMLImageElements(sizes.map((size) => [size.width, size.height]));
};

describe("image insertion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();

    reseed(7);

    const generateIdSpy = vi.spyOn(blobModule, "generateIdFromFile");
    const resizeFileSpy = vi.spyOn(blobModule, "resizeImageFile");

    generateIdSpy.mockImplementation(() =>
      Promise.resolve(randomId() as FileId),
    );
    resizeFileSpy.mockImplementation((file: File) => Promise.resolve(file));

    Object.assign(document, {
      elementFromPoint: () => GlobalTestState.canvas,
    });
  });

  const setup = () =>
    setupImageTest([DEER_IMAGE_DIMENSIONS, SMILEY_IMAGE_DIMENSIONS]);

  const assert = async () => {
    await waitFor(() => {
      expect(h.elements).toEqual([
        expect.objectContaining({
          ...INITIALIZED_IMAGE_PROPS,
          ...DEER_IMAGE_DIMENSIONS,
        }),
        expect.objectContaining({
          ...INITIALIZED_IMAGE_PROPS,
          ...SMILEY_IMAGE_DIMENSIONS,
        }),
      ]);
    });
    // Not placed on top of each other
    const dimensionsSet = new Set(h.elements.map((el) => `${el.x}-${el.y}`));
    expect(dimensionsSet.size).toEqual(h.elements.length);
  };

  it("should eventually initialize all dropped images", async () => {
    await setup();

    const files = await Promise.all([
      API.loadFile("./fixtures/deer.png"),
      API.loadFile("./fixtures/smiley.png"),
    ]);
    await API.drop(files.map((file) => ({ kind: "file", file })));

    await assert();
  });

  it("should eventually initialize all pasted images", async () => {
    await setup();

    document.dispatchEvent(
      createPasteEvent({
        files: await Promise.all([
          API.loadFile("./fixtures/deer.png"),
          API.loadFile("./fixtures/smiley.png"),
        ]),
      }),
    );

    await assert();
  });

  it("should eventually initialize all images added through image tool", async () => {
    await setup();

    const fileOpenSpy = vi.spyOn(filesystemModule, "fileOpen");
    fileOpenSpy.mockImplementation(
      async () =>
        await Promise.all([
          API.loadFile("./fixtures/deer.png"),
          API.loadFile("./fixtures/smiley.png"),
        ]),
    );
    UI.clickTool("image");

    await assert();
  });

  it("should use the provided image compressor for oversized images", async () => {
    const compressedFile = new File(["compressed"], "large.png", {
      type: MIME_TYPES.png,
    });
    const compressImageFile = vi.fn(async () => compressedFile);
    await setupImageTest([DEER_IMAGE_DIMENSIONS], compressImageFile);
    h.state.dontResizeLimitMBs = 0;

    const largeFile = await API.loadFile("./fixtures/deer.png");

    await API.drop([{ kind: "file", file: largeFile }]);

    await waitFor(() => {
      expect(compressImageFile).toHaveBeenCalledWith(
        largeFile,
        expect.objectContaining({ maxWidthOrHeight: expect.any(Number) }),
      );
    });
    expect(blobModule.resizeImageFile).not.toHaveBeenCalled();
  });
});
