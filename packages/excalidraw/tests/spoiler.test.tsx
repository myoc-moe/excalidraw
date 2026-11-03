import { CaptureUpdateAction, newElementWith } from "@excalidraw/element";
import { ShapeCache } from "@excalidraw/element";
import { MIME_TYPES } from "@excalidraw/common";

import type { ExcalidrawElement, FileId } from "@excalidraw/element/types";

import { clearAppStateForLocalStorage } from "../appState";
import { serializeAsJSON } from "../data/json";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
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
