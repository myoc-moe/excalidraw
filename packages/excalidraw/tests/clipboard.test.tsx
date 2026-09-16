import React from "react";
import { vi } from "vitest";

import { getLineHeightInPx } from "@excalidraw/element";

import {
  KEYS,
  MIME_TYPES,
  arrayToMap,
  getLineHeight,
} from "@excalidraw/common";

import { getElementBounds } from "@excalidraw/element";

import {
  copyToClipboard,
  createPasteEvent,
  serializeAsClipboardJSON,
} from "../clipboard";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Pointer, Keyboard } from "./helpers/ui";
import {
  render,
  waitFor,
  GlobalTestState,
  unmountComponent,
} from "./test-utils";

import type { DataURL, NormalizedZoomValue } from "../types";

const { h } = window;

const mouse = new Pointer("mouse");

vi.mock("@excalidraw/common", async (importOriginal) => {
  const module = await importOriginal<typeof import("@excalidraw/common")>();
  const { mockThrottleRAF } = await import("./helpers/mocks");

  return {
    __esmodule: true,
    ...module,
    isDarwin: false,
    KEYS: {
      ...module.KEYS,
      CTRL_OR_CMD: "ctrlKey",
    },
    throttleRAF: mockThrottleRAF,
  };
});

const sendPasteEvent = (text: string) => {
  const clipboardEvent = createPasteEvent({
    types: {
      "text/plain": text,
    },
  });
  document.dispatchEvent(clipboardEvent);
};

const pasteWithCtrlCmdShiftV = (text: string) => {
  Keyboard.withModifierKeys({ ctrl: true, shift: true }, () => {
    //triggering keydown with an empty clipboard
    Keyboard.keyPress(KEYS.V);
    //triggering paste event with faked clipboard
    sendPasteEvent(text);
  });
};

const pasteWithCtrlCmdV = (text: string) => {
  Keyboard.withModifierKeys({ ctrl: true }, () => {
    //triggering keydown with an empty clipboard
    Keyboard.keyPress(KEYS.V);
    //triggering paste event with faked clipboard
    sendPasteEvent(text);
  });
};

const sleep = (ms: number) => {
  return new Promise((resolve) => setTimeout(() => resolve(null), ms));
};

beforeEach(async () => {
  unmountComponent();

  localStorage.clear();

  mouse.reset();

  await render(
    <Excalidraw
      compressImageFile={async (file) => file}
      autoFocus={true}
      handleKeyboardGlobally={true}
      initialData={{ appState: { zoom: { value: 1 as NormalizedZoomValue } } }}
    />,
  );
  Object.assign(document, {
    elementFromPoint: () => GlobalTestState.canvas,
  });
});

describe("general paste behavior", () => {
  it("should randomize seed on paste", async () => {
    const rectangle = API.createElement({ type: "rectangle" });
    const clipboardJSON = await serializeAsClipboardJSON({
      elements: [rectangle],
      files: null,
    });
    pasteWithCtrlCmdV(clipboardJSON);

    await waitFor(() => {
      expect(h.elements.length).toBe(1);
      expect(h.elements[0].seed).not.toBe(rectangle.seed);
    });
  });

  it("should retain seed on shift-paste", async () => {
    const rectangle = API.createElement({ type: "rectangle" });
    const clipboardJSON = await serializeAsClipboardJSON({
      elements: [rectangle],
      files: null,
    });

    // assert we don't randomize seed on shift-paste
    pasteWithCtrlCmdShiftV(clipboardJSON);
    await waitFor(() => {
      expect(h.elements.length).toBe(1);
      expect(h.elements[0].seed).toBe(rectangle.seed);
    });
  });
});

describe("copy behavior", () => {
  it("MyOC regression: copies a selected image as a file while retaining Excalidraw JSON", async () => {
    const image = API.createElement({
      type: "image",
      fileId: "image-file-id",
      fileName: "original.png",
      status: "saved",
    });
    const files = {
      [image.fileId!]: {
        id: image.fileId!,
        mimeType: MIME_TYPES.png,
        fileName: "original.png",
        dataURL: "data:image/png;base64,AA==" as DataURL,
        created: Date.now(),
      },
    };
    const event = createPasteEvent({ files: [] });
    const clipboardWrite = vi.fn().mockResolvedValue(undefined);
    let clipboardItemData: Record<string, Blob | PromiseLike<Blob>> | undefined;
    const clipboardDescriptor = Object.getOwnPropertyDescriptor(
      navigator,
      "clipboard",
    );
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { write: clipboardWrite },
    });
    vi.stubGlobal(
      "ClipboardItem",
      class {
        constructor(data: Record<string, Blob | PromiseLike<Blob>>) {
          clipboardItemData = data;
        }
      } as unknown as typeof ClipboardItem,
    );

    try {
      await copyToClipboard([image], files, event);
    } finally {
      vi.unstubAllGlobals();
      if (clipboardDescriptor) {
        Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
      } else {
        Reflect.deleteProperty(navigator, "clipboard");
      }
    }

    const json = serializeAsClipboardJSON({ elements: [image], files });
    expect(clipboardWrite).toHaveBeenCalledTimes(1);
    expect(clipboardItemData).toBeDefined();
    expect(clipboardItemData?.[MIME_TYPES.png]).toBeInstanceOf(File);
    const excalidrawBlob = clipboardItemData?.[
      `web ${MIME_TYPES.excalidrawClipboard}`
    ] as Blob;
    const clipboardJSON = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(excalidrawBlob);
    });
    expect(clipboardJSON).toBe(json);
    expect(event.clipboardData?.getData(MIME_TYPES.excalidrawClipboard)).toBe(
      "",
    );
    expect(event.clipboardData?.getData(MIME_TYPES.text)).toBe("");
    expect(event.clipboardData?.files).toHaveLength(0);
  });

  it("pastes Excalidraw JSON from the custom clipboard MIME type", async () => {
    const rectangle = API.createElement({ type: "rectangle" });
    const clipboardJSON = await serializeAsClipboardJSON({
      elements: [rectangle],
      files: null,
    });

    document.dispatchEvent(
      createPasteEvent({
        types: {
          [MIME_TYPES.excalidrawClipboard]: clipboardJSON,
        },
      }),
    );

    await waitFor(() => {
      expect(h.elements.length).toBe(1);
      expect(h.elements[0].type).toBe("rectangle");
    });
  });

  it("MyOC regression: preserves image rotation on Ctrl+V when the native event exposes only the image", async () => {
    const angle = Math.PI / 3;
    const image = API.createElement({
      type: "image",
      angle,
      fileId: "rotated-image-file-id",
      fileName: "rotated.png",
      status: "saved",
    });
    const files = {
      [image.fileId!]: {
        id: image.fileId!,
        mimeType: MIME_TYPES.png,
        fileName: "rotated.png",
        dataURL: "data:image/png;base64,AA==" as DataURL,
        created: Date.now(),
      },
    };
    const clipboardJSON = serializeAsClipboardJSON({
      elements: [image],
      files,
    });

    const clipboardDescriptor = Object.getOwnPropertyDescriptor(
      navigator,
      "clipboard",
    );
    const clipboardRead = vi.fn().mockResolvedValue([
      {
        types: [`web ${MIME_TYPES.excalidrawClipboard}`, MIME_TYPES.png],
        getType: vi.fn(async (type: string) =>
          type === `web ${MIME_TYPES.excalidrawClipboard}`
            ? { text: async () => clipboardJSON }
            : new Blob([new Uint8Array([0])], { type: MIME_TYPES.png }),
        ),
      },
    ]);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { read: clipboardRead },
    });

    try {
      document.dispatchEvent(
        createPasteEvent({
          files: [
            new File([new Uint8Array([0])], "image.png", {
              type: MIME_TYPES.png,
            }),
          ],
        }),
      );

      await waitFor(() => {
        expect(clipboardRead).toHaveBeenCalledTimes(1);
        expect(h.elements).toHaveLength(1);
        expect(h.elements[0].type).toBe("image");
        expect(h.elements[0].angle).toBe(angle);
      });
    } finally {
      if (clipboardDescriptor) {
        Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
      } else {
        Reflect.deleteProperty(navigator, "clipboard");
      }
    }
  });

  it("MyOC regression: does not add a file representation when copying multiple elements", async () => {
    const image = API.createElement({
      type: "image",
      fileId: "image-file-id",
      fileName: "original.png",
      status: "saved",
    });
    const rectangle = API.createElement({ type: "rectangle" });
    const files = {
      [image.fileId!]: {
        id: image.fileId!,
        mimeType: MIME_TYPES.png,
        fileName: "original.png",
        dataURL: "data:image/png;base64,AA==" as DataURL,
        created: Date.now(),
      },
    };
    const event = createPasteEvent({ files: [] });

    await copyToClipboard([image, rectangle], files, event);

    expect(event.clipboardData?.files).toHaveLength(0);
  });
});

describe("paste text as single lines", () => {
  it("should create an element for each line when copying with Ctrl/Cmd+V", async () => {
    const text = "sajgfakfn\naaksfnknas\nakefnkasf";
    pasteWithCtrlCmdV(text);
    await waitFor(() => {
      expect(h.elements.length).toEqual(text.split("\n").length);
    });
  });

  it("should ignore empty lines when creating an element for each line", async () => {
    const text = "\n\nsajgfakfn\n\n\naaksfnknas\n\nakefnkasf\n\n\n";
    pasteWithCtrlCmdV(text);
    await waitFor(() => {
      expect(h.elements.length).toEqual(3);
    });
  });

  it("should not create any element if clipboard has only new lines", async () => {
    const text = "\n\n\n\n\n";
    pasteWithCtrlCmdV(text);
    await waitFor(async () => {
      await sleep(50); // elements lenght will always be zero if we don't wait, since paste is async
      expect(h.elements.length).toEqual(0);
    });
  });

  it("should space items correctly", async () => {
    const elementsMap = arrayToMap(h.elements);

    const text = "hkhkjhki\njgkjhffjh\njgkjhffjh";
    const lineHeightPx =
      getLineHeightInPx(
        h.app.state.currentItemFontSize,
        getLineHeight(h.state.currentItemFontFamily),
      ) +
      10 / h.app.state.zoom.value;
    mouse.moveTo(100, 100);
    pasteWithCtrlCmdV(text);
    await waitFor(async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [fx, firstElY] = getElementBounds(h.elements[0], elementsMap);
      for (let i = 1; i < h.elements.length; i++) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const [fx, elY] = getElementBounds(h.elements[i], elementsMap);
        expect(elY).toEqual(firstElY + lineHeightPx * i);
      }
    });
  });

  it("should leave a space for blank new lines", async () => {
    const elementsMap = arrayToMap(h.elements);
    const text = "hkhkjhki\n\njgkjhffjh";
    const lineHeightPx =
      getLineHeightInPx(
        h.app.state.currentItemFontSize,
        getLineHeight(h.state.currentItemFontFamily),
      ) +
      10 / h.app.state.zoom.value;
    mouse.moveTo(100, 100);
    pasteWithCtrlCmdV(text);

    await waitFor(async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [fx, firstElY] = getElementBounds(h.elements[0], elementsMap);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [lx, lastElY] = getElementBounds(h.elements[1], elementsMap);
      expect(lastElY).toEqual(firstElY + lineHeightPx * 2);
    });
  });
});

describe("paste text as a single element", () => {
  it("should create single text element when copying text with Ctrl/Cmd+Shift+V", async () => {
    const text = "sajgfakfn\naaksfnknas\nakefnkasf";
    pasteWithCtrlCmdShiftV(text);
    await waitFor(() => {
      expect(h.elements.length).toEqual(1);
    });
  });
  it("should not create any element when only new lines in clipboard", async () => {
    const text = "\n\n\n\n";
    pasteWithCtrlCmdShiftV(text);
    await waitFor(async () => {
      await sleep(50);
      expect(h.elements.length).toEqual(0);
    });
  });
});

describe("Paste bound text container", () => {
  const container = {
    type: "ellipse",
    id: "container-id",
    x: 554.984375,
    y: 196.0234375,
    width: 166,
    height: 187.01953125,
    roundness: { type: 2 },
    boundElements: [{ type: "text", id: "text-id" }],
  };
  const textElement = {
    type: "text",
    id: "text-id",
    x: 560.51171875,
    y: 202.033203125,
    width: 154,
    height: 175,
    fontSize: 20,
    fontFamily: 1,
    text: "Excalidraw is a\nvirtual \nopensource \nwhiteboard for \nsketching \nhand-drawn like\ndiagrams",
    baseline: 168,
    textAlign: "center",
    verticalAlign: "middle",
    containerId: container.id,
    originalText:
      "Excalidraw is a virtual opensource whiteboard for sketching hand-drawn like diagrams",
  };

  it("should fix ellipse bounding box", async () => {
    const data = JSON.stringify({
      type: "excalidraw/clipboard",
      elements: [container, textElement],
    });
    pasteWithCtrlCmdShiftV(data);

    await waitFor(async () => {
      await sleep(1);
      expect(h.elements.length).toEqual(2);
      const container = h.elements[0];
      expect(container.height).toBe(368);
      expect(container.width).toBe(166);
    });
  });

  it("should fix diamond bounding box", async () => {
    const data = JSON.stringify({
      type: "excalidraw/clipboard",
      elements: [
        {
          ...container,
          type: "diamond",
        },
        textElement,
      ],
    });
    pasteWithCtrlCmdShiftV(data);

    await waitFor(async () => {
      await sleep(1);
      expect(h.elements.length).toEqual(2);
      const container = h.elements[0];
      expect(container.height).toBe(770);
      expect(container.width).toBe(166);
    });
  });
});

describe("pasting & frames", () => {
  it("should add pasted elements to frame under cursor", async () => {
    const frame = API.createElement({
      type: "frame",
      width: 100,
      height: 100,
      x: 0,
      y: 0,
    });
    const rect = API.createElement({ type: "rectangle" });

    API.setElements([frame]);

    const clipboardJSON = await serializeAsClipboardJSON({
      elements: [rect],
      files: null,
    });

    mouse.moveTo(50, 50);

    pasteWithCtrlCmdV(clipboardJSON);

    await waitFor(() => {
      expect(h.elements.length).toBe(2);
      expect(h.elements[0].type).toBe(rect.type);
      expect(h.elements[0].frameId).toBe(frame.id);
      expect(h.elements[1].id).toBe(frame.id);
      expect(h.elements[0].index! < frame.index!).toBe(true);
    });
  });

  it("should layer pasted elements above the highest frame child", async () => {
    const frame = API.createElement({
      type: "frame",
      width: 100,
      height: 100,
      x: 0,
      y: 0,
    });
    const frameChild = API.createElement({
      id: "frameChild",
      type: "rectangle",
      x: 10,
      y: 10,
      width: 20,
      height: 20,
      frameId: frame.id,
    });
    const rect = API.createElement({ type: "rectangle" });

    API.setElements([frameChild, frame]);

    const clipboardJSON = await serializeAsClipboardJSON({
      elements: [rect],
      files: null,
    });

    mouse.moveTo(50, 50);

    pasteWithCtrlCmdV(clipboardJSON);

    await waitFor(() => {
      expect(h.elements.length).toBe(3);
      expect(h.elements[1].type).toBe(rect.type);
      expect(h.elements[1].frameId).toBe(frame.id);
      expect(h.elements.map((element) => element.id)).toEqual([
        frameChild.id,
        h.elements[1].id,
        frame.id,
      ]);
      expect(h.elements[1].index! > frameChild.index!).toBe(true);
      expect(h.elements[1].index! < frame.index!).toBe(true);
    });
  });

  it("should preserve denormalized pasted frame child order", async () => {
    const frame = API.createElement({
      type: "frame",
      width: 100,
      height: 100,
      x: 0,
      y: 0,
    });
    const frameChild = API.createElement({
      type: "rectangle",
      x: 10,
      y: 10,
      width: 20,
      height: 20,
      frameId: frame.id,
    });

    const clipboardJSON = await serializeAsClipboardJSON({
      elements: [frame, frameChild],
      files: null,
    });

    mouse.moveTo(200, 200);

    pasteWithCtrlCmdV(clipboardJSON);

    await waitFor(() => {
      expect(h.elements.length).toBe(2);
      expect(h.elements[0].type).toBe(frame.type);
      expect(h.elements[1].type).toBe(frameChild.type);
      expect(h.elements[1].frameId).toBe(h.elements[0].id);
    });
  });

  it("should remove element from frame when pasted outside", async () => {
    const frame = API.createElement({
      type: "frame",
      width: 100,
      height: 100,
      x: 0,
      y: 0,
    });
    const rect = API.createElement({
      type: "rectangle",
      frameId: frame.id,
      x: 10,
      y: 10,
      width: 50,
      height: 50,
    });

    API.setElements([frame]);

    const clipboardJSON = await serializeAsClipboardJSON({
      elements: [rect],
      files: null,
    });

    mouse.moveTo(150, 150);

    pasteWithCtrlCmdV(clipboardJSON);

    await waitFor(() => {
      expect(h.elements.length).toBe(2);
      expect(h.elements[1].type).toBe(rect.type);
      expect(h.elements[1].frameId).toBe(null);
    });
  });

  it("should filter out elements not overlapping frame", async () => {
    const frame = API.createElement({
      type: "frame",
      width: 100,
      height: 100,
      x: 0,
      y: 0,
    });
    const rect = API.createElement({
      type: "rectangle",
      width: 50,
      height: 50,
    });
    const rect2 = API.createElement({
      type: "rectangle",
      width: 50,
      height: 50,
      x: 100,
      y: 100,
    });

    API.setElements([frame]);

    const clipboardJSON = await serializeAsClipboardJSON({
      elements: [rect, rect2],
      files: null,
    });

    mouse.moveTo(90, 90);

    pasteWithCtrlCmdV(clipboardJSON);

    await waitFor(() => {
      expect(h.elements.length).toBe(3);
      expect(h.elements[0].type).toBe(rect.type);
      expect(h.elements[0].frameId).toBe(frame.id);
      expect(h.elements[1].id).toBe(frame.id);
      expect(h.elements[2].type).toBe(rect2.type);
      expect(h.elements[2].frameId).toBe(null);
    });
  });

  it("should not filter out elements not overlapping frame if part of group", async () => {
    const frame = API.createElement({
      type: "frame",
      width: 100,
      height: 100,
      x: 0,
      y: 0,
    });
    const rect = API.createElement({
      type: "rectangle",
      width: 50,
      height: 50,
      groupIds: ["g1"],
    });
    const rect2 = API.createElement({
      type: "rectangle",
      width: 50,
      height: 50,
      x: 100,
      y: 100,
      groupIds: ["g1"],
    });

    API.setElements([frame]);

    const clipboardJSON = await serializeAsClipboardJSON({
      elements: [rect, rect2],
      files: null,
    });

    mouse.moveTo(90, 90);

    pasteWithCtrlCmdV(clipboardJSON);

    await waitFor(() => {
      expect(h.elements.length).toBe(3);
      expect(h.elements[0].type).toBe(rect.type);
      expect(h.elements[0].frameId).toBe(frame.id);
      expect(h.elements[1].type).toBe(rect2.type);
      expect(h.elements[1].frameId).toBe(frame.id);
      expect(h.elements[2].id).toBe(frame.id);
    });
  });

  it("should not filter out other frames and their children", async () => {
    const frame = API.createElement({
      type: "frame",
      width: 100,
      height: 100,
      x: 0,
      y: 0,
    });
    const rect = API.createElement({
      type: "rectangle",
      width: 50,
      height: 50,
      groupIds: ["g1"],
    });

    const frame2 = API.createElement({
      type: "frame",
      width: 75,
      height: 75,
      x: 0,
      y: 0,
    });
    const rect2 = API.createElement({
      type: "rectangle",
      width: 50,
      height: 50,
      x: 55,
      y: 55,
      frameId: frame2.id,
    });

    API.setElements([frame]);

    const clipboardJSON = await serializeAsClipboardJSON({
      elements: [rect, rect2, frame2],
      files: null,
    });

    mouse.moveTo(90, 90);

    pasteWithCtrlCmdV(clipboardJSON);

    await waitFor(() => {
      expect(h.elements.length).toBe(4);
      expect(h.elements[0].type).toBe(rect.type);
      expect(h.elements[0].frameId).toBe(frame.id);
      expect(h.elements[1].id).toBe(frame.id);
      expect(h.elements[2].type).toBe(rect2.type);
      expect(h.elements[2].frameId).toBe(h.elements[3].id);
      expect(h.elements[3].type).toBe(frame2.type);
      expect(h.elements[3].frameId).toBe(null);
    });
  });
});
