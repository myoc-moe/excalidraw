import {
  CaptureUpdateAction,
  elementWithCanvasCache,
  getSpoilerButtonRect,
  getThumbHashPlaceholder,
  newElementWith,
} from "@excalidraw/element";
import { ShapeCache } from "@excalidraw/element";
import {
  KEYS,
  MIME_TYPES,
  sceneCoordsToViewportCoords,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";
import { pointFrom, pointRotateRads } from "@excalidraw/math";
import {
  exportToBlob as exportToBlobUtils,
  exportToCanvas as exportToCanvasUtils,
  exportToSvg as exportToSvgUtils,
} from "@excalidraw/utils";
import { rgbaToThumbHash } from "thumbhash";

import type { GlobalPoint } from "@excalidraw/math";

import type {
  ExcalidrawElement,
  ExcalidrawImageElement,
  FileId,
} from "@excalidraw/element/types";

import { actionChangeViewBackgroundColor } from "../actions/actionCanvas";
import { actionToggleCropEditor } from "../actions/actionCropEditor";
import { clearAppStateForLocalStorage } from "../appState";
import { serializeAsJSON } from "../data/json";
import { Excalidraw } from "../index";
import {
  decodeSvgBase64Payload,
  exportToCanvas as exportToCanvasScene,
  exportToSvg as exportToSvgScene,
} from "../scene/export";
import * as StaticScene from "../renderer/staticScene";

import { API } from "./helpers/api";
import { Keyboard, Pointer } from "./helpers/ui";
import {
  act,
  fireEvent,
  GlobalTestState,
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
} from "./test-utils";

import type { BinaryFiles, DataURL, ExcalidrawProps } from "../types";

const { h } = window;

const A = "file-a" as FileId;
const B = "file-b" as FileId;
const C = "file-c" as FileId;

const setup = async (props: Partial<ExcalidrawProps> = {}) => {
  const onSpoileredFilesChange = vi.fn();
  await render(
    <Excalidraw
      onSpoileredFilesChange={onSpoileredFilesChange}
      handleKeyboardGlobally={true}
      {...props}
    />,
  );
  return { onSpoileredFilesChange };
};

const mark = (id: FileId, spoilered = true) =>
  act(() => h.app.api.markFileSpoilered(id, spoilered));
const setOne = (id: FileId, visibility: "shown" | "hidden") =>
  act(() => h.app.api.setSpoileredFileVisibility(id, visibility));
const setAll = (visibility: "shown" | "hidden") =>
  act(() => h.app.api.setAllSpoileredFilesVisibility(visibility));

describe("spoilered files state and API", () => {
  // 1.1.1
  it("markFileSpoilered(id, true) adds the id as hidden", async () => {
    await setup();
    mark(A);
    expect(h.app.api.getSpoileredFiles().get(A)).toBe("hidden");
    expect(h.app.api.getSpoileredFiles().size).toBe(1);
  });

  // 1.1.2 (the draw is tested in step 2; here: the entry exists before the
  // element and the file, and stays after both are added)
  it("keeps an entry marked before the element and the file exist", async () => {
    await setup();
    mark(A);
    expect(h.app.api.getSpoileredFiles().get(A)).toBe("hidden");

    const image = API.createElement({
      type: "image",
      id: "img-a",
      fileId: A,
      width: 100,
      height: 100,
    });
    API.setElements([image]);
    expect(h.app.api.getSpoileredFiles().get(A)).toBe("hidden");

    act(() => {
      h.app.api.addFiles([
        {
          id: A,
          fileName: "a.png",
          mimeType: MIME_TYPES.png,
          dataURL: "data:image/png;base64,AAAA" as DataURL,
          created: Date.now(),
        },
      ]);
    });
    expect(h.app.api.getSpoileredFiles().get(A)).toBe("hidden");
    expect(h.app.api.getSpoileredFiles().size).toBe(1);
  });

  // 1.1.3
  it("marking a marked file keeps its visibility", async () => {
    const { onSpoileredFilesChange } = await setup();
    mark(A);
    setOne(A, "shown");
    onSpoileredFilesChange.mockClear();

    mark(A);
    expect(h.app.api.getSpoileredFiles().get(A)).toBe("shown");
    expect(onSpoileredFilesChange).not.toHaveBeenCalled();
  });

  // 1.1.4 (the draw is tested in step 2; here: entry removed and caches reset)
  it("markFileSpoilered(id, false) removes the entry", async () => {
    await setup();
    mark(A);
    const image = API.createElement({ type: "image", fileId: A });
    API.setElements([image]);
    const deleteSpy = vi.spyOn(ShapeCache, "delete");

    mark(A, false);
    expect(h.app.api.getSpoileredFiles().has(A)).toBe(false);
    expect(h.app.api.getSpoileredFiles().size).toBe(0);
    expect(deleteSpy).toHaveBeenCalledWith(
      expect.objectContaining({ id: image.id }),
    );
    deleteSpy.mockRestore();
  });

  it("unmarking an unmarked file does nothing", async () => {
    const { onSpoileredFilesChange } = await setup();
    mark(A, false);
    expect(h.app.api.getSpoileredFiles().size).toBe(0);
    expect(onSpoileredFilesChange).not.toHaveBeenCalled();
  });

  // 1.1.5
  it("setSpoileredFileVisibility changes one file", async () => {
    await setup();
    mark(A);
    mark(B);

    setOne(A, "shown");
    expect(h.app.api.getSpoileredFiles().get(A)).toBe("shown");
    expect(h.app.api.getSpoileredFiles().get(B)).toBe("hidden");

    setOne(A, "hidden");
    expect(h.app.api.getSpoileredFiles().get(A)).toBe("hidden");
    expect(h.app.api.getSpoileredFiles().get(B)).toBe("hidden");
  });

  // 1.1.6
  it("setSpoileredFileVisibility on an unmarked file does nothing", async () => {
    const { onSpoileredFilesChange } = await setup();
    setOne(A, "shown");
    setOne(A, "hidden");
    expect(h.app.api.getSpoileredFiles().size).toBe(0);
    expect(h.app.api.getSpoileredFiles().has(A)).toBe(false);
    expect(onSpoileredFilesChange).not.toHaveBeenCalled();
  });

  // 1.1.7
  it("setAllSpoileredFilesVisibility changes every entry", async () => {
    await setup();
    mark(A);
    mark(B);
    mark(C);
    setOne(B, "shown");

    setAll("shown");
    expect([...h.app.api.getSpoileredFiles().values()]).toEqual([
      "shown",
      "shown",
      "shown",
    ]);

    setAll("hidden");
    expect([...h.app.api.getSpoileredFiles().values()]).toEqual([
      "hidden",
      "hidden",
      "hidden",
    ]);
    expect(h.app.api.getSpoileredFiles().size).toBe(3);
  });

  // 1.1.8
  describe("default visibility", () => {
    it("is hidden before any set all", async () => {
      await setup();
      mark(A);
      expect(h.app.api.getSpoileredFiles().get(A)).toBe("hidden");
    });

    it("follows setAllSpoileredFilesVisibility('shown')", async () => {
      await setup();
      mark(A);
      setAll("shown");
      mark(B);
      expect(h.app.api.getSpoileredFiles().get(B)).toBe("shown");
    });

    it("follows setAllSpoileredFilesVisibility('shown') with an empty map", async () => {
      await setup();
      setAll("shown");
      mark(A);
      expect(h.app.api.getSpoileredFiles().get(A)).toBe("shown");
    });

    it("follows setAllSpoileredFilesVisibility('hidden')", async () => {
      await setup();
      mark(A);
      setAll("shown");
      setAll("hidden");
      mark(B);
      expect(h.app.api.getSpoileredFiles().get(B)).toBe("hidden");
    });
  });

  // 1.1.8a
  it("resets the default to hidden when no file is shown", async () => {
    await setup();
    mark(A);
    mark(B);
    setAll("shown");

    setOne(A, "hidden");
    mark(C);
    // B is still shown: the default stays shown
    expect(h.app.api.getSpoileredFiles().get(C)).toBe("shown");
    mark(C, false);

    setOne(B, "hidden");
    // no file is shown now
    mark(C);
    expect(h.app.api.getSpoileredFiles().get(C)).toBe("hidden");
  });

  it("resets the default to hidden when the last shown file is unmarked", async () => {
    await setup();
    mark(A);
    setAll("shown");
    mark(A, false);

    mark(B);
    expect(h.app.api.getSpoileredFiles().get(B)).toBe("hidden");
  });

  // 1.1.8b
  it("a re-mark takes the current default, not the old visibility", async () => {
    await setup();
    mark(A);
    mark(B);
    setAll("shown");
    // B stays shown, so the default stays shown
    mark(A, false);
    mark(A);
    expect(h.app.api.getSpoileredFiles().get(A)).toBe("shown");

    setAll("hidden");
    setOne(A, "shown");
    mark(B, false);
    mark(B);
    // A is shown, but the default was set hidden by "hide all"
    expect(h.app.api.getSpoileredFiles().get(B)).toBe("hidden");
  });

  it("a re-mark of a file that was shown is hidden once the default reset", async () => {
    await setup();
    mark(A);
    setAll("shown");
    mark(A, false);
    mark(A);
    expect(h.app.api.getSpoileredFiles().get(A)).toBe("hidden");
  });

  // 1.1.9
  it("getSpoileredFiles returns a copy", async () => {
    await setup();
    mark(A);

    const copy = h.app.api.getSpoileredFiles() as Map<
      FileId,
      "shown" | "hidden"
    >;
    copy.set(B, "shown");
    copy.set(A, "shown");
    copy.clear();

    expect(h.app.api.getSpoileredFiles().get(A)).toBe("hidden");
    expect(h.app.api.getSpoileredFiles().size).toBe(1);
    expect(h.app.api.getSpoileredFiles()).not.toBe(h.app.spoileredFiles);
    expect(h.app.api.getSpoileredFiles()).not.toBe(
      h.app.api.getSpoileredFiles(),
    );
  });

  // 1.1.10
  describe("onSpoileredFilesChange", () => {
    it("fires once per API call that changes the state", async () => {
      const { onSpoileredFilesChange } = await setup();

      mark(A);
      expect(onSpoileredFilesChange).toHaveBeenCalledTimes(1);
      expect(onSpoileredFilesChange.mock.lastCall![0].get(A)).toBe("hidden");

      mark(B);
      expect(onSpoileredFilesChange).toHaveBeenCalledTimes(2);

      setOne(A, "shown");
      expect(onSpoileredFilesChange).toHaveBeenCalledTimes(3);
      expect(onSpoileredFilesChange.mock.lastCall![0].get(A)).toBe("shown");

      // two entries change, still one call
      setAll("shown");
      expect(onSpoileredFilesChange).toHaveBeenCalledTimes(4);
      expect([...onSpoileredFilesChange.mock.lastCall![0].values()]).toEqual([
        "shown",
        "shown",
      ]);

      mark(A, false);
      expect(onSpoileredFilesChange).toHaveBeenCalledTimes(5);
      expect(onSpoileredFilesChange.mock.lastCall![0].has(A)).toBe(false);
    });

    it("does not fire for a call that changes nothing", async () => {
      const { onSpoileredFilesChange } = await setup();
      mark(A);
      setOne(A, "shown");
      onSpoileredFilesChange.mockClear();

      mark(A); // already marked
      mark(C, false); // not marked
      setOne(A, "shown"); // same value
      setOne(C, "shown"); // not marked
      setAll("shown"); // every entry already shown
      expect(onSpoileredFilesChange).not.toHaveBeenCalled();
    });

    it("passes a copy, not the live map", async () => {
      const { onSpoileredFilesChange } = await setup();
      mark(A);
      const received = onSpoileredFilesChange.mock.lastCall![0];
      expect(received).not.toBe(h.app.spoileredFiles);
      mark(B);
      expect(received.has(B)).toBe(false);
    });
  });

  // 1.1.11
  describe("the map stays outside the scene and app state", () => {
    it("is not in appState, onChange or storage data", async () => {
      const onChange = vi.fn();
      await setup({ onChange });
      mark(A);
      setOne(A, "shown");
      API.setElements([API.createElement({ type: "rectangle" })]);

      const stateKeys = Object.keys(h.state);
      expect(stateKeys).not.toContain("spoileredFiles");
      expect(stateKeys).not.toContain("spoilerDefaultVisibility");
      expect(JSON.stringify(h.state)).not.toContain(A);

      expect(onChange).toHaveBeenCalled();
      for (const [elements, appState, files] of onChange.mock.calls) {
        expect(Object.keys(appState)).not.toContain("spoileredFiles");
        expect(JSON.stringify([elements, appState, files])).not.toContain(A);
      }

      const stored = clearAppStateForLocalStorage(h.state);
      expect(Object.keys(stored)).not.toContain("spoileredFiles");
      expect(JSON.stringify(stored)).not.toContain(A);
    });

    it("is not in exported scene JSON", async () => {
      await setup();
      mark(A);
      API.setElements([API.createElement({ type: "rectangle" })]);

      const json = serializeAsJSON(
        h.elements,
        h.state,
        h.app.api.getFiles(),
        "local",
      );
      expect(json).not.toContain("spoiler");
      expect(json).not.toContain(A);
      expect(
        serializeAsJSON(h.elements, h.state, h.app.api.getFiles(), "database"),
      ).not.toContain("spoiler");
    });

    it("a state change does not call onChange or setState", async () => {
      const onChange = vi.fn();
      await setup({ onChange });
      onChange.mockClear();
      const setStateSpy = vi.spyOn(h.app, "setState");

      mark(A);
      setOne(A, "shown");
      setAll("hidden");
      mark(A, false);

      expect(setStateSpy).not.toHaveBeenCalled();
      expect(onChange).not.toHaveBeenCalled();
      setStateSpy.mockRestore();
    });
  });

  // 1.1.12
  it("undo and redo do not change the map", async () => {
    await setup();
    mark(A);
    setOne(A, "shown");
    mark(B);

    const image = API.createElement({
      type: "image",
      id: "img-a",
      fileId: A,
      width: 100,
      height: 100,
    });
    act(() => {
      h.app.updateScene({
        elements: [image],
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    });
    act(() => {
      h.app.updateScene({
        elements: [
          newElementWith(image as ExcalidrawElement, { isDeleted: true }),
        ],
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    });
    expect(h.elements[0].isDeleted).toBe(true);

    const before = new Map(h.app.api.getSpoileredFiles());

    Keyboard.undo();
    expect(h.elements[0].isDeleted).toBe(false);
    expect(h.app.api.getSpoileredFiles()).toEqual(before);
    expect(h.app.api.getSpoileredFiles().get(A)).toBe("shown");

    Keyboard.redo();
    expect(h.elements[0].isDeleted).toBe(true);
    expect(h.app.api.getSpoileredFiles()).toEqual(before);

    Keyboard.undo();
    Keyboard.undo();
    expect(h.app.api.getSpoileredFiles()).toEqual(before);
  });

  it("a restored element keeps the hidden state of its file", async () => {
    await setup();
    mark(A);
    const image = API.createElement({ type: "image", id: "img-a", fileId: A });
    act(() => {
      h.app.updateScene({
        elements: [image],
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    });
    act(() => {
      h.app.updateScene({
        elements: [
          newElementWith(image as ExcalidrawElement, { isDeleted: true }),
        ],
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    });
    Keyboard.undo();
    expect(h.elements[0].isDeleted).toBe(false);
    expect(h.app.api.getSpoileredFiles().get(A)).toBe("hidden");
  });

  // 1.1.13
  describe("two elements with one file id", () => {
    it("one API call changes the file for both", async () => {
      const { onSpoileredFilesChange } = await setup();
      const first = API.createElement({ type: "image", fileId: A, x: 0 });
      const second = API.createElement({ type: "image", fileId: A, x: 200 });
      const other = API.createElement({ type: "image", fileId: B, x: 400 });
      API.setElements([first, second, other]);

      const deleteSpy = vi.spyOn(ShapeCache, "delete");
      const updateSpy = vi.fn();
      const unsubscribe = h.app.imagePlaceholderUpdateEmitter.on(updateSpy);

      mark(A);
      mark(B);
      deleteSpy.mockClear();
      updateSpy.mockClear();
      onSpoileredFilesChange.mockClear();

      setOne(A, "shown");

      // one change, one call, one repaint
      expect(onSpoileredFilesChange).toHaveBeenCalledTimes(1);
      expect(updateSpy).toHaveBeenCalledTimes(1);
      // the caches of both elements of file A are cleared, B is untouched
      const cleared = deleteSpy.mock.calls.map(([element]) => element.id);
      expect(cleared).toContain(first.id);
      expect(cleared).toContain(second.id);
      expect(cleared).not.toContain(other.id);
      // the state is per file id: no per element entry
      expect(h.app.api.getSpoileredFiles().size).toBe(2);

      unsubscribe();
      deleteSpy.mockRestore();
    });
  });

  describe("cache invalidation and repaint", () => {
    it("repaints once per change and not for a no-op", async () => {
      await setup();
      const updateSpy = vi.fn();
      const unsubscribe = h.app.imagePlaceholderUpdateEmitter.on(updateSpy);

      mark(A);
      expect(updateSpy).toHaveBeenCalledTimes(1);
      mark(A);
      expect(updateSpy).toHaveBeenCalledTimes(1);
      setAll("shown");
      expect(updateSpy).toHaveBeenCalledTimes(2);
      setAll("shown");
      expect(updateSpy).toHaveBeenCalledTimes(2);

      unsubscribe();
    });

    it("clears caches only for elements of the changed file", async () => {
      await setup();
      const a = API.createElement({ type: "image", fileId: A });
      const b = API.createElement({ type: "image", fileId: B, x: 300 });
      const rect = API.createElement({ type: "rectangle", x: 600 });
      API.setElements([a, b, rect]);
      const deleteSpy = vi.spyOn(ShapeCache, "delete");

      mark(A);
      const cleared = deleteSpy.mock.calls.map(([element]) => element.id);
      expect(cleared).toEqual([a.id]);
      deleteSpy.mockRestore();
    });

    it("accepts a file id that is not in the scene", async () => {
      const { onSpoileredFilesChange } = await setup();
      const deleteSpy = vi.spyOn(ShapeCache, "delete");
      mark("unknown" as FileId);
      setOne("unknown" as FileId, "shown");
      expect(deleteSpy).not.toHaveBeenCalled();
      expect(onSpoileredFilesChange).toHaveBeenCalledTimes(2);
      deleteSpy.mockRestore();
    });

    it("keeps the map identity stable", async () => {
      await setup();
      const map = h.app.spoileredFiles;
      mark(A);
      setAll("shown");
      mark(A, false);
      expect(h.app.spoileredFiles).toBe(map);
    });
  });
});

const mouse = new Pointer("mouse");

const createImage = (id: string, fileId: FileId, x = 0) =>
  API.createElement({
    type: "image",
    id,
    fileId,
    x,
    y: 0,
    width: 200,
    height: 150,
    status: "saved",
  }) as ExcalidrawImageElement;

const select = (element: ExcalidrawElement) =>
  API.setSelectedElements([element as any]);

const cropPredicate = () =>
  actionToggleCropEditor.predicate!(h.elements, h.state, h.app.props, h.app);

const cropSetup = async (visibility: "hidden" | "shown" | "unmarked") => {
  const { onSpoileredFilesChange } = await setup();
  const image = createImage("img-a", A);
  API.setElements([image]);
  if (visibility !== "unmarked") {
    mark(A);
    if (visibility === "shown") {
      setOne(A, "shown");
    }
  }
  select(image);
  onSpoileredFilesChange.mockClear();
  return { image, onSpoileredFilesChange };
};

describe("crop mode guard", () => {
  describe.each([
    ["hidden", false],
    ["shown", true],
    ["unmarked", true],
  ] as const)("a %s image", (visibility, canCrop) => {
    it(`${
      canCrop ? "enters" : "does not enter"
    } crop mode with Enter`, async () => {
      await cropSetup(visibility);
      Keyboard.keyPress(KEYS.ENTER);
      expect(h.state.croppingElementId).toBe(canCrop ? "img-a" : null);
    });

    it(`${
      canCrop ? "enters" : "does not enter"
    } crop mode with the crop action`, async () => {
      await cropSetup(visibility);
      act(() => {
        h.app.actionManager.executeAction(actionToggleCropEditor);
      });
      expect(h.state.croppingElementId).toBe(canCrop ? "img-a" : null);
    });

    it(`has the crop action predicate ${canCrop}`, async () => {
      await cropSetup(visibility);
      expect(cropPredicate()).toBe(canCrop);
    });

    // this fork smart-zooms on a double-click of an image. Enter is the
    // way into crop mode. A double-click must not start it in any state.
    it("does not enter crop mode with a double-click", async () => {
      await cropSetup(visibility);
      mouse.doubleClickAt(100, 75);
      expect(h.state.croppingElementId).toBe(null);
    });

    it("does not change the crop data or the scene by a refused crop", async () => {
      const { image } = await cropSetup(visibility);
      const version = image.version;
      Keyboard.keyPress(KEYS.ENTER);
      Keyboard.keyPress(KEYS.ESCAPE);
      expect(h.elements[0].version).toBe(version);
      expect((h.elements[0] as ExcalidrawImageElement).crop).toBe(null);
    });
  });

  it("does not run the crop action when it is not a one image selection", async () => {
    await setup();
    const a = createImage("img-a", A);
    const b = createImage("img-b", B, 300);
    API.setElements([a, b]);
    mark(A);
    API.setSelectedElements([a, b] as any);
    expect(cropPredicate()).toBe(false);
  });

  it("only blocks the hidden file when another image is shown", async () => {
    await setup();
    const a = createImage("img-a", A);
    const b = createImage("img-b", B, 300);
    API.setElements([a, b]);
    mark(A);
    mark(B);
    setOne(B, "shown");

    select(a);
    expect(cropPredicate()).toBe(false);
    select(b);
    expect(cropPredicate()).toBe(true);
    Keyboard.keyPress(KEYS.ENTER);
    expect(h.state.croppingElementId).toBe("img-b");
  });

  it("two images with one hidden file are both blocked", async () => {
    await setup();
    const a = createImage("img-a", A);
    const b = createImage("img-b", A, 300);
    API.setElements([a, b]);
    mark(A);
    for (const image of [a, b]) {
      select(image);
      Keyboard.keyPress(KEYS.ENTER);
      expect(h.state.croppingElementId).toBe(null);
    }
  });

  it("a view mode crop action is blocked for a hidden image too", async () => {
    await setup({ viewModeEnabled: true });
    const image = createImage("img-a", A);
    API.setElements([image]);
    mark(A);
    select(image);
    act(() => {
      h.app.actionManager.executeAction(actionToggleCropEditor);
    });
    expect(h.state.croppingElementId).toBe(null);
  });

  describe("showing and hiding the file", () => {
    it("restores crop mode when the file is shown", async () => {
      await cropSetup("hidden");
      Keyboard.keyPress(KEYS.ENTER);
      expect(h.state.croppingElementId).toBe(null);
      expect(cropPredicate()).toBe(false);

      setOne(A, "shown");
      expect(cropPredicate()).toBe(true);
      Keyboard.keyPress(KEYS.ENTER);
      expect(h.state.croppingElementId).toBe("img-a");
    });

    it("restores crop mode when the mark is removed", async () => {
      await cropSetup("hidden");
      mark(A, false);
      expect(cropPredicate()).toBe(true);
      Keyboard.keyPress(KEYS.ENTER);
      expect(h.state.croppingElementId).toBe("img-a");
    });

    it("restores crop mode with setAllSpoileredFilesVisibility('shown')", async () => {
      await cropSetup("hidden");
      setAll("shown");
      act(() => {
        h.app.actionManager.executeAction(actionToggleCropEditor);
      });
      expect(h.state.croppingElementId).toBe("img-a");
    });

    // Decision: hiding the file of the cropped image ends crop mode, as the
    // Enter key does. The crop data of the element does not change. The
    // user can crop again after the file is shown.
    it("ends crop mode when the file of the cropped image is hidden", async () => {
      const { image, onSpoileredFilesChange } = await cropSetup("shown");
      Keyboard.keyPress(KEYS.ENTER);
      expect(h.state.croppingElementId).toBe("img-a");

      setOne(A, "hidden");

      expect(h.state.croppingElementId).toBe(null);
      expect(h.elements[0].version).toBe(image.version);
      expect(onSpoileredFilesChange).toHaveBeenCalledTimes(1);
      expect(h.app.api.getSpoileredFiles().get(A)).toBe("hidden");

      // crop is blocked until the file is shown again
      Keyboard.keyPress(KEYS.ENTER);
      expect(h.state.croppingElementId).toBe(null);
      setOne(A, "shown");
      Keyboard.keyPress(KEYS.ENTER);
      expect(h.state.croppingElementId).toBe("img-a");
    });

    it("adds no history entry when a hide ends crop mode", async () => {
      await cropSetup("shown");
      Keyboard.keyPress(KEYS.ENTER);
      const undoLength = h.history.undoStack.length;
      const redoLength = h.history.redoStack.length;
      setOne(A, "hidden");
      expect(h.state.croppingElementId).toBe(null);
      expect(h.history.undoStack.length).toBe(undoLength);
      expect(h.history.redoStack.length).toBe(redoLength);
    });

    it("crop, hide, undo keeps crop mode off", async () => {
      await cropSetup("shown");
      Keyboard.keyPress(KEYS.ENTER);
      setOne(A, "hidden");
      Keyboard.undo();
      expect(h.state.croppingElementId).toBe(null);
      Keyboard.redo();
      expect(h.state.croppingElementId).toBe(null);
    });

    it("undo twice after show, crop, escape, hide does not restore crop mode", async () => {
      await cropSetup("hidden");
      setOne(A, "shown");
      Keyboard.keyPress(KEYS.ENTER);
      expect(h.state.croppingElementId).toBe("img-a");
      Keyboard.keyPress(KEYS.ESCAPE);
      expect(h.state.croppingElementId).toBe(null);
      setOne(A, "hidden");

      Keyboard.undo();
      expect(h.state.croppingElementId).toBe(null);
      Keyboard.undo();
      expect(h.state.croppingElementId).toBe(null);
      Keyboard.redo();
      Keyboard.redo();
      expect(h.state.croppingElementId).toBe(null);
    });

    it("undo restores crop mode again once the file is shown", async () => {
      await cropSetup("shown");
      Keyboard.keyPress(KEYS.ENTER);
      Keyboard.keyPress(KEYS.ESCAPE);
      setOne(A, "hidden");
      Keyboard.undo();
      expect(h.state.croppingElementId).toBe(null);
      Keyboard.redo();
      setOne(A, "shown");
      Keyboard.undo();
      expect(h.state.croppingElementId).toBe("img-a");
    });

    it("a later undo does not restore crop mode that the guard ended", async () => {
      await cropSetup("shown");
      const color = h.state.viewBackgroundColor;
      Keyboard.keyPress(KEYS.ENTER);
      Keyboard.keyPress(KEYS.ESCAPE);
      setOne(A, "hidden");
      // the undo restores crop mode and the guard ends it
      Keyboard.undo();
      expect(h.state.croppingElementId).toBe(null);

      act(() => {
        h.app.actionManager.executeAction(
          actionChangeViewBackgroundColor,
          "ui",
          { viewBackgroundColor: "#000000" },
        );
      });
      setOne(A, "shown");
      Keyboard.undo();

      expect(h.state.viewBackgroundColor).toBe(color);
      expect(h.state.croppingElementId).toBe(null);
    });

    it("keeps a pending change undoable when a hide ends crop mode", async () => {
      await cropSetup("shown");
      const { name, viewBackgroundColor } = h.state;
      Keyboard.keyPress(KEYS.ENTER);
      act(() => {
        h.app.updateScene({
          appState: { name: "pending name" },
          captureUpdate: CaptureUpdateAction.EVENTUALLY,
        });
      });
      setOne(A, "hidden");
      expect(h.state.croppingElementId).toBe(null);

      act(() => {
        h.app.actionManager.executeAction(
          actionChangeViewBackgroundColor,
          "ui",
          { viewBackgroundColor: "#000000" },
        );
      });
      Keyboard.undo();

      expect(h.state.viewBackgroundColor).toBe(viewBackgroundColor);
      expect(h.state.name).toBe(name);
      expect(h.state.croppingElementId).toBe(null);
    });

    it("keeps an EVENTUALLY host change of the same update undoable", async () => {
      await cropSetup("hidden");
      const { name, viewBackgroundColor } = h.state;

      // one update: the host puts a hidden image in crop mode and changes the
      // name. The guard in `componentDidUpdate` ends crop mode.
      act(() => {
        h.app.updateScene({
          appState: { croppingElementId: "img-a", name: "host name" },
          captureUpdate: CaptureUpdateAction.EVENTUALLY,
        });
      });
      expect(h.state.croppingElementId).toBe(null);
      expect(h.state.name).toBe("host name");

      act(() => {
        h.app.actionManager.executeAction(
          actionChangeViewBackgroundColor,
          "ui",
          { viewBackgroundColor: "#000000" },
        );
      });
      Keyboard.undo();

      expect(h.state.viewBackgroundColor).toBe(viewBackgroundColor);
      expect(h.state.name).toBe(name);
      expect(h.state.croppingElementId).toBe(null);
    });

    it("ends crop mode with setAllSpoileredFilesVisibility('hidden')", async () => {
      await cropSetup("shown");
      Keyboard.keyPress(KEYS.ENTER);
      expect(h.state.croppingElementId).toBe("img-a");
      setAll("hidden");
      expect(h.state.croppingElementId).toBe(null);
    });

    it("keeps the crop of a cropped image with an existing crop", async () => {
      await setup();
      const image = {
        ...createImage("img-a", A),
        crop: {
          x: 10,
          y: 10,
          width: 100,
          height: 100,
          naturalWidth: 400,
          naturalHeight: 300,
        },
      };
      API.setElements([image]);
      mark(A);
      setOne(A, "shown");
      select(image);
      Keyboard.keyPress(KEYS.ENTER);
      expect(h.state.croppingElementId).toBe("img-a");
      setOne(A, "hidden");
      expect(h.state.croppingElementId).toBe(null);
      expect((h.elements[0] as ExcalidrawImageElement).crop).toEqual(
        image.crop,
      );
    });

    it("keeps crop mode when another file is hidden", async () => {
      await setup();
      const a = createImage("img-a", A);
      const b = createImage("img-b", B, 300);
      API.setElements([a, b]);
      mark(A);
      setOne(A, "shown");
      mark(B);
      select(a);
      Keyboard.keyPress(KEYS.ENTER);
      expect(h.state.croppingElementId).toBe("img-a");

      setOne(B, "shown");
      setOne(B, "hidden");
      mark(B, false);
      mark("other" as FileId);

      expect(h.state.croppingElementId).toBe("img-a");
    });

    it("keeps crop mode when the file of the cropped image is unmarked", async () => {
      await cropSetup("shown");
      Keyboard.keyPress(KEYS.ENTER);
      mark(A, false);
      expect(h.state.croppingElementId).toBe("img-a");
    });

    it("keeps crop mode when a shown file is shown again", async () => {
      await cropSetup("shown");
      Keyboard.keyPress(KEYS.ENTER);
      setOne(A, "shown");
      setAll("shown");
      expect(h.state.croppingElementId).toBe("img-a");
    });

    it("does not add a spoiler entry to appState when crop mode ends", async () => {
      await cropSetup("shown");
      Keyboard.keyPress(KEYS.ENTER);
      setOne(A, "hidden");
      expect(
        JSON.stringify(clearAppStateForLocalStorage(h.state)),
      ).not.toContain("spoiler");
    });
  });
});

describe("GIF playback guard", () => {
  const GIF_A = "gif-a" as FileId;
  const GIF_B = "gif-b" as FileId;

  const gifPlayback = () => (h.app as any).gifPlayback;
  const loopRunning = () => gifPlayback().playbackRaf !== null;
  const stopLoop = () => gifPlayback().stop();
  const tick = () => act(() => gifPlayback().tick());
  const controls = () => document.querySelector(".gif-playback-controls");
  const loadLarge = () =>
    document.querySelector(".gif-playback-controls__load-large");

  let now = 0;

  const createGif = (id: string, fileId: FileId, x = 0) =>
    ({
      ...createImage(id, fileId, x),
      gifPlayback: { frameIndex: 0, speed: 1, playing: true },
    } as ExcalidrawImageElement);

  const addGifFile = (fileId: FileId) => {
    act(() => {
      h.app.api.addFiles([
        {
          id: fileId,
          fileName: "a.gif",
          mimeType: MIME_TYPES.gif,
          dataURL: "data:image/gif;base64,AAAA" as DataURL,
          created: Date.now(),
        },
      ]);
    });
    // addFiles starts an image load. Replace its cache entry with a decoded
    // two frame GIF.
    h.app.imageCache.set(fileId, {
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
    });
  };

  const gifSetup = async (visibility: "hidden" | "shown" | "unmarked") => {
    const { onSpoileredFilesChange } = await setup();
    const gif = createGif("gif-el", GIF_A);
    API.setElements([gif]);
    addGifFile(GIF_A);
    if (visibility !== "unmarked") {
      mark(GIF_A);
      if (visibility === "shown") {
        setOne(GIF_A, "shown");
      }
    }
    select(gif);
    stopLoop();
    onSpoileredFilesChange.mockClear();
    return { gif, onSpoileredFilesChange };
  };

  beforeEach(() => {
    now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe.each([
    ["hidden", false],
    ["shown", true],
    ["unmarked", true],
  ] as const)("a %s GIF", (visibility, plays) => {
    it(`${plays ? "starts" : "does not start"} the playback loop`, async () => {
      await gifSetup(visibility);
      h.app.ensureGifPlaybackLoop();
      expect(loopRunning()).toBe(plays);
    });

    it(`${
      plays ? "advances" : "does not advance"
    } its frame on a tick`, async () => {
      const { gif } = await gifSetup(visibility);
      const deleteSpy = vi.spyOn(ShapeCache, "delete");
      const updateSpy = vi.fn();
      const unsubscribe = h.app.imagePlaceholderUpdateEmitter.on(updateSpy);

      tick();
      now = 100;
      tick();

      expect(h.app.getGifPlaybackFrameIndex(gif)).toBe(plays ? 1 : 0);
      expect(deleteSpy.mock.calls.some(([el]) => el.id === gif.id)).toBe(plays);
      expect(updateSpy).toHaveBeenCalledTimes(plays ? 1 : 0);
      unsubscribe();
    });

    it(`${
      plays ? "renders" : "does not render"
    } the GifPlaybackControls`, async () => {
      await gifSetup(visibility);
      // a selection change makes the controls render
      act(() => h.app.setState({}));
      expect(!!controls()).toBe(plays);
    });
  });

  it("keeps a hidden GIF stopped through many ticks", async () => {
    const { gif } = await gifSetup("hidden");
    for (let i = 1; i <= 5; i++) {
      now = i * 1000;
      tick();
    }
    expect(h.app.getGifPlaybackFrameIndex(gif)).toBe(0);
    expect(loopRunning()).toBe(false);
  });

  it("plays an unmarked GIF while another GIF is hidden", async () => {
    await setup();
    const hidden = createGif("gif-hidden", GIF_A);
    const open = createGif("gif-open", GIF_B, 300);
    API.setElements([hidden, open]);
    addGifFile(GIF_A);
    addGifFile(GIF_B);
    mark(GIF_A);
    stopLoop();

    h.app.ensureGifPlaybackLoop();
    expect(loopRunning()).toBe(true);
    tick();
    now = 100;
    tick();
    expect(h.app.getGifPlaybackFrameIndex(hidden)).toBe(0);
    expect(h.app.getGifPlaybackFrameIndex(open)).toBe(1);
    expect(loopRunning()).toBe(true);
  });

  it("two GIF elements with one hidden file both stay stopped", async () => {
    await setup();
    const first = createGif("gif-1", GIF_A);
    const second = createGif("gif-2", GIF_A, 300);
    API.setElements([first, second]);
    addGifFile(GIF_A);
    mark(GIF_A);
    stopLoop();
    h.app.ensureGifPlaybackLoop();
    expect(loopRunning()).toBe(false);
    now = 100;
    tick();
    expect(h.app.getGifPlaybackFrameIndex(first)).toBe(0);
    expect(h.app.getGifPlaybackFrameIndex(second)).toBe(0);
  });

  describe("showing the file", () => {
    it("restores the playback loop", async () => {
      const { gif, onSpoileredFilesChange } = await gifSetup("hidden");
      h.app.ensureGifPlaybackLoop();
      expect(loopRunning()).toBe(false);

      setOne(GIF_A, "shown");

      expect(onSpoileredFilesChange).toHaveBeenCalledTimes(1);
      expect(loopRunning()).toBe(true);
      tick();
      now = 100;
      tick();
      expect(h.app.getGifPlaybackFrameIndex(gif)).toBe(1);
    });

    it("restores the playback loop when the mark is removed", async () => {
      await gifSetup("hidden");
      mark(GIF_A, false);
      expect(loopRunning()).toBe(true);
    });

    it("restores the playback loop with setAllSpoileredFilesVisibility('shown')", async () => {
      await gifSetup("hidden");
      setAll("shown");
      expect(loopRunning()).toBe(true);
    });

    it("restores the GifPlaybackControls of the selected GIF", async () => {
      await gifSetup("hidden");
      act(() => h.app.setState({}));
      expect(controls()).toBe(null);

      setOne(GIF_A, "shown");
      expect(controls()).not.toBe(null);
    });

    it("does not change the playback data of the element", async () => {
      const { gif } = await gifSetup("hidden");
      setOne(GIF_A, "shown");
      expect(h.elements[0].version).toBe(gif.version);
      expect((h.elements[0] as ExcalidrawImageElement).gifPlayback).toEqual({
        frameIndex: 0,
        speed: 1,
        playing: true,
      });
    });
  });

  // Decision: hiding a file pauses its GIF at the runtime level only. The
  // `gifPlayback` data of the element does not change (no scene write, no
  // history entry), and the runtime frame stays. The playback loop stops
  // when no other GIF plays. Showing the file resumes from the same frame.
  describe("hiding the file while the GIF plays", () => {
    it("stops the frame advance and the loop", async () => {
      const { gif } = await gifSetup("shown");
      h.app.ensureGifPlaybackLoop();
      expect(loopRunning()).toBe(true);
      tick();
      now = 100;
      tick();
      expect(h.app.getGifPlaybackFrameIndex(gif)).toBe(1);

      setOne(GIF_A, "hidden");
      now = 200;
      tick();

      expect(h.app.getGifPlaybackFrameIndex(gif)).toBe(1);
      expect(loopRunning()).toBe(false);
    });

    it("does not change the playback data or the scene", async () => {
      const { gif } = await gifSetup("shown");
      now = 100;
      tick();
      setOne(GIF_A, "hidden");
      now = 200;
      tick();
      expect(h.elements[0].version).toBe(gif.version);
      expect(
        (h.elements[0] as ExcalidrawImageElement).gifPlayback?.playing,
      ).toBe(true);
    });

    it("removes the GifPlaybackControls of the selected GIF", async () => {
      await gifSetup("shown");
      act(() => h.app.setState({}));
      expect(controls()).not.toBe(null);

      setOne(GIF_A, "hidden");
      expect(controls()).toBe(null);
    });

    it("resumes from the same frame when the file is shown", async () => {
      const { gif } = await gifSetup("shown");
      h.app.ensureGifPlaybackLoop();
      tick();
      now = 100;
      tick();
      expect(h.app.getGifPlaybackFrameIndex(gif)).toBe(1);

      setOne(GIF_A, "hidden");
      now = 5000;
      tick();
      setOne(GIF_A, "shown");
      expect(loopRunning()).toBe(true);
      expect(h.app.getGifPlaybackFrameIndex(gif)).toBe(1);
    });

    it("restarts the frame timer when the file is shown", async () => {
      const { gif } = await gifSetup("shown");
      h.app.ensureGifPlaybackLoop();
      tick();
      setOne(GIF_A, "hidden");
      now = 5000;
      setOne(GIF_A, "shown");
      // 50 ms after the show: not yet due, so no jump
      now = 5010;
      tick();
      expect(h.app.getGifPlaybackFrameIndex(gif)).toBe(0);
      now = 5060;
      tick();
      expect(h.app.getGifPlaybackFrameIndex(gif)).toBe(1);
    });

    it("keeps the loop for another GIF that plays", async () => {
      await setup();
      const a = createGif("gif-a-el", GIF_A);
      const b = createGif("gif-b-el", GIF_B, 300);
      API.setElements([a, b]);
      addGifFile(GIF_A);
      addGifFile(GIF_B);
      mark(GIF_A);
      setOne(GIF_A, "shown");
      stopLoop();
      h.app.ensureGifPlaybackLoop();

      tick();
      setOne(GIF_A, "hidden");
      now = 100;
      tick();
      expect(loopRunning()).toBe(true);
      expect(h.app.getGifPlaybackFrameIndex(a)).toBe(0);
      expect(h.app.getGifPlaybackFrameIndex(b)).toBe(1);
    });
  });

  describe("the Load Large GIF button", () => {
    const deferredSetup = async (
      visibility: "hidden" | "shown" | "unmarked",
    ) => {
      await setup();
      const gif = createGif("gif-el", GIF_A);
      API.setElements([gif]);
      addGifFile(GIF_A);
      h.app.imageCache.set(GIF_A, {
        image: new Image(),
        mimeType: MIME_TYPES.gif,
        gifDecodeStatus: "deferred",
      });
      if (visibility !== "unmarked") {
        mark(GIF_A);
        if (visibility === "shown") {
          setOne(GIF_A, "shown");
        }
      }
      act(() => h.app.setState({}));
    };

    it("is not rendered for a hidden GIF", async () => {
      await deferredSetup("hidden");
      expect(loadLarge()).toBe(null);
    });

    it("is rendered for a shown GIF", async () => {
      await deferredSetup("shown");
      expect(loadLarge()).not.toBe(null);
    });

    it("is rendered for an unmarked GIF", async () => {
      await deferredSetup("unmarked");
      expect(loadLarge()).not.toBe(null);
    });

    it("comes back when the file is shown", async () => {
      await deferredSetup("hidden");
      setOne(GIF_A, "shown");
      expect(loadLarge()).not.toBe(null);
      setOne(GIF_A, "hidden");
      expect(loadLarge()).toBe(null);
    });
  });
});

// -----------------------------------------------------------------------------
// MyOC: the "Show spoiler" button (step 4, tests.md 1.3)
// -----------------------------------------------------------------------------

const LABEL = "Show spoiler";

const getLatest = (id: string) =>
  h.app.scene.getElement(id) as ExcalidrawImageElement;

/** a point of the button in scene space. `fx` and `fy` are fractions of the
    button width and height (0.5 is the centre). */
const buttonPoint = (id: string, fx = 0.5, fy = 0.5) => {
  const element = getLatest(id);
  const { button } = getSpoilerButtonRect(element, h.state.zoom.value, LABEL);
  expect(button).not.toBeNull();
  const center = pointFrom<GlobalPoint>(
    element.x + element.width / 2,
    element.y + element.height / 2,
  );
  const [x, y] = pointRotateRads(
    pointFrom<GlobalPoint>(
      element.x + button!.x + button!.width * fx,
      element.y + button!.y + button!.height * fy,
    ),
    center,
    element.angle,
  );
  return { x, y };
};

const toClient = (point: { x: number; y: number }) =>
  sceneCoordsToViewportCoords({ sceneX: point.x, sceneY: point.y }, h.state);

/** pointer down, pointer up and the click at one client point, as a
    browser sends them */
const clickClientAt = (x: number, y: number) => {
  mouse.clickAt(x, y);
  fireEvent.click(GlobalTestState.interactiveCanvas, {
    button: 0,
    clientX: x,
    clientY: y,
  });
};

const clickCanvasAt = (point: { x: number; y: number }) => {
  const { x, y } = toClient(point);
  clickClientAt(x, y);
};

/** the click event alone, with no pointer down before it */
const clickEventOnlyAt = (point: { x: number; y: number }) => {
  const { x, y } = toClient(point);
  fireEvent.click(GlobalTestState.interactiveCanvas, {
    button: 0,
    clientX: x,
    clientY: y,
  });
};

/** a press at `from`, a move and a release at `to`, then the click that a
    browser sends at the release point */
const dragAndClick = (
  from: { x: number; y: number },
  to: { x: number; y: number },
) => {
  const start = toClient(from);
  const end = toClient(to);
  mouse.downAt(start.x, start.y);
  mouse.moveTo((start.x + end.x) / 2, (start.y + end.y) / 2);
  mouse.moveTo(end.x, end.y);
  mouse.upAt(end.x, end.y);
  fireEvent.click(GlobalTestState.interactiveCanvas, {
    button: 0,
    clientX: end.x,
    clientY: end.y,
  });
};

const hoverAt = (point: { x: number; y: number }) => {
  const { x, y } = toClient(point);
  mouse.moveTo(x, y);
};

const nextFrame = () =>
  act(
    () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
  );

const visibility = (id: FileId) => h.app.api.getSpoileredFiles().get(id);

const spoilerSetup = async (
  props: Partial<ExcalidrawProps> = {},
  elementProps: Partial<ExcalidrawImageElement> = {},
) => {
  const result = await setup(props);
  const image = API.createElement({
    type: "image",
    id: "img-a",
    fileId: A,
    x: 100,
    y: 100,
    width: 400,
    height: 300,
    status: "saved",
    ...elementProps,
  } as any) as unknown as ExcalidrawImageElement;
  API.setElements([image]);
  mark(A);
  result.onSpoileredFilesChange.mockClear();
  return { ...result, image };
};

describe("Show spoiler button", () => {
  // a real viewport, so that the App has visible elements
  beforeAll(() => {
    mockBoundingClientRect({ width: 1200, height: 900 });
  });

  afterAll(() => {
    restoreOriginalGetBoundingClientRect();
  });

  beforeEach(() => {
    mouse.reset();
  });

  describe("static draw", () => {
    // 1.3.1
    it("draws the icon and the localized button in the image draw", async () => {
      const fillText = vi.spyOn(CanvasRenderingContext2D.prototype, "fillText");
      await spoilerSetup();
      await nextFrame();
      expect(fillText).toHaveBeenCalledWith(
        LABEL,
        expect.any(Number),
        expect.any(Number),
      );
      expect(
        elementWithCanvasCache.get(getLatest("img-a"))?.spoilerOverlayKey,
      ).toBe(`0|0|${LABEL}`);
      fillText.mockRestore();
    });

    it.each([0.5, 2, 4])(
      "draws the button at one on-screen size at zoom %s",
      async (zoom) => {
        await spoilerSetup({}, { width: 1000, height: 800 } as any);
        const before = getSpoilerButtonRect(getLatest("img-a"), 1, LABEL);
        act(() => API.setAppState({ zoom: { value: zoom as any } }));
        await nextFrame();
        const after = getSpoilerButtonRect(getLatest("img-a"), zoom, LABEL);
        expect(after.button!.width * zoom).toBeCloseTo(before.button!.width);
        expect(after.button!.height * zoom).toBeCloseTo(24);
        // the element canvas was made for the new zoom
        expect(elementWithCanvasCache.get(getLatest("img-a"))?.zoomValue).toBe(
          zoom,
        );
      },
    );

    it("draws no button for a shown file", async () => {
      await spoilerSetup();
      setOne(A, "shown");
      await nextFrame();
      expect(
        elementWithCanvasCache.get(getLatest("img-a"))?.spoilerOverlayKey ??
          null,
      ).toBe(null);
    });

    // 1.3.11 (the canvas part: the button is part of the static canvas)
    it("blits the overlay to the static canvas as part of the image", async () => {
      const drawImage = vi.spyOn(
        CanvasRenderingContext2D.prototype,
        "drawImage",
      );
      await spoilerSetup();
      await nextFrame();
      const elementCanvas = elementWithCanvasCache.get(
        getLatest("img-a"),
      )!.canvas;
      const blits = drawImage.mock.calls
        .map((args, index) => ({
          source: args[0],
          target: (drawImage.mock.contexts[index] as CanvasRenderingContext2D)
            .canvas,
        }))
        .filter(({ source }) => source === elementCanvas);
      expect(blits.length).toBeGreaterThan(0);
      expect(blits.every(({ target }) => target === h.app.canvas)).toBe(true);
      drawImage.mockRestore();
    });
  });

  describe("click", () => {
    // 1.3.2
    it("shows the file and fires onSpoileredFilesChange once", async () => {
      const { onSpoileredFilesChange } = await spoilerSetup();
      clickCanvasAt(buttonPoint("img-a"));
      expect(visibility(A)).toBe("shown");
      expect(onSpoileredFilesChange).toHaveBeenCalledTimes(1);
      expect(onSpoileredFilesChange.mock.calls[0][0].get(A)).toBe("shown");
    });

    it("shows the file on a full pointer click and selects the image", async () => {
      await spoilerSetup();
      clickCanvasAt(buttonPoint("img-a"));
      expect(visibility(A)).toBe("shown");
      expect(h.state.selectedElementIds).toEqual({ "img-a": true });
    });

    it.each([
      [0.02, 0.5],
      [0.98, 0.5],
      [0.5, 0.05],
      [0.5, 0.95],
    ])(
      "shows the file on a click at the button point (%s, %s)",
      async (fx, fy) => {
        await spoilerSetup();
        clickCanvasAt(buttonPoint("img-a", fx, fy));
        expect(visibility(A)).toBe("shown");
      },
    );

    it("shows every element of the file", async () => {
      await spoilerSetup();
      const copy = API.createElement({
        type: "image",
        id: "img-b",
        fileId: A,
        x: 600,
        y: 100,
        width: 400,
        height: 300,
        status: "saved",
      });
      API.setElements([getLatest("img-a"), copy]);
      clickCanvasAt(buttonPoint("img-b"));
      expect(visibility(A)).toBe("shown");
    });

    // 1.3.3
    it.each([
      ["the blur", { x: 120, y: 120 }],
      ["the icon", null],
      ["just left of the button", "left"],
    ] as const)(
      "does not show the file on a click on %s, and selects as usual",
      async (_, where) => {
        await spoilerSetup();
        const point =
          where === null
            ? (() => {
                const element = getLatest("img-a");
                const { icon } = getSpoilerButtonRect(element, 1, LABEL);
                return { x: element.x + icon!.x, y: element.y + icon!.y };
              })()
            : where === "left"
            ? (() => {
                const p = buttonPoint("img-a", 0, 0.5);
                return { x: p.x - 2, y: p.y };
              })()
            : where;
        clickCanvasAt(point);
        expect(visibility(A)).toBe("hidden");
        expect(h.state.selectedElementIds).toEqual({ "img-a": true });
      },
    );

    it("does not show the file on a click outside the image", async () => {
      const { onSpoileredFilesChange } = await spoilerSetup();
      clickCanvasAt({ x: 50, y: 50 });
      expect(visibility(A)).toBe("hidden");
      expect(onSpoileredFilesChange).not.toHaveBeenCalled();
    });

    it("does nothing at the button position of a shown file", async () => {
      const { onSpoileredFilesChange } = await spoilerSetup();
      const point = buttonPoint("img-a");
      setOne(A, "shown");
      onSpoileredFilesChange.mockClear();
      clickCanvasAt(point);
      expect(visibility(A)).toBe("shown");
      expect(onSpoileredFilesChange).not.toHaveBeenCalled();
    });

    it("does nothing at the button position of an unmarked file", async () => {
      const { onSpoileredFilesChange } = await spoilerSetup();
      const point = buttonPoint("img-a");
      mark(A, false);
      onSpoileredFilesChange.mockClear();
      clickCanvasAt(point);
      expect(visibility(A)).toBe(undefined);
      expect(onSpoileredFilesChange).not.toHaveBeenCalled();
    });

    it("ignores a click with another mouse button", async () => {
      await spoilerSetup();
      const { x, y } = toClient(buttonPoint("img-a"));
      fireEvent.click(GlobalTestState.interactiveCanvas, {
        button: 1,
        clientX: x,
        clientY: y,
      });
      expect(visibility(A)).toBe("hidden");
    });

    it("works for a locked image", async () => {
      await spoilerSetup({}, { locked: true });
      clickCanvasAt(buttonPoint("img-a"));
      expect(visibility(A)).toBe("shown");
    });

    it("does not change the scene or add a history entry", async () => {
      await spoilerSetup();
      const { x, y } = toClient(buttonPoint("img-a"));
      // the press selects the image (a history entry of its own)
      mouse.clickAt(x, y);
      const version = getLatest("img-a").version;
      const undoLength = h.history.undoStack.length;
      fireEvent.click(GlobalTestState.interactiveCanvas, {
        button: 0,
        clientX: x,
        clientY: y,
      });
      expect(visibility(A)).toBe("shown");
      expect(getLatest("img-a").version).toBe(version);
      expect(h.history.undoStack.length).toBe(undoLength);
    });

    // 1.3.4
    it("does not show a small image (icon only)", async () => {
      const { onSpoileredFilesChange } = await spoilerSetup({}, {
        width: 56,
        height: 44,
      } as any);
      const element = getLatest("img-a");
      expect(getSpoilerButtonRect(element, 1, LABEL).button).toBeNull();
      clickCanvasAt({ x: element.x + 28, y: element.y + 22 });
      expect(visibility(A)).toBe("hidden");
      expect(onSpoileredFilesChange).not.toHaveBeenCalled();
    });

    it("does not show an image that the zoom makes small", async () => {
      await spoilerSetup();
      const point = buttonPoint("img-a");
      act(() => API.setAppState({ zoom: { value: 0.25 as any } }));
      expect(
        getSpoilerButtonRect(getLatest("img-a"), 0.25, LABEL).button,
      ).toBeNull();
      clickCanvasAt(point);
      expect(visibility(A)).toBe("hidden");
    });

    // 1.3.5
    it("follows a rotated element", async () => {
      await spoilerSetup({}, { angle: Math.PI / 2 } as any);
      const element = getLatest("img-a");
      const { button } = getSpoilerButtonRect(element, 1, LABEL);
      // the unrotated button centre is outside the rotated button
      clickCanvasAt({
        x: element.x + button!.x + button!.width / 2,
        y: element.y + button!.y + button!.height / 2,
      });
      expect(visibility(A)).toBe("hidden");
      clickCanvasAt(buttonPoint("img-a"));
      expect(visibility(A)).toBe("shown");
    });

    it.each([[[-1, 1]], [[1, -1]], [[-1, -1]]] as [[number, number]][])(
      "keeps the button where it draws for the flip %j",
      async (scale) => {
        await spoilerSetup({}, { scale } as any);
        const element = getLatest("img-a");
        const point = buttonPoint("img-a");
        // the vertical mirror of the button centre is on the blur
        clickCanvasAt({ x: point.x, y: 2 * (element.y + 150) - point.y });
        expect(visibility(A)).toBe("hidden");
        clickCanvasAt(point);
        expect(visibility(A)).toBe("shown");
      },
    );

    // 1.3.6
    it("works in view mode", async () => {
      const { onSpoileredFilesChange } = await spoilerSetup({
        viewModeEnabled: true,
      });
      clickCanvasAt(buttonPoint("img-a"));
      expect(visibility(A)).toBe("shown");
      expect(onSpoileredFilesChange).toHaveBeenCalledTimes(1);
    });

    it("does nothing when the editor takes no input", async () => {
      await spoilerSetup({ interaction: false } as any);
      clickCanvasAt(buttonPoint("img-a"));
      expect(visibility(A)).toBe("hidden");
    });
  });

  describe("press and release", () => {
    it("ignores a click event with no pointer down on the button", async () => {
      await spoilerSetup();
      clickEventOnlyAt(buttonPoint("img-a"));
      expect(visibility(A)).toBe("hidden");
    });

    it("shows the file when the pointer moves less than the drag threshold", async () => {
      await spoilerSetup();
      const start = buttonPoint("img-a", 0.5, 0.5);
      dragAndClick(start, { x: start.x + 4, y: start.y + 3 });
      expect(visibility(A)).toBe("shown");
    });

    it("does not show the file after a drag inside the button", async () => {
      await spoilerSetup();
      dragAndClick(
        buttonPoint("img-a", 0.1, 0.5),
        buttonPoint("img-a", 0.9, 0.5),
      );
      expect(visibility(A)).toBe("hidden");
    });

    it("does not show the file after a view-mode pan that starts and ends on the button", async () => {
      const { onSpoileredFilesChange } = await spoilerSetup({
        viewModeEnabled: true,
      });
      const start = toClient(buttonPoint("img-a"));
      const scrollX = h.state.scrollX;
      mouse.downAt(start.x, start.y);
      mouse.moveTo(start.x + 30, start.y);
      mouse.moveTo(start.x + 60, start.y);
      mouse.upAt(start.x + 60, start.y);
      // the canvas moved with the pointer, so the release is on the button
      expect(h.state.scrollX).not.toBe(scrollX);
      expect(toClient(buttonPoint("img-a")).x).toBeCloseTo(start.x + 60);
      fireEvent.click(GlobalTestState.interactiveCanvas, {
        button: 0,
        clientX: start.x + 60,
        clientY: start.y,
      });
      expect(visibility(A)).toBe("hidden");
      expect(onSpoileredFilesChange).not.toHaveBeenCalled();
    });

    it("does not show the file after a hand tool pan that starts and ends on the button", async () => {
      await spoilerSetup();
      act(() => h.app.setActiveTool({ type: "hand" }));
      const start = toClient(buttonPoint("img-a"));
      const scrollX = h.state.scrollX;
      mouse.downAt(start.x, start.y);
      mouse.moveTo(start.x + 30, start.y);
      mouse.moveTo(start.x + 60, start.y);
      mouse.upAt(start.x + 60, start.y);
      expect(h.state.scrollX).not.toBe(scrollX);
      fireEvent.click(GlobalTestState.interactiveCanvas, {
        button: 0,
        clientX: start.x + 60,
        clientY: start.y,
      });
      expect(visibility(A)).toBe("hidden");
    });

    it("still shows the file on a plain click in view mode", async () => {
      await spoilerSetup({ viewModeEnabled: true });
      clickCanvasAt(buttonPoint("img-a"));
      expect(visibility(A)).toBe("shown");
    });

    it("does not show the file after a box selection that ends on the button", async () => {
      await spoilerSetup();
      dragAndClick({ x: 40, y: 40 }, buttonPoint("img-a"));
      expect(visibility(A)).toBe("hidden");
    });

    it("does not show a file when the press is on button A and the release on button B", async () => {
      await spoilerSetup();
      const b = API.createElement({
        type: "image",
        id: "img-b",
        fileId: B,
        x: 600,
        y: 100,
        width: 400,
        height: 300,
        status: "saved",
      });
      API.setElements([getLatest("img-a"), b]);
      mark(B);
      dragAndClick(buttonPoint("img-a"), buttonPoint("img-b"));
      expect(visibility(A)).toBe("hidden");
      expect(visibility(B)).toBe("hidden");
    });

    it("does not show the file when the press is on the blur and the release on the button", async () => {
      await spoilerSetup();
      dragAndClick({ x: 120, y: 120 }, buttonPoint("img-a"));
      expect(visibility(A)).toBe("hidden");
    });

    it("forgets the press after the click", async () => {
      await spoilerSetup();
      const point = buttonPoint("img-a");
      clickCanvasAt(point);
      setOne(A, "hidden");
      // a second click event with no new press
      clickEventOnlyAt(point);
      expect(visibility(A)).toBe("hidden");
    });
  });

  describe("double-click", () => {
    let executeAction: ReturnType<typeof vi.spyOn>;
    afterEach(() => {
      executeAction?.mockRestore();
    });

    const smartZoomCalls = () =>
      executeAction.mock.calls.filter(
        ([action]: any[]) => action.name === "smartZoom",
      );

    /** the events of a browser double-click at one point */
    const doubleClickAt = (point: { x: number; y: number }) => {
      clickCanvasAt(point);
      clickCanvasAt(point);
      const { x, y } = toClient(point);
      fireEvent.doubleClick(GlobalTestState.interactiveCanvas, {
        clientX: x,
        clientY: y,
      });
    };

    it.each([
      ["edit mode", {}],
      ["view mode", { viewModeEnabled: true }],
    ] as const)(
      "does nothing to the image whose file a click of it showed (%s)",
      async (_, props) => {
        await spoilerSetup(props);
        executeAction = vi.spyOn(h.app.actionManager, "executeAction");
        const zoom = h.state.zoom.value;
        doubleClickAt(buttonPoint("img-a"));
        expect(visibility(A)).toBe("shown");
        expect(smartZoomCalls()).toHaveLength(0);
        expect(h.state.zoom.value).toBe(zoom);
        expect(h.state.croppingElementId).toBe(null);
        expect(h.state.editingTextElement).toBe(null);
      },
    );

    it("smart-zooms a shown image on a later double-click", async () => {
      await spoilerSetup({ viewModeEnabled: true });
      const point = buttonPoint("img-a");
      clickCanvasAt(point);
      expect(visibility(A)).toBe("shown");
      const now = performance.now();
      const clock = vi.spyOn(performance, "now").mockReturnValue(now + 2000);
      executeAction = vi.spyOn(h.app.actionManager, "executeAction");
      const { x, y } = toClient(point);
      fireEvent.doubleClick(GlobalTestState.interactiveCanvas, {
        clientX: x,
        clientY: y,
      });
      clock.mockRestore();
      expect(smartZoomCalls()).toHaveLength(1);
    });

    it("smart-zooms an unmarked image on a double-click at the same point", async () => {
      await spoilerSetup({ viewModeEnabled: true });
      const point = buttonPoint("img-a");
      mark(A, false);
      executeAction = vi.spyOn(h.app.actionManager, "executeAction");
      doubleClickAt(point);
      expect(smartZoomCalls()).toHaveLength(1);
    });

    it("smart-zooms another image soon after a reveal", async () => {
      await spoilerSetup({ viewModeEnabled: true });
      const other = API.createElement({
        type: "image",
        id: "img-b",
        fileId: B,
        x: 600,
        y: 100,
        width: 400,
        height: 300,
        status: "saved",
      });
      API.setElements([getLatest("img-a"), other]);
      clickCanvasAt(buttonPoint("img-a"));
      executeAction = vi.spyOn(h.app.actionManager, "executeAction");
      const { x, y } = toClient({ x: 800, y: 250 });
      fireEvent.doubleClick(GlobalTestState.interactiveCanvas, {
        clientX: x,
        clientY: y,
      });
      expect(smartZoomCalls()).toHaveLength(1);
    });
  });

  // 1.3.7
  describe("drag", () => {
    it("does not move the element when the drag starts on the button", async () => {
      await spoilerSetup();
      const start = toClient(buttonPoint("img-a"));
      mouse.downAt(start.x, start.y);
      mouse.moveTo(start.x + 120, start.y + 80);
      mouse.upAt(start.x + 120, start.y + 80);
      const element = getLatest("img-a");
      expect([element.x, element.y]).toEqual([100, 100]);
      expect(h.state.selectedElementIds).toEqual({ "img-a": true });
    });

    it("does not move a selected element when the drag starts on the button", async () => {
      await spoilerSetup();
      select(getLatest("img-a"));
      const start = toClient(buttonPoint("img-a"));
      mouse.downAt(start.x, start.y);
      mouse.moveTo(start.x - 60, start.y + 40);
      mouse.upAt();
      const element = getLatest("img-a");
      expect([element.x, element.y]).toEqual([100, 100]);
      expect(element.width).toBe(400);
      expect(element.height).toBe(300);
    });

    it("moves the element when the drag starts on the blur", async () => {
      await spoilerSetup();
      const start = toClient({ x: 130, y: 130 });
      mouse.downAt(start.x, start.y);
      mouse.moveTo(start.x + 120, start.y + 80);
      mouse.upAt();
      const element = getLatest("img-a");
      expect([element.x, element.y]).toEqual([220, 180]);
    });

    it("moves the element from the button position once the file is shown", async () => {
      await spoilerSetup();
      const point = buttonPoint("img-a");
      setOne(A, "shown");
      const start = toClient(point);
      mouse.downAt(start.x, start.y);
      mouse.moveTo(start.x + 50, start.y + 50);
      mouse.upAt();
      expect(getLatest("img-a").x).toBe(150);
    });

    it("allows the next drag from the blur after a blocked drag", async () => {
      await spoilerSetup();
      const start = toClient(buttonPoint("img-a"));
      mouse.downAt(start.x, start.y);
      mouse.moveTo(start.x + 50, start.y);
      mouse.upAt();
      const blur = toClient({ x: 130, y: 130 });
      mouse.downAt(blur.x, blur.y);
      mouse.moveTo(blur.x + 50, blur.y);
      mouse.upAt();
      expect(getLatest("img-a").x).toBe(150);
    });
  });

  describe("off screen", () => {
    let renderStaticScene: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
      renderStaticScene = vi.spyOn(StaticScene, "renderStaticScene");
    });
    afterEach(() => {
      renderStaticScene.mockRestore();
    });

    const lastVisibleIds = () =>
      (
        renderStaticScene.mock.lastCall![0] as {
          visibleElements: readonly ExcalidrawElement[];
        }
      ).visibleElements.map((element) => element.id);

    // 1.3.8
    it("draws nothing and ignores a click at the old position when panned out", async () => {
      const { onSpoileredFilesChange } = await spoilerSetup();
      const oldClient = toClient(buttonPoint("img-a"));
      act(() => API.setAppState({ scrollX: -5000, scrollY: 0 }));
      await nextFrame();
      expect(lastVisibleIds()).not.toContain("img-a");
      clickClientAt(oldClient.x, oldClient.y);
      expect(visibility(A)).toBe("hidden");
      expect(onSpoileredFilesChange).not.toHaveBeenCalled();
    });

    it("shows the button again when panned back", async () => {
      await spoilerSetup();
      act(() => API.setAppState({ scrollX: -5000 }));
      act(() => API.setAppState({ scrollX: 0 }));
      await nextFrame();
      expect(lastVisibleIds()).toContain("img-a");
      clickCanvasAt(buttonPoint("img-a"));
      expect(visibility(A)).toBe("shown");
    });

    // 1.3.9
    describe("partly off screen", () => {
      // the element centre (300, 250) is at the left viewport edge
      const panCentreToLeftEdge = () =>
        act(() =>
          API.setAppState({ scrollX: -300 - h.state.offsetLeft, scrollY: 0 }),
        );

      it("keeps the button at the element centre, cut at the edge", async () => {
        await spoilerSetup();
        panCentreToLeftEdge();
        await nextFrame();
        expect(lastVisibleIds()).toContain("img-a");
        const left = toClient(buttonPoint("img-a", 0, 0.5));
        const right = toClient(buttonPoint("img-a", 1, 0.5));
        // the button crosses the edge
        expect(left.x).toBeLessThan(h.state.offsetLeft);
        expect(right.x).toBeGreaterThan(h.state.offsetLeft);
        // the element canvas holds the whole button: the canvas edge cuts it
        expect(
          elementWithCanvasCache.get(getLatest("img-a"))?.spoilerOverlayKey,
        ).not.toBe(null);
      });

      it("shows the image on a click on the visible part", async () => {
        await spoilerSetup();
        panCentreToLeftEdge();
        clickCanvasAt(buttonPoint("img-a", 0.9, 0.5));
        expect(visibility(A)).toBe("shown");
      });

      it("does not clamp the button into the viewport", async () => {
        await spoilerSetup();
        panCentreToLeftEdge();
        const element = getLatest("img-a");
        const { button } = getSpoilerButtonRect(element, 1, LABEL);
        // where a clamped button would start: at the viewport edge
        const clampedRight = toClient(buttonPoint("img-a", 0.5, 0.5));
        const { x, y } = {
          x: clampedRight.x + button!.width * 0.75,
          y: clampedRight.y,
        };
        clickClientAt(x, y);
        expect(visibility(A)).toBe("hidden");
      });
    });
  });

  // 1.3.10
  describe("anchored to the element", () => {
    /** the old button centre misses, the new one hits */
    const expectButtonMoved = (oldPoint: { x: number; y: number }) => {
      const element = getLatest("img-a");
      // the element canvas holds the overlay, so image and button draw in
      // one blit, in the same frame
      expect(elementWithCanvasCache.get(element)?.spoilerOverlayKey).not.toBe(
        null,
      );
      clickCanvasAt(oldPoint);
      expect(visibility(A)).toBe("hidden");
      clickCanvasAt(buttonPoint("img-a"));
      expect(visibility(A)).toBe("shown");
    };

    /** the old button position in client space, mapped to the scene now */
    const oldClientPoint = () => {
      const client = toClient(buttonPoint("img-a"));
      return () =>
        viewportCoordsToSceneCoords(
          { clientX: client.x, clientY: client.y },
          h.state,
        );
    };

    it("after a pan", async () => {
      await spoilerSetup();
      const old = oldClientPoint();
      act(() => API.setAppState({ scrollX: 200, scrollY: 150 }));
      await nextFrame();
      expectButtonMoved(old());
    });

    it("after a zoom", async () => {
      await spoilerSetup();
      const old = oldClientPoint();
      act(() => API.setAppState({ zoom: { value: 2 as any } }));
      await nextFrame();
      expectButtonMoved(old());
    });

    it("after an element drag", async () => {
      await spoilerSetup();
      const old = buttonPoint("img-a");
      const start = toClient({ x: 130, y: 130 });
      mouse.downAt(start.x, start.y);
      mouse.moveTo(start.x + 200, start.y + 120);
      mouse.upAt();
      await nextFrame();
      expect(getLatest("img-a").x).toBe(300);
      expectButtonMoved(old);
    });

    it("after a resize", async () => {
      await spoilerSetup();
      const old = buttonPoint("img-a");
      API.updateElement(getLatest("img-a"), { width: 800, height: 600 });
      await nextFrame();
      expectButtonMoved(old);
    });

    it("after a rotation", async () => {
      await spoilerSetup();
      const old = buttonPoint("img-a");
      API.updateElement(getLatest("img-a"), { angle: (Math.PI / 2) as any });
      await nextFrame();
      expectButtonMoved(old);
    });

    it("after an undo", async () => {
      await setup();
      const image = API.createElement({
        type: "image",
        id: "img-a",
        fileId: A,
        x: 100,
        y: 100,
        width: 400,
        height: 300,
        status: "saved",
      });
      // both changes go to history, so the undo reverts the move only
      act(() => {
        h.app.updateScene({
          elements: [image],
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
      });
      mark(A);
      act(() => {
        h.app.updateScene({
          elements: [newElementWith(getLatest("img-a"), { x: 300, y: 180 })],
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
      });
      const moved = buttonPoint("img-a");
      Keyboard.undo();
      await nextFrame();
      expect(getLatest("img-a").x).toBe(100);
      expect(getLatest("img-a").isDeleted).toBe(false);
      expectButtonMoved(moved);
    });

    it("makes a new element canvas with the overlay after a resize", async () => {
      await spoilerSetup();
      await nextFrame();
      const before = elementWithCanvasCache.get(getLatest("img-a"));
      API.updateElement(getLatest("img-a"), { width: 800 });
      await nextFrame();
      const after = elementWithCanvasCache.get(getLatest("img-a"));
      expect(after).toBeDefined();
      expect(after).not.toBe(before);
      expect(after!.spoilerOverlayKey).not.toBe(null);
    });
  });

  // 1.3.11 (unit part; e2e proves the real DOM stacking)
  describe("under UI", () => {
    it("a click on a UI element over the button area does not show the image", async () => {
      await spoilerSetup();
      const { x, y } = toClient(buttonPoint("img-a"));
      const ui = document.querySelector(".App-toolbar") as HTMLElement;
      expect(ui).not.toBeNull();
      fireEvent.pointerDown(ui, { clientX: x, clientY: y });
      fireEvent.pointerUp(ui, { clientX: x, clientY: y });
      fireEvent.click(ui, { button: 0, clientX: x, clientY: y });
      expect(visibility(A)).toBe("hidden");
    });
  });

  // 1.3.12
  describe("under elements on top", () => {
    const addRectangleOverLeftHalf = (opts: Record<string, unknown> = {}) => {
      const left = buttonPoint("img-a", 0, 0);
      const middle = buttonPoint("img-a", 0.5, 1);
      const rectangle = API.createElement({
        type: "rectangle",
        id: "rect",
        x: left.x - 20,
        y: left.y - 20,
        width: middle.x - left.x + 20,
        height: middle.y - left.y + 40,
        backgroundColor: "#ff0000",
        fillStyle: "solid",
        ...opts,
      });
      API.setElements([getLatest("img-a"), rectangle]);
      return rectangle;
    };

    it("a click on the covered part goes to the element on top", async () => {
      const { onSpoileredFilesChange } = await spoilerSetup();
      addRectangleOverLeftHalf();
      clickCanvasAt(buttonPoint("img-a", 0.2, 0.5));
      expect(visibility(A)).toBe("hidden");
      expect(onSpoileredFilesChange).not.toHaveBeenCalled();
      expect(h.state.selectedElementIds).toEqual({ rect: true });
    });

    it("a click on the visible part shows the image", async () => {
      await spoilerSetup();
      addRectangleOverLeftHalf();
      clickCanvasAt(buttonPoint("img-a", 0.8, 0.5));
      expect(visibility(A)).toBe("shown");
    });

    it("an unfilled shape on top does not block the button inside its outline", async () => {
      await spoilerSetup();
      const image = getLatest("img-a");
      const outline = API.createElement({
        type: "rectangle",
        id: "outline",
        x: image.x + 20,
        y: image.y + 20,
        width: image.width - 40,
        height: image.height - 40,
        backgroundColor: "transparent",
      });
      API.setElements([image, outline]);
      clickCanvasAt(buttonPoint("img-a"));
      expect(visibility(A)).toBe("shown");
    });

    it("an element below the image does not block the button", async () => {
      await spoilerSetup();
      const image = getLatest("img-a");
      const below = API.createElement({
        type: "rectangle",
        id: "below",
        x: image.x,
        y: image.y,
        width: image.width,
        height: image.height,
        backgroundColor: "#ff0000",
        fillStyle: "solid",
      });
      API.setElements([below, image]);
      clickCanvasAt(buttonPoint("img-a"));
      expect(visibility(A)).toBe("shown");
    });

    it("a hidden image on top of another hidden image takes the click", async () => {
      await spoilerSetup();
      const lower = getLatest("img-a");
      const upper = API.createElement({
        type: "image",
        id: "img-b",
        fileId: B,
        x: lower.x,
        y: lower.y,
        width: lower.width,
        height: lower.height,
        status: "saved",
      });
      API.setElements([lower, upper]);
      mark(B);
      clickCanvasAt(buttonPoint("img-a"));
      expect(visibility(B)).toBe("shown");
      expect(visibility(A)).toBe("hidden");
    });

    it("paints the elements on top after the image and its button", async () => {
      const drawImage = vi.spyOn(
        CanvasRenderingContext2D.prototype,
        "drawImage",
      );
      await spoilerSetup();
      addRectangleOverLeftHalf();
      await nextFrame();
      const imageCanvas = elementWithCanvasCache.get(
        getLatest("img-a"),
      )!.canvas;
      const rectCanvas = elementWithCanvasCache.get(
        h.app.scene.getElement("rect")!,
      )!.canvas;
      const sources = drawImage.mock.calls.map((args) => args[0]);
      const lastImage = sources.lastIndexOf(imageCanvas);
      const lastRect = sources.lastIndexOf(rectCanvas);
      expect(lastImage).toBeGreaterThan(-1);
      expect(lastRect).toBeGreaterThan(lastImage);
      drawImage.mockRestore();
    });
  });

  // 1.3.13
  describe("hover", () => {
    const hoveredId = () => h.app.getHoveredSpoilerElementId();
    const cursor = () => GlobalTestState.interactiveCanvas.style.cursor;

    it("highlights the button and sets the pointer cursor on enter", async () => {
      await spoilerSetup();
      await nextFrame();
      const normal = elementWithCanvasCache.get(getLatest("img-a"));
      hoverAt(buttonPoint("img-a"));
      expect(hoveredId()).toBe("img-a");
      expect(cursor()).toBe("pointer");
      await nextFrame();
      const hovered = elementWithCanvasCache.get(getLatest("img-a"));
      expect(hovered).not.toBe(normal);
      expect(hovered!.spoilerOverlayKey).toBe(`1|0|${LABEL}`);
    });

    it("keeps the pointer cursor on a selected image", async () => {
      await spoilerSetup();
      select(getLatest("img-a"));
      hoverAt(buttonPoint("img-a"));
      expect(cursor()).toBe("pointer");
    });

    it("sets the pointer cursor in view mode", async () => {
      await spoilerSetup({ viewModeEnabled: true });
      hoverAt(buttonPoint("img-a"));
      expect(hoveredId()).toBe("img-a");
      expect(cursor()).toBe("pointer");
      hoverAt({ x: 120, y: 120 });
      expect(hoveredId()).toBe(null);
      expect(cursor()).toBe("grab");
    });

    it("draws the normal colour and cursor again on leave", async () => {
      await spoilerSetup();
      hoverAt(buttonPoint("img-a"));
      await nextFrame();
      hoverAt({ x: 120, y: 120 });
      expect(hoveredId()).toBe(null);
      expect(cursor()).not.toBe("pointer");
      await nextFrame();
      expect(
        elementWithCanvasCache.get(getLatest("img-a"))!.spoilerOverlayKey,
      ).toBe(`0|0|${LABEL}`);
    });

    it("ends the hover when the pointer leaves the canvas", async () => {
      await spoilerSetup();
      hoverAt(buttonPoint("img-a"));
      fireEvent.pointerLeave(GlobalTestState.interactiveCanvas);
      expect(hoveredId()).toBe(null);
    });

    it("ends the hover when the pointer moves onto an element above the button", async () => {
      await spoilerSetup();
      const image = getLatest("img-a");
      const left = buttonPoint("img-a", 0, 0);
      const rectangle = API.createElement({
        type: "rectangle",
        id: "rect",
        x: left.x - 10,
        y: left.y - 10,
        width: 40,
        height: 60,
        backgroundColor: "#ff0000",
        fillStyle: "solid",
      });
      API.setElements([image, rectangle]);
      hoverAt(buttonPoint("img-a", 0.8, 0.5));
      expect(hoveredId()).toBe("img-a");
      hoverAt(buttonPoint("img-a", 0.05, 0.5));
      expect(hoveredId()).toBe(null);
      expect(cursor()).not.toBe("pointer");
    });

    it("does not hover the button of a small image", async () => {
      await spoilerSetup({}, { width: 56, height: 44 } as any);
      hoverAt({ x: 128, y: 122 });
      expect(hoveredId()).toBe(null);
    });

    it("does not hover the button of a shown file", async () => {
      await spoilerSetup();
      const point = buttonPoint("img-a");
      setOne(A, "shown");
      hoverAt(point);
      expect(hoveredId()).toBe(null);
      expect(cursor()).not.toBe("pointer");
    });

    it("ends the hover when the button is clicked", async () => {
      await spoilerSetup();
      hoverAt(buttonPoint("img-a"));
      clickCanvasAt(buttonPoint("img-a"));
      expect(hoveredId()).toBe(null);
    });

    it("does not hover while an element is dragged over the button", async () => {
      await spoilerSetup();
      const rectangle = API.createElement({
        type: "rectangle",
        id: "rect",
        x: 600,
        y: 100,
        width: 50,
        height: 50,
        backgroundColor: "#ff0000",
        fillStyle: "solid",
      });
      API.setElements([getLatest("img-a"), rectangle]);
      const start = toClient({ x: 625, y: 125 });
      mouse.downAt(start.x, start.y);
      const target = toClient(buttonPoint("img-a", 0.9, 0.5));
      mouse.moveTo(target.x, target.y);
      expect(hoveredId()).toBe(null);
      mouse.upAt();
    });

    describe("repaint", () => {
      let renderStaticScene: ReturnType<typeof vi.spyOn>;
      let trigger: ReturnType<typeof vi.spyOn>;
      beforeEach(() => {
        renderStaticScene = vi.spyOn(StaticScene, "renderStaticScene");
      });
      afterEach(() => {
        renderStaticScene.mockRestore();
        trigger?.mockRestore();
      });

      it("repaints once on enter and once on leave, and not for moves inside", async () => {
        await spoilerSetup();
        await nextFrame();
        trigger = vi.spyOn(h.app.imagePlaceholderUpdateEmitter, "trigger");

        hoverAt(buttonPoint("img-a", 0.5, 0.5));
        expect(trigger).toHaveBeenCalledTimes(1);
        await nextFrame();
        const afterEnter = renderStaticScene.mock.calls.length;
        expect(afterEnter).toBeGreaterThan(0);
        const hoveredCanvas = elementWithCanvasCache.get(getLatest("img-a"));

        for (const [fx, fy] of [
          [0.2, 0.3],
          [0.8, 0.7],
          [0.1, 0.5],
          [0.95, 0.2],
        ]) {
          hoverAt(buttonPoint("img-a", fx, fy));
        }
        await nextFrame();
        expect(trigger).toHaveBeenCalledTimes(1);
        expect(renderStaticScene.mock.calls.length).toBe(afterEnter);
        expect(elementWithCanvasCache.get(getLatest("img-a"))).toBe(
          hoveredCanvas,
        );

        hoverAt({ x: 120, y: 120 });
        expect(trigger).toHaveBeenCalledTimes(2);
        await nextFrame();
        expect(renderStaticScene.mock.calls.length).toBe(afterEnter + 1);
      });

      it("does not repaint for moves on the blur", async () => {
        await spoilerSetup();
        await nextFrame();
        trigger = vi.spyOn(h.app.imagePlaceholderUpdateEmitter, "trigger");
        renderStaticScene.mockClear();
        hoverAt({ x: 120, y: 120 });
        hoverAt({ x: 140, y: 130 });
        hoverAt({ x: 400, y: 350 });
        await nextFrame();
        expect(trigger).not.toHaveBeenCalled();
        expect(renderStaticScene).not.toHaveBeenCalled();
      });

      it("repaints when the pointer moves from one button to another", async () => {
        await spoilerSetup();
        const copy = API.createElement({
          type: "image",
          id: "img-b",
          fileId: A,
          x: 600,
          y: 100,
          width: 400,
          height: 300,
          status: "saved",
        });
        API.setElements([getLatest("img-a"), copy]);
        trigger = vi.spyOn(h.app.imagePlaceholderUpdateEmitter, "trigger");
        hoverAt(buttonPoint("img-a"));
        hoverAt(buttonPoint("img-b"));
        expect(hoveredId()).toBe("img-b");
        expect(trigger).toHaveBeenCalledTimes(2);
      });

      it("keeps the element canvas of a second hidden image on hover", async () => {
        await spoilerSetup();
        const copy = API.createElement({
          type: "image",
          id: "img-b",
          fileId: A,
          x: 600,
          y: 100,
          width: 400,
          height: 300,
          status: "saved",
        });
        API.setElements([getLatest("img-a"), copy]);
        await nextFrame();
        const other = elementWithCanvasCache.get(getLatest("img-b"));
        expect(other).toBeDefined();
        hoverAt(buttonPoint("img-a"));
        await nextFrame();
        expect(elementWithCanvasCache.get(getLatest("img-b"))).toBe(other);
      });
    });
  });
});

// 1.5 export: `spoileredFileIds` draws the ThumbHash blur (or a grey box) in
// place of the image. No button, no icon. Without it, exports draw the image.
describe("export with spoileredFileIds", () => {
  const REAL_URL = {
    [A]: "data:image/png;base64,REALFILEAAAA",
    [B]: "data:image/png;base64,REALFILEBBBB",
    [C]: "data:image/png;base64,REALFILECCCC",
  } as Record<FileId, string>;

  const createThumbHash = (shade: number) =>
    btoa(
      String.fromCharCode(
        ...rgbaToThumbHash(32, 24, new Uint8Array(32 * 24 * 4).fill(shade)),
      ),
    );
  const HASH_A = createThumbHash(40);
  const HASH_B = createThumbHash(120);
  const HASH_C = createThumbHash(200);

  const HASH: Record<string, string> = {
    [A]: HASH_A,
    [B]: HASH_B,
    [C]: HASH_C,
  };

  const createFiles = (ids: FileId[] = [A, B, C]) =>
    Object.fromEntries(
      ids.map((id) => [
        id,
        {
          id,
          mimeType: MIME_TYPES.png,
          dataURL: REAL_URL[id] as DataURL,
          created: 1,
        },
      ]),
    ) as BinaryFiles;

  const createImage = (
    id: string,
    fileId: FileId | null,
    x: number,
    opts: { thumbHash?: string | null } = {},
  ) => {
    const image = API.createElement({
      type: "image",
      id,
      fileId: fileId as string,
      x,
      y: 0,
      width: 200,
      height: 100,
      status: "saved",
    });
    const thumbHash =
      opts.thumbHash === undefined
        ? fileId
          ? HASH[fileId]
          : null
        : opts.thumbHash;
    return newElementWith(image, { thumbHash } as Partial<typeof image>);
  };

  const exportAppState = {
    exportBackground: true,
    viewBackgroundColor: "#ffffff",
    exportPadding: 10,
  };

  let drawImage: ReturnType<typeof vi.spyOn>;
  let fillText: ReturnType<typeof vi.spyOn>;
  let stroke: ReturnType<typeof vi.spyOn>;
  let fillRect: ReturnType<typeof vi.spyOn>;
  const originalSrc = Object.getOwnPropertyDescriptor(
    HTMLImageElement.prototype,
    "src",
  );

  beforeEach(() => {
    // jsdom does not load images: a data URL loads at once, with a size
    Object.defineProperty(HTMLImageElement.prototype, "src", {
      configurable: true,
      get() {
        return this.__src ?? "";
      },
      set(value: string) {
        this.__src = value;
        Object.defineProperty(this, "naturalWidth", {
          value: 400,
          configurable: true,
        });
        Object.defineProperty(this, "naturalHeight", {
          value: 200,
          configurable: true,
        });
        queueMicrotask(() => this.onload?.(new Event("load")));
      },
    });
    // the canvas mock binds prototype methods when a context is made, so the
    // spies must exist before the export makes its canvas
    drawImage = vi.spyOn(CanvasRenderingContext2D.prototype, "drawImage");
    fillText = vi.spyOn(CanvasRenderingContext2D.prototype, "fillText");
    stroke = vi.spyOn(CanvasRenderingContext2D.prototype, "stroke");
    fillRect = vi.spyOn(CanvasRenderingContext2D.prototype, "fillRect");
  });

  afterEach(() => {
    if (originalSrc) {
      Object.defineProperty(HTMLImageElement.prototype, "src", originalSrc);
    }
    vi.restoreAllMocks();
  });

  /** the source of every drawImage call, as a file id (real image), a hash
   * (blur) or "other" */
  const getDrawn = () =>
    drawImage.mock.calls.map((args: unknown[]) => {
      const source = args[0];
      if (source instanceof HTMLImageElement) {
        const file = (Object.keys(REAL_URL) as FileId[]).find(
          (id) => REAL_URL[id] === source.src,
        );
        return file ? `real:${file}` : "other";
      }
      for (const id of [A, B, C]) {
        if (source === getThumbHashPlaceholder(HASH[id])) {
          return `blur:${id}`;
        }
      }
      return "other";
    });

  const expectNoOverlay = () => {
    expect(fillText).not.toHaveBeenCalled();
    expect(
      stroke.mock.calls.filter((args: unknown[]) => args[0] instanceof Path2D),
    ).toHaveLength(0);
    expect(getDrawn()).not.toContain("other");
  };

  describe.each([
    [
      "scene exportToCanvas",
      (
        elements: ExcalidrawElement[],
        files: BinaryFiles,
        spoileredFileIds?: FileId[],
      ) =>
        exportToCanvasScene(
          elements as never,
          { ...h.state, exportScale: 1 },
          files,
          {
            exportBackground: true,
            viewBackgroundColor: "#ffffff",
            spoileredFileIds,
          },
        ),
    ],
    [
      "utils exportToCanvas",
      (
        elements: ExcalidrawElement[],
        files: BinaryFiles,
        spoileredFileIds?: FileId[],
      ) =>
        exportToCanvasUtils({
          elements: elements as never,
          appState: exportAppState,
          files,
          spoileredFileIds,
        }),
    ],
    [
      "utils exportToBlob",
      (
        elements: ExcalidrawElement[],
        files: BinaryFiles,
        spoileredFileIds?: FileId[],
      ) =>
        exportToBlobUtils({
          elements: elements as never,
          appState: exportAppState,
          files,
          spoileredFileIds,
        }),
    ],
  ])("%s", (_name, run) => {
    beforeEach(async () => {
      await render(<Excalidraw />);
    });

    // 1.5.1
    it("blurs the listed files only", async () => {
      const elements = [
        createImage("a", A, 0),
        createImage("b", B, 300),
        createImage("c", C, 600),
      ];
      await run(elements, createFiles(), [A, C]);
      expect(getDrawn().sort()).toEqual([
        "blur:file-a",
        "blur:file-c",
        "real:file-b",
      ]);
      expectNoOverlay();
    });

    it("does not decode the image of a listed file", async () => {
      const elements = [createImage("a", A, 0), createImage("b", B, 300)];
      await run(elements, createFiles(), [A]);
      expect(getDrawn()).not.toContain("real:file-a");
    });

    it("blurs with the grey box when the element has no ThumbHash", async () => {
      const elements = [
        createImage("a", A, 0, { thumbHash: null }),
        createImage("b", B, 300),
      ];
      await run(elements, createFiles(), [A]);
      const drawn = getDrawn();
      expect(drawn).not.toContain("real:file-a");
      expect(drawn).toContain("real:file-b");
      expect(fillText).not.toHaveBeenCalled();
      // the grey box covers the element
      expect(
        fillRect.mock.calls.some(
          (args: unknown[]) =>
            args[0] === 0 &&
            args[1] === 0 &&
            args[2] === 200 &&
            args[3] === 100,
        ),
      ).toBe(true);
    });

    it("ignores an id that is not in the scene", async () => {
      const elements = [createImage("b", B, 0)];
      await run(elements, createFiles([B]), ["not-in-scene" as FileId]);
      expect(getDrawn()).toEqual(["real:file-b"]);
      expectNoOverlay();
    });

    it("blurs both elements of one file id", async () => {
      const elements = [
        createImage("a1", A, 0),
        createImage("a2", A, 300),
        createImage("b", B, 600),
      ];
      await run(elements, createFiles(), [A]);
      const drawn = getDrawn();
      expect(drawn.filter((x) => x === "blur:file-a")).toHaveLength(2);
      expect(drawn.filter((x) => x === "real:file-b")).toHaveLength(1);
      expect(drawn.filter((x) => x === "real:file-a")).toHaveLength(0);
    });

    it("draws real images for an empty list", async () => {
      const elements = [createImage("a", A, 0), createImage("b", B, 300)];
      await run(elements, createFiles(), []);
      expect(getDrawn().sort()).toEqual(["real:file-a", "real:file-b"]);
      expectNoOverlay();
    });

    it("draws real images without the option", async () => {
      const elements = [createImage("a", A, 0), createImage("b", B, 300)];
      await run(elements, createFiles());
      expect(getDrawn().sort()).toEqual(["real:file-a", "real:file-b"]);
      expectNoOverlay();
    });

    // 1.5.3
    it("draws real images when the App has hidden files", async () => {
      mark(A);
      mark(B);
      expect(h.app.api.getSpoileredFiles().get(A)).toBe("hidden");
      const elements = [createImage("a", A, 0), createImage("b", B, 300)];
      await run(elements, createFiles());
      expect(getDrawn().sort()).toEqual(["real:file-a", "real:file-b"]);
      expectNoOverlay();
    });

    it("blurs a listed file whether or not the App hides it", async () => {
      mark(B);
      const elements = [createImage("a", A, 0), createImage("b", B, 300)];
      await run(elements, createFiles(), [A]);
      expect(getDrawn().sort()).toEqual(["blur:file-a", "real:file-b"]);
    });

    it("does not change the App map", async () => {
      mark(A);
      setOne(A, "shown");
      const elements = [createImage("a", A, 0)];
      await run(elements, createFiles(), [A, B]);
      expect([...h.app.api.getSpoileredFiles()]).toEqual([[A, "shown"]]);
    });

    it("draws the blur of a cropped image with the crop", async () => {
      const crop = {
        x: 100,
        y: 50,
        width: 200,
        height: 100,
        naturalWidth: 400,
        naturalHeight: 200,
      };
      const cropped = newElementWith(createImage("a", A, 0), { crop });
      await run([cropped], createFiles(), [A]);
      const blur = getThumbHashPlaceholder(HASH_A)!;
      const call = drawImage.mock.calls.find(
        (args: unknown[]) => args[0] === blur,
      )!;
      expect(call).toBeDefined();
      // source rect: the crop, scaled to the size of the blur
      expect(call[1]).toBeCloseTo((100 / 400) * blur.width);
      expect(call[2]).toBeCloseTo((50 / 200) * blur.height);
      expect(call[3]).toBeCloseTo((200 / 400) * blur.width);
      expect(call[4]).toBeCloseTo((100 / 200) * blur.height);
      expectNoOverlay();
    });
  });

  describe("scene exportToCanvas with other options", () => {
    beforeEach(async () => {
      await render(<Excalidraw />);
    });

    it("draws no overlay on a small image", async () => {
      const small = newElementWith(createImage("a", A, 0), {
        width: 20,
        height: 10,
      });
      await exportToCanvasScene(
        [small] as never,
        { ...h.state, exportScale: 2 },
        createFiles(),
        {
          exportBackground: false,
          viewBackgroundColor: "#ffffff",
          spoileredFileIds: [A],
        },
      );
      expect(getDrawn()).toEqual(["blur:file-a"]);
      expectNoOverlay();
    });

    it("draws no overlay in the dark theme", async () => {
      await exportToCanvasScene(
        [createImage("a", A, 0)] as never,
        { ...h.state, exportScale: 1, exportWithDarkMode: true },
        createFiles(),
        {
          exportBackground: false,
          viewBackgroundColor: "#ffffff",
          spoileredFileIds: [A],
        },
      );
      expect(getDrawn()).toEqual(["blur:file-a"]);
      expectNoOverlay();
    });

    it("draws the real image of a file with no ThumbHash and no listing", async () => {
      await exportToCanvasScene(
        [createImage("a", A, 0, { thumbHash: null })] as never,
        { ...h.state, exportScale: 1 },
        createFiles(),
        { exportBackground: false, viewBackgroundColor: "#ffffff" },
      );
      expect(getDrawn()).toEqual(["real:file-a"]);
    });
  });

  describe.each([
    ["scene exportToSvg", "scene"],
    ["utils exportToSvg", "utils"],
  ] as const)("%s", (_name, path) => {
    const run = async (
      elements: ExcalidrawElement[],
      files: BinaryFiles,
      spoileredFileIds?: FileId[],
      opts: { reuseImages?: boolean; dark?: boolean; embed?: boolean } = {},
    ) => {
      if (path === "scene") {
        return exportToSvgScene(
          elements as never,
          {
            exportBackground: false,
            viewBackgroundColor: "#ffffff",
            exportWithDarkMode: opts.dark,
            exportEmbedScene: opts.embed,
          },
          files,
          { spoileredFileIds, reuseImages: opts.reuseImages },
        );
      }
      return exportToSvgUtils({
        elements: elements as never,
        appState: {
          exportBackground: false,
          exportWithDarkMode: opts.dark,
          exportEmbedScene: opts.embed,
        },
        files,
        spoileredFileIds,
        reuseImages: opts.reuseImages,
      });
    };

    const hrefs = (svg: SVGSVGElement) =>
      [...svg.querySelectorAll("image")].map((node) =>
        node.getAttribute("href"),
      );

    const blurURL = (hash: string) =>
      getThumbHashPlaceholder(hash)!.toDataURL();

    // 1.5.2
    it("writes the ThumbHash data URL for the listed files only", async () => {
      const svg = await run(
        [createImage("a", A, 0), createImage("b", B, 300)],
        createFiles(),
        [A],
      );
      expect(hrefs(svg)).toContain(blurURL(HASH_A));
      expect(hrefs(svg)).toContain(REAL_URL[B]);
      expect(svg.outerHTML).not.toContain(REAL_URL[A]);
      expect(svg.outerHTML).not.toContain("REALFILEAAAA");
    });

    it("writes the grey box when the element has no ThumbHash", async () => {
      const svg = await run(
        [createImage("a", A, 0, { thumbHash: null })],
        createFiles(),
        [A],
      );
      const [href] = hrefs(svg);
      expect(href).toMatch(/^data:image\/svg\+xml,/);
      expect(decodeURIComponent(href!)).toContain("#E7E7E7");
      expect(svg.outerHTML).not.toContain(REAL_URL[A]);
    });

    it("writes the dark grey box in the dark theme", async () => {
      const svg = await run(
        [createImage("a", A, 0, { thumbHash: null })],
        createFiles(),
        [A],
        { dark: true },
      );
      expect(decodeURIComponent(hrefs(svg)[0]!)).toContain("#2E2E2E");
    });

    it("writes the grey box for an invalid ThumbHash", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const svg = await run(
        [createImage("a", A, 0, { thumbHash: "%%not-a-hash%%" })],
        createFiles(),
        [A],
      );
      expect(hrefs(svg)[0]).toMatch(/^data:image\/svg\+xml,/);
      expect(svg.outerHTML).not.toContain(REAL_URL[A]);
    });

    it.each([true, false])(
      "leaks no file data for a listed id (reuseImages %s)",
      async (reuseImages) => {
        const svg = await run(
          [
            createImage("a1", A, 0),
            createImage("a2", A, 300),
            createImage("b", B, 600),
          ],
          createFiles(),
          [A],
          { reuseImages },
        );
        expect(svg.outerHTML).not.toContain("REALFILEAAAA");
        // every <use> points to a <symbol> in the svg
        for (const use of svg.querySelectorAll("use")) {
          const id = use.getAttribute("href")!.slice(1);
          const symbol = svg.querySelector(`[id="${id}"]`)!;
          expect(symbol).not.toBeNull();
          expect(symbol.innerHTML).not.toContain("REALFILEAAAA");
        }
        expect(svg.querySelectorAll("use")).toHaveLength(3);
        expect(svg.outerHTML).toContain("REALFILEBBBB");
      },
    );

    it("writes the blur for two elements with one file id", async () => {
      const svg = await run(
        [createImage("a1", A, 0), createImage("a2", A, 300)],
        createFiles(),
        [A],
      );
      expect(hrefs(svg).every((href) => href === blurURL(HASH_A))).toBe(true);
      expect(svg.querySelectorAll("use")).toHaveLength(2);
      expect(svg.outerHTML).not.toContain("REALFILEAAAA");
    });

    it("writes each ThumbHash for two elements with one file id and two hashes", async () => {
      const svg = await run(
        [
          createImage("a1", A, 0, { thumbHash: HASH_A }),
          createImage("a2", A, 300, { thumbHash: HASH_C }),
        ],
        createFiles(),
        [A],
      );
      const uses = [...svg.querySelectorAll("use")].map((use) =>
        svg
          .querySelector(`[id="${use.getAttribute("href")!.slice(1)}"] image`)!
          .getAttribute("href"),
      );
      expect(uses).toEqual([blurURL(HASH_A), blurURL(HASH_C)]);
    });

    it("keeps the crop of a listed image", async () => {
      const crop = {
        x: 100,
        y: 50,
        width: 200,
        height: 100,
        naturalWidth: 400,
        naturalHeight: 200,
      };
      const cropped = newElementWith(createImage("a", A, 0), { crop });
      const plain = await run([cropped], createFiles());
      const spoiler = await run([cropped], createFiles(), [A]);
      const strip = (svg: SVGSVGElement) =>
        svg.outerHTML.replace(/href="data:[^"]*"/g, 'href=""');
      // same layout (masks, sizes, transforms), other image data
      expect(strip(spoiler).replace(/image-crop-[^"#)]*/g, "ID")).toBe(
        strip(plain).replace(/image-crop-[^"#)]*/g, "ID"),
      );
      expect(spoiler.outerHTML).not.toContain("REALFILEAAAA");
    });

    it("draws a placeholder for a listed file that is not in the files", async () => {
      const svg = await run([createImage("a", A, 0)], {}, [A]);
      expect(hrefs(svg)).toEqual([blurURL(HASH_A)]);
    });

    it("draws nothing for an unlisted file that is not in the files", async () => {
      const svg = await run([createImage("a", A, 0)], {}, []);
      expect(hrefs(svg)).toEqual([]);
    });

    it("keeps the real file in the embedded scene, and draws the blur", async () => {
      const svg = await run([createImage("a", A, 0)], createFiles(), [A], {
        embed: true,
      });
      // the drawn image is the blur
      expect(hrefs(svg)).toEqual([blurURL(HASH_A)]);
      // the embedded scene still has the file
      const payload = JSON.parse(
        decodeSvgBase64Payload({
          svg: svg.querySelector("metadata")!.innerHTML,
        }),
      );
      expect(payload.files[A].dataURL).toBe(REAL_URL[A]);
    });

    it("writes the grey box for an image in the error status", async () => {
      const errored = newElementWith(createImage("a", A, 0), {
        status: "error",
      });
      const svg = await run([errored], createFiles(), [A]);
      expect(hrefs(svg)[0]).toMatch(/^data:image\/svg\+xml,/);
      expect(svg.outerHTML).not.toContain("REALFILEAAAA");
    });

    it("applies no dark filter to a spoilered SVG file", async () => {
      const files = {
        [A]: {
          id: A,
          mimeType: MIME_TYPES.svg,
          dataURL: "data:image/svg+xml;base64,REALFILEAAAA" as DataURL,
          created: 1,
        },
      } as BinaryFiles;
      const plain = await run([createImage("a", A, 0)], files, [], {
        dark: true,
      });
      const spoiler = await run([createImage("a", A, 0)], files, [A], {
        dark: true,
      });
      // the filter is set on the svg file only
      expect(plain.querySelector("g[filter]")).not.toBeNull();
      expect(spoiler.querySelector("[filter]")).toBeNull();
      expect(spoiler.outerHTML).not.toContain("REALFILEAAAA");
    });

    it("ignores an id that is not in the scene", async () => {
      const withId = await run([createImage("b", B, 0)], createFiles(), [
        "not-in-scene" as FileId,
      ]);
      const without = await run([createImage("b", B, 0)], createFiles());
      expect(withId.outerHTML).toBe(without.outerHTML);
      expect(withId.outerHTML).toContain("REALFILEBBBB");
    });

    it("writes real images for an empty list", async () => {
      const withEmpty = await run([createImage("a", A, 0)], createFiles(), []);
      const without = await run([createImage("a", A, 0)], createFiles());
      expect(withEmpty.outerHTML).toBe(without.outerHTML);
      expect(withEmpty.outerHTML).toContain("REALFILEAAAA");
    });

    // 1.5.3
    it("writes real images when the App has hidden files", async () => {
      await render(<Excalidraw />);
      mark(A);
      const svg = await run([createImage("a", A, 0)], createFiles());
      expect(svg.outerHTML).toContain("REALFILEAAAA");
    });

    it("does not change the elements or the files", async () => {
      const elements = [createImage("a", A, 0)];
      const files = createFiles();
      const before = JSON.stringify([elements, files]);
      await run(elements, files, [A]);
      expect(JSON.stringify([elements, files])).toBe(before);
    });
  });
});
