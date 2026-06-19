import { MIME_TYPES, randomId, reseed } from "@excalidraw/common";

import type { FileId } from "@excalidraw/element/types";

import * as blobModule from "../data/blob";
import * as filesystemModule from "../data/filesystem";
import { Excalidraw } from "../index";
import { createPasteEvent } from "../clipboard";

import { API } from "./helpers/api";
import { mockMultipleHTMLImageElements } from "./helpers/mocks";
import { UI } from "./helpers/ui";
import { act, GlobalTestState, render, waitFor } from "./test-utils";
import {
  DEER_IMAGE_DIMENSIONS,
  SMILEY_IMAGE_DIMENSIONS,
} from "./fixtures/constants";
import { INITIALIZED_IMAGE_PROPS } from "./helpers/constants";

import type { ExcalidrawProps } from "../types";

const { h } = window;

export const setupImageTest = async (
  sizes: { width: number; height: number }[],
  props: Partial<ExcalidrawProps> = {},
) => {
  await render(
    <Excalidraw
      compressImageFile={async (file: File) => file}
      autoFocus={true}
      handleKeyboardGlobally={true}
      {...props}
    />,
  );

  h.state.height = 1000;

  mockMultipleHTMLImageElements(sizes.map((size) => [size.width, size.height]));
};

describe("resizeImageFile", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the original file when it already fits the max dimensions", async () => {
    mockMultipleHTMLImageElements([[100, 100]]);

    const imageFile = new File([new Uint8Array([1, 2, 3])], "image.png", {
      type: MIME_TYPES.png,
    });

    await expect(
      blobModule.resizeImageFile(imageFile, { maxWidthOrHeight: 200 }),
    ).resolves.toBe(imageFile);
  });
});

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

  it("defaults placeholder transitions to 300ms", async () => {
    await setup();
    expect(h.app.props.imageOptions.placeholderTransitionDuration).toBe(300);
  });

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

  it("preserves the original file name on the initialized image element", async () => {
    await setupImageTest([DEER_IMAGE_DIMENSIONS]);

    await API.drop([
      { kind: "file", file: await API.loadFile("./fixtures/deer.png") },
    ]);

    await waitFor(() => {
      expect(h.elements).toEqual([
        expect.objectContaining({
          ...INITIALIZED_IMAGE_PROPS,
          ...DEER_IMAGE_DIMENSIONS,
          fileName: "deer.png",
          thumbHash: expect.any(String),
        }),
      ]);
    });

    const imageElement = h.elements[0];
    if (imageElement.type !== "image" || !imageElement.fileId) {
      throw new Error("Expected an initialized image element");
    }
    expect(h.app.files[imageElement.fileId].thumbHash).toBe(
      imageElement.thumbHash,
    );
  });

  it("stores image loading progress outside app state and suppresses unchanged values", async () => {
    await setup();

    const fileId = "progress-file" as FileId;
    const progressListener = vi.fn();
    const onChange = vi.fn();
    const unsubscribeProgress =
      h.app.imageLoadingProgressEmitter.on(progressListener);
    const unsubscribeChange = h.app.api.onChange(onChange);

    h.app.api.setImageLoadingProgress(fileId, 0.25);
    h.app.api.setImageLoadingProgress(fileId, 0.25);
    expect(h.app.imageLoadingProgress.get(fileId)).toBe(0.25);
    expect(progressListener).toHaveBeenCalledTimes(1);

    h.app.api.setImageLoadingProgress(fileId, 2);
    expect(h.app.imageLoadingProgress.get(fileId)).toBe(1);
    expect(progressListener).toHaveBeenCalledTimes(2);

    h.app.api.setImageLoadingProgress(fileId, null);
    expect(h.app.imageLoadingProgress.has(fileId)).toBe(false);
    expect(progressListener).toHaveBeenCalledTimes(3);
    expect(onChange).not.toHaveBeenCalled();

    unsubscribeProgress();
    unsubscribeChange();
  });

  it("keeps temporary image placeholders out of files and replaces them with canonical files", async () => {
    await setupImageTest(
      [
        { width: 32, height: 32 },
        { width: 64, height: 64 },
      ],
      { imageOptions: { placeholderTransitionDuration: 10_000 } },
    );

    const fileId = "placeholder-file" as FileId;
    API.setElements([
      API.createElement({
        type: "image",
        fileId,
        width: 100,
        height: 100,
      }),
    ]);
    const file = await API.loadFile("./fixtures/deer.png");
    const onChange = vi.fn();
    const unsubscribeChange = h.app.api.onChange(onChange);

    await h.app.api.addImagePlaceholder(fileId, file);
    const temporaryImage = h.app.imageCache.get(fileId)?.image;
    expect(temporaryImage).toBeInstanceOf(HTMLImageElement);
    expect(h.app.api.getFiles()[fileId]).toBeUndefined();
    expect(onChange).not.toHaveBeenCalled();
    unsubscribeChange();

    h.app.api.setImageLoadingProgress(fileId, 1);
    const fileDataURL = await blobModule.getDataURL(file);
    act(() => {
      h.app.api.addFiles([
        {
          id: fileId,
          fileName: file.name,
          mimeType: MIME_TYPES.png,
          dataURL: fileDataURL,
          created: Date.now(),
        },
      ]);
    });

    await waitFor(() => {
      expect(h.app.api.getFiles()[fileId]).toBeDefined();
      expect(h.app.imageCache.get(fileId)?.image).toBeInstanceOf(
        HTMLImageElement,
      );
      expect(h.app.imageCache.get(fileId)?.image).not.toBe(temporaryImage);
      expect(h.app.imageCache.get(fileId)?.placeholderImage).toBe(
        temporaryImage,
      );
      expect(h.app.imageCache.get(fileId)?.transitionStart).toEqual(
        expect.any(Number),
      );
      expect(h.app.imageLoadingProgress.has(fileId)).toBe(false);
    });
  });

  it("should use the provided image compressor for oversized images", async () => {
    const compressedFile = new File(["compressed"], "large.png", {
      type: MIME_TYPES.png,
    });
    const compressImageFile = vi.fn(async () => compressedFile);
    await setupImageTest([DEER_IMAGE_DIMENSIONS], { compressImageFile });
    h.state.dontResizeLimitMBs = 0;

    const largeFile = await API.loadFile("./fixtures/deer.png");

    await API.drop([{ kind: "file", file: largeFile }]);

    await waitFor(() => {
      expect(compressImageFile).toHaveBeenCalledWith(
        largeFile,
        expect.objectContaining({ maxWidthOrHeight: expect.any(Number) }),
      );
    });
    await waitFor(() => {
      expect(h.elements).toEqual([
        expect.objectContaining({
          ...INITIALIZED_IMAGE_PROPS,
          ...DEER_IMAGE_DIMENSIONS,
          fileName: "large-resized.png",
        }),
      ]);
    });
    expect(blobModule.resizeImageFile).not.toHaveBeenCalled();
  });

  it("passes host-configured max image dimensions to the image compressor", async () => {
    const compressImageFile = vi.fn(async (file: File) => file);
    await setupImageTest([DEER_IMAGE_DIMENSIONS], {
      compressImageFile,
      imageOptions: { maxWidthOrHeight: 2048 },
    });
    h.state.dontResizeLimitMBs = 0;

    await API.drop([
      { kind: "file", file: await API.loadFile("./fixtures/deer.png") },
    ]);

    await waitFor(() => {
      expect(compressImageFile).toHaveBeenCalledWith(expect.any(File), {
        maxWidthOrHeight: 2048,
      });
    });
    expect(blobModule.resizeImageFile).not.toHaveBeenCalled();
  });

  it("enforces host-configured max image file size", async () => {
    await setupImageTest([DEER_IMAGE_DIMENSIONS], {
      imageOptions: { maxFileSizeBytes: 1024 * 1024 },
    });

    await API.drop([
      {
        kind: "file",
        file: new File([new Uint8Array(2 * 1024 * 1024)], "image.png", {
          type: MIME_TYPES.png,
        }),
      },
    ]);

    await waitFor(() => {
      expect(h.state.errorMessage).toBe(
        "File is too big. Maximum allowed size is 1MB.",
      );
    });
  });
});
