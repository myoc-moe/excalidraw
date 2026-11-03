import { CaptureUpdateAction, newElementWith } from "@excalidraw/element";
import { ShapeCache } from "@excalidraw/element";
import { KEYS, MIME_TYPES } from "@excalidraw/common";

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

import { API } from "./helpers/api";
import { Keyboard, Pointer } from "./helpers/ui";
import { act, render } from "./test-utils";

import type { DataURL, ExcalidrawProps } from "../types";

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
