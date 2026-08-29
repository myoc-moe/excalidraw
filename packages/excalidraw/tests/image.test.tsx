import {
  MIME_TYPES,
  randomId,
  reseed,
  sceneCoordsToViewportCoords,
} from "@excalidraw/common";

import type { FileId } from "@excalidraw/element/types";

import * as blobModule from "../data/blob";
import * as filesystemModule from "../data/filesystem";
import { Excalidraw } from "../index";
import { createPasteEvent } from "../clipboard";

import { API } from "./helpers/api";
import { mockMultipleHTMLImageElements } from "./helpers/mocks";
import { UI } from "./helpers/ui";
import { act, fireEvent, GlobalTestState, render, waitFor } from "./test-utils";
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

  it("stores dropped text/uri-list url in image custom data", async () => {
    await setupImageTest([DEER_IMAGE_DIMENSIONS]);

    const url = "https://example.com/image.jpg";

    await API.drop([
      {
        kind: "string",
        type: "text/uri-list",
        value: `# source image\n${url}`,
      },
      { kind: "file", file: await API.loadFile("./fixtures/deer.png") },
    ]);

    await waitFor(() => {
      expect(h.elements[0]).toEqual(
        expect.objectContaining({
          customData: expect.objectContaining({
            src: url,
            rawDragData: expect.objectContaining({
              types: expect.arrayContaining(["text/uri-list", "Files"]),
              data: expect.objectContaining({
                "text/uri-list": `# source image\n${url}`,
              }),
              parsedItems: expect.arrayContaining([
                {
                  kind: "string",
                  type: "text/uri-list",
                  value: `# source image\n${url}`,
                },
                expect.objectContaining({
                  kind: "file",
                  type: MIME_TYPES.png,
                  file: expect.objectContaining({
                    name: "deer.png",
                    type: MIME_TYPES.png,
                  }),
                }),
              ]),
            }),
          }),
        }),
      );
    });
  });

  it("MyOC regression: preserves API image custom data", async () => {
    await setupImageTest([DEER_IMAGE_DIMENSIONS]);

    const customData = {
      capturedAt: "2026-08-29T12:00:00.000Z",
      sourceUrl: "https://example.com/image.png",
      extensionUrlRuleId: "example-rule",
    };

    await act(async () => {
      await h.app.api.addImageElementsToScene(
        [{ file: await API.loadFile("./fixtures/deer.png"), customData }],
        100,
        100,
      );
    });

    await waitFor(() => {
      expect(h.elements).toEqual([
        expect.objectContaining({
          ...INITIALIZED_IMAGE_PROPS,
          ...DEER_IMAGE_DIMENSIONS,
          customData,
        }),
      ]);
    });
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

  it("MyOC regression: exits view mode and inserts pasted images by default", async () => {
    await setupImageTest([DEER_IMAGE_DIMENSIONS]);
    API.setAppState({ viewModeEnabled: true });

    document.dispatchEvent(
      createPasteEvent({
        files: [await API.loadFile("./fixtures/deer.png")],
      }),
    );

    await waitFor(() => {
      expect(h.state.viewModeEnabled).toBe(false);
      expect(h.elements).toEqual([
        expect.objectContaining({
          ...INITIALIZED_IMAGE_PROPS,
          ...DEER_IMAGE_DIMENSIONS,
        }),
      ]);
    });
  });

  it("MyOC regression: can reject image paste in view mode and notify the host", async () => {
    const onViewModeImageInsertRejected = vi.fn();
    await setupImageTest([DEER_IMAGE_DIMENSIONS], {
      viewModeEnabled: true,
      viewModeImageInsertBehavior: "reject",
      onViewModeImageInsertRejected,
    });

    const file = await API.loadFile("./fixtures/deer.png");
    document.dispatchEvent(
      createPasteEvent({
        files: [file],
      }),
    );

    await waitFor(() => {
      expect(onViewModeImageInsertRejected).toHaveBeenCalledTimes(1);
    });
    expect(onViewModeImageInsertRejected).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "paste",
        files: [file],
      }),
    );
    expect(h.state.viewModeEnabled).toBe(true);
    expect(h.elements).toEqual([]);
  });

  it("MyOC regression: rejects image paste when viewModeOnly forces view mode", async () => {
    const onViewModeImageInsertRejected = vi.fn();
    await setupImageTest([DEER_IMAGE_DIMENSIONS], {
      viewModeOnly: true,
      onViewModeImageInsertRejected,
    });

    document.dispatchEvent(
      createPasteEvent({
        files: [await API.loadFile("./fixtures/deer.png")],
      }),
    );

    await waitFor(() => {
      expect(onViewModeImageInsertRejected).toHaveBeenCalledTimes(1);
    });
    expect(h.state.viewModeEnabled).toBe(true);
    expect(h.elements).toEqual([]);
  });

  it("MyOC regression: exits view mode and inserts dropped images by default", async () => {
    await setupImageTest([DEER_IMAGE_DIMENSIONS]);
    API.setAppState({ viewModeEnabled: true });

    expect(fireEvent.dragOver(GlobalTestState.interactiveCanvas)).toBe(false);

    await API.drop([
      { kind: "file", file: await API.loadFile("./fixtures/deer.png") },
    ]);

    await waitFor(() => {
      expect(h.state.viewModeEnabled).toBe(false);
      expect(h.elements).toEqual([
        expect.objectContaining({
          ...INITIALIZED_IMAGE_PROPS,
          ...DEER_IMAGE_DIMENSIONS,
        }),
      ]);
    });
  });

  it("MyOC regression: can reject image drop in view mode and notify the host", async () => {
    const onViewModeImageInsertRejected = vi.fn();
    await setupImageTest([DEER_IMAGE_DIMENSIONS], {
      viewModeEnabled: true,
      viewModeImageInsertBehavior: "reject",
      onViewModeImageInsertRejected,
    });

    const file = await API.loadFile("./fixtures/deer.png");
    await API.drop([{ kind: "file", file }]);

    await waitFor(() => {
      expect(onViewModeImageInsertRejected).toHaveBeenCalledTimes(1);
    });
    expect(onViewModeImageInsertRejected).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "drop",
        files: [file],
      }),
    );
    expect(h.state.viewModeEnabled).toBe(true);
    expect(h.elements).toEqual([]);
  });

  it("MyOC regression: rejects image drop when viewModeOnly forces view mode", async () => {
    const onViewModeImageInsertRejected = vi.fn();
    await setupImageTest([DEER_IMAGE_DIMENSIONS], {
      viewModeOnly: true,
      onViewModeImageInsertRejected,
    });

    await API.drop([
      { kind: "file", file: await API.loadFile("./fixtures/deer.png") },
    ]);

    await waitFor(() => {
      expect(onViewModeImageInsertRejected).toHaveBeenCalledTimes(1);
    });
    expect(h.state.viewModeEnabled).toBe(true);
    expect(h.elements).toEqual([]);
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

  it("stores download progress outside app state and suppresses unchanged values", async () => {
    await setup();

    const fileId = "progress-file" as FileId;
    const progressListener = vi.fn();
    const onChange = vi.fn();
    const unsubscribeProgress =
      h.app.imageLoadingProgressEmitter.on(progressListener);
    const unsubscribeChange = h.app.api.onChange(onChange);

    h.app.api.setDownloadProgress(fileId, 0.25);
    h.app.api.setDownloadProgress(fileId, 0.25);
    expect(h.app.imageLoadingProgress.get(fileId)).toBe(0.25);
    expect(progressListener).toHaveBeenCalledTimes(1);

    h.app.api.setDownloadProgress(fileId, 2);
    expect(h.app.imageLoadingProgress.get(fileId)).toBe(1);
    expect(progressListener).toHaveBeenCalledTimes(2);

    h.app.api.setDownloadProgress(fileId, null);
    expect(h.app.imageLoadingProgress.has(fileId)).toBe(false);
    expect(progressListener).toHaveBeenCalledTimes(3);
    expect(onChange).not.toHaveBeenCalled();

    unsubscribeProgress();
    unsubscribeChange();
  });

  it("stores download error and upload status outside app state", async () => {
    await setup();

    const fileId = "status-file" as FileId;
    const statusListener = vi.fn();
    const onChange = vi.fn();
    const uploadAction = vi.fn();
    const errorAction = vi.fn();
    const unsubscribeStatus = h.app.imageStatusEmitter.on(statusListener);
    const unsubscribeChange = h.app.api.onChange(onChange);

    h.app.api.setDownloadError(fileId, {
      onClick: errorAction,
      backgroundColor: "#ff0000",
      color: "#ffffff",
      text: "Image failed",
    });
    h.app.api.setDownloadError(fileId, {
      onClick: errorAction,
      backgroundColor: "#ff0000",
      color: "#ffffff",
      text: "Image failed",
    });
    expect(h.app.imageStatus.get(fileId)?.downloadError).toEqual({
      onClick: errorAction,
      backgroundColor: "#ff0000",
      color: "#ffffff",
      text: "Image failed",
    });
    expect(statusListener).toHaveBeenCalledTimes(1);

    h.app.api.setUploadProgress(fileId, 0.25, {
      onClick: uploadAction,
      color: "#00ff00",
      trackColor: "#000000",
    });
    h.app.api.setUploadProgress(fileId, 0.25);
    expect(h.app.imageStatus.get(fileId)?.uploadProgress).toEqual({
      progress: 0.25,
      state: "uploading",
      onClick: uploadAction,
      color: "#00ff00",
      trackColor: "#000000",
    });
    expect(statusListener).toHaveBeenCalledTimes(2);

    h.app.api.setUploadProgress(fileId, 2);
    expect(h.app.imageStatus.get(fileId)?.uploadProgress?.progress).toBe(1);
    expect(statusListener).toHaveBeenCalledTimes(3);

    h.app.api.setUploadProgress(fileId, null);
    expect(h.app.imageStatus.get(fileId)?.uploadProgress).toBeNull();
    expect(statusListener).toHaveBeenCalledTimes(4);

    h.app.api.setUploadProgress(fileId, "pending");
    expect(h.app.imageStatus.get(fileId)?.uploadProgress).toEqual({
      state: "pending",
      progress: undefined,
    });
    expect(statusListener).toHaveBeenCalledTimes(5);

    h.app.api.setUploadProgress(fileId, "error", {
      text: "Cloud sync failed",
    });
    expect(h.app.imageStatus.get(fileId)?.uploadProgress).toEqual({
      state: "error",
      progress: undefined,
      text: "Cloud sync failed",
    });
    expect(statusListener).toHaveBeenCalledTimes(6);

    h.app.api.setUploadProgress(fileId, "error");
    expect(h.app.imageStatus.get(fileId)?.uploadProgress).toEqual({
      state: "error",
      progress: undefined,
      text: "Cloud sync failed",
    });
    expect(statusListener).toHaveBeenCalledTimes(6);

    h.app.api.setDownloadError(fileId, null);
    expect(h.app.imageStatus.get(fileId)).toEqual({
      downloadError: null,
      uploadProgress: {
        state: "error",
        progress: undefined,
        text: "Cloud sync failed",
      },
    });
    expect(statusListener).toHaveBeenCalledTimes(7);

    h.app.api.setUploadProgress(fileId, null);
    expect(h.app.imageStatus.get(fileId)).toEqual({
      downloadError: null,
      uploadProgress: null,
    });
    expect(statusListener).toHaveBeenCalledTimes(8);

    h.app.api.setDownloadError(fileId, {
      text: "Image failed again",
    });
    expect(h.app.imageStatus.get(fileId)).toEqual({
      downloadError: {
        text: "Image failed again",
      },
      uploadProgress: null,
    });
    expect(statusListener).toHaveBeenCalledTimes(9);

    h.app.api.setUploadProgress(fileId, "error", {
      text: "Cloud sync failed again",
    });
    expect(h.app.imageStatus.get(fileId)).toEqual({
      downloadError: {
        text: "Image failed again",
      },
      uploadProgress: {
        state: "error",
        progress: undefined,
        text: "Cloud sync failed again",
      },
    });
    expect(statusListener).toHaveBeenCalledTimes(10);

    h.app.api.setUploadProgress(fileId, null);
    expect(h.app.imageStatus.get(fileId)).toEqual({
      downloadError: {
        text: "Image failed again",
      },
      uploadProgress: null,
    });
    expect(statusListener).toHaveBeenCalledTimes(11);
    expect(onChange).not.toHaveBeenCalled();

    unsubscribeStatus();
    unsubscribeChange();
  });

  it("runs image status actions from canvas clicks", async () => {
    await setup();

    const fileId = "action-file" as FileId;
    const uploadAction = vi.fn();
    API.setElements([
      API.createElement({
        type: "image",
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        fileId,
      }),
    ]);

    h.app.api.setUploadProgress(fileId, 0.5, {
      onClick: uploadAction,
    });

    const { x: clientX, y: clientY } = sceneCoordsToViewportCoords(
      { sceneX: 185, sceneY: 115 },
      h.state,
    );

    fireEvent.click(GlobalTestState.interactiveCanvas, {
      button: 0,
      clientX,
      clientY,
    });

    expect(uploadAction).toHaveBeenCalledWith(fileId);

    const uploadStatusAction = vi.fn();
    h.app.api.setUploadProgress(fileId, "error", {
      text: "Cloud sync failed",
      onClick: uploadStatusAction,
    });

    fireEvent.click(GlobalTestState.interactiveCanvas, {
      button: 0,
      clientX,
      clientY,
    });

    expect(uploadStatusAction).toHaveBeenCalledWith(fileId);
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

    h.app.api.setDownloadProgress(fileId, 1);
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
          fileName: "large.png",
        }),
      ]);
    });
    expect(blobModule.resizeImageFile).not.toHaveBeenCalled();
  });

  it("MyOC regression: generates image ids from compressed raster bytes", async () => {
    const compressedFile = new File(["compressed"], "compressed.png", {
      type: MIME_TYPES.png,
    });
    const calls: string[] = [];
    let fileReceivedByIdGenerator: File | null = null;
    const compressedFileId = "compressed-file-id" as FileId;
    const compressImageFile = vi.fn(async () => {
      calls.push("compress");
      return compressedFile;
    });
    const generateIdForFile = vi.fn(async (file: File) => {
      calls.push("generateId");
      fileReceivedByIdGenerator = file;
      return compressedFileId;
    });
    await setupImageTest([DEER_IMAGE_DIMENSIONS], {
      compressImageFile,
      generateIdForFile,
    });

    const originalFile = new File(["original"], "original.png", {
      type: MIME_TYPES.png,
    });

    await API.drop([{ kind: "file", file: originalFile }]);

    await waitFor(() => {
      expect(h.elements[0]).toEqual(
        expect.objectContaining({
          fileId: compressedFileId,
        }),
      );
    });

    expect(calls).toEqual(["compress", "generateId"]);
    expect(compressImageFile).toHaveBeenCalledWith(
      originalFile,
      expect.objectContaining({ maxWidthOrHeight: expect.any(Number) }),
    );
    expect(generateIdForFile).toHaveBeenCalledWith(compressedFile);
    expect(fileReceivedByIdGenerator).toBe(compressedFile);

    const fileData = h.app.api.getFiles()[compressedFileId];
    expect(fileData.id).toBe(compressedFileId);
    const encodedBytes = fileData.dataURL.split(",")[1];
    expect(atob(encodedBytes)).toBe("compressed");
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
