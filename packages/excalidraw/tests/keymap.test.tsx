import React from "react";
import { vi } from "vitest";

import {
  CANVAS_SEARCH_TAB,
  CLASSES,
  CURSOR_TYPE,
  KEYS,
} from "@excalidraw/common";

import { Excalidraw } from "../index";
import { createRedoAction, createUndoAction } from "../actions/actionHistory";
import { actionSmartZoom } from "../actions/actionSmartZoom";
import { activeEyeDropperAtom } from "../components/EyeDropper";
import { editorJotaiStore } from "../editor-jotai";
import { matchesBinding } from "../keymap";

import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import { getTextEditor } from "./queries/dom";
import {
  act,
  fireEvent,
  GlobalTestState,
  render,
  togglePopover,
  waitFor,
} from "./test-utils";

import type { Keymap } from "../keymap";
import type { ExcalidrawProps } from "../types";

const { h } = window;

const mouse = new Pointer("mouse");

const renderWithKeymap = async (
  keymap?: Keymap,
  props: Partial<ExcalidrawProps> = {},
) => {
  await render(
    <Excalidraw keymap={keymap} handleKeyboardGlobally {...props} />,
  );
};

/** a key event on the document, as the browser sends it */
const keyDown = (
  key: string,
  init: Partial<
    Record<"code" | "ctrlKey" | "altKey" | "shiftKey", string | boolean>
  > = {},
) => fireEvent.keyDown(document, { key, ...init });

const keyUp = (
  key: string,
  init: Partial<
    Record<"code" | "ctrlKey" | "altKey" | "shiftKey", string | boolean>
  > = {},
) => fireEvent.keyUp(document, { key, ...init });

describe("keymap: actions", () => {
  it("fires a rebound action on the new key and not on the old key", async () => {
    await renderWithKeymap({ "action:selectAll": ["Alt+J"] });
    API.setElements([API.createElement({ type: "rectangle" })]);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.A);
    });
    expect(API.getSelectedElements()).toHaveLength(0);

    Keyboard.withModifierKeys({ alt: true }, () => {
      Keyboard.keyPress("j");
    });
    expect(API.getSelectedElements()).toHaveLength(1);
  });

  it("matches a rebound physical-key action by character", async () => {
    await renderWithKeymap({ "action:gridMode": ["Shift+J"] });
    expect(h.state.gridModeEnabled).toBe(false);

    // the old key (Ctrl and the Quote key)
    keyDown("'", { code: "Quote", ctrlKey: true });
    expect(h.state.gridModeEnabled).toBe(false);

    keyDown("J", { code: "KeyJ", shiftKey: true });
    expect(h.state.gridModeEnabled).toBe(true);
  });

  it("disables an action with []", async () => {
    await renderWithKeymap({ "action:gridMode": [] });

    keyDown("'", { code: "Quote", ctrlKey: true });
    expect(h.state.gridModeEnabled).toBe(false);
  });

  it("keeps the default keys of the actions the keymap does not name", async () => {
    await renderWithKeymap({ "action:gridMode": [] });
    API.setElements([API.createElement({ type: "rectangle" })]);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.A);
    });
    expect(API.getSelectedElements()).toHaveLength(1);
  });

  it("fires a key on a command with no default key", async () => {
    await renderWithKeymap({ "action:zoomToFit": ["Shift+J"] });
    API.setElements([
      API.createElement({ type: "rectangle", x: 5000, y: 5000 }),
    ]);
    const { scrollX, scrollY } = h.state;

    Keyboard.withModifierKeys({ shift: true }, () => {
      Keyboard.keyPress("J");
    });
    expect([h.state.scrollX, h.state.scrollY]).not.toEqual([scrollX, scrollY]);
  });

  it("ANDs the state guard of a binding with the key match", async () => {
    await renderWithKeymap({ "action:toggleElementLock": ["Alt+J"] });
    const rectangle = API.createElement({ type: "rectangle" });
    API.setElements([rectangle]);

    // no selection: the guard fails
    Keyboard.withModifierKeys({ alt: true }, () => {
      Keyboard.keyPress("j");
    });
    expect(h.elements[0].locked).toBe(false);

    API.setSelectedElements([rectangle]);
    Keyboard.withModifierKeys({ alt: true }, () => {
      Keyboard.keyPress("j");
    });
    expect(h.elements[0].locked).toBe(true);
  });

  it("rebinds undo", async () => {
    await renderWithKeymap({ "action:undo": ["Alt+U"] });
    UI.createElement("rectangle");
    expect(h.elements).toHaveLength(1);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.Z);
    });
    expect(h.elements.filter((element) => !element.isDeleted)).toHaveLength(1);

    Keyboard.withModifierKeys({ alt: true }, () => {
      Keyboard.keyPress("u");
    });
    expect(h.elements.filter((element) => !element.isDeleted)).toHaveLength(0);
  });

  it("opens the help dialog on the toggleShortcuts key only", async () => {
    await renderWithKeymap({ "action:toggleShortcuts": ["Shift+J"] });

    keyDown("?", { code: "Slash", shiftKey: true });
    expect(h.state.openDialog).toBe(null);

    keyDown("J", { code: "KeyJ", shiftKey: true });
    expect(h.state.openDialog).toEqual({ name: "help" });
  });
});

describe("keymap: undo and redo match their key tests", () => {
  // `createUndoAction` and `createRedoAction` need the history, so they are
  // not in the action registry of the parity tests in `keymap.test.ts`
  const undo = createUndoAction({} as any);
  const redo = createRedoAction({} as any);

  const event = (key: string, shiftKey = false) => ({
    key,
    code: `Key${key.toUpperCase()}`,
    ctrlKey: true,
    metaKey: false,
    altKey: false,
    shiftKey,
  });

  it.each([
    ["action:undo", "z", false, true],
    ["action:undo", "Z", true, false],
    ["action:redo", "Z", true, true],
    ["action:redo", "y", false, true],
    ["action:redo", "z", false, false],
  ] as const)(
    "%s on Ctrl+%s (Shift: %s) is %s",
    (id, key, shiftKey, expected) => {
      const action = id === "action:undo" ? undo : redo;
      const keyEvent = event(key, shiftKey);
      expect(action.keyTest!(keyEvent as any, h.state, [], h.app as any)).toBe(
        expected,
      );
      expect(matchesBinding(keyEvent, id, null, false)).toBe(expected);
    },
  );
});

describe("keymap: tools", () => {
  it("selects a rebound tool on the new key and not on the old key", async () => {
    await renderWithKeymap({ "tool:rectangle": ["J"] });

    Keyboard.keyPress(KEYS.R);
    expect(h.state.activeTool.type).toBe("selection");

    Keyboard.keyPress("j");
    expect(h.state.activeTool.type).toBe("rectangle");
  });

  it("selects a tool bound to a key with Alt", async () => {
    // Alt+R is the default key of view mode
    await renderWithKeymap({
      "tool:rectangle": ["Alt+R"],
      "action:viewMode": [],
    });

    keyDown("r", { code: "KeyR", altKey: true });
    expect(h.state.activeTool.type).toBe("rectangle");
    expect(h.state.viewModeEnabled).toBe(false);
  });

  it("toggles the tool lock on a key with Mod", async () => {
    await renderWithKeymap({ "editor:toolLock": ["Mod+R"] });
    expect(h.state.activeTool.locked).toBe(false);

    Keyboard.keyPress(KEYS.Q);
    expect(h.state.activeTool.locked).toBe(false);

    const event = keyDown("r", { code: "KeyR", ctrlKey: true });
    expect(h.state.activeTool.locked).toBe(true);
    // the browser shortcut (reload) must not run
    expect(event).toBe(false);
  });

  it("does not select the default R tool with Ctrl held", async () => {
    await renderWithKeymap();

    keyDown("r", { code: "KeyR", ctrlKey: true });
    expect(h.state.activeTool.type).toBe("selection");

    Keyboard.keyPress(KEYS.R);
    expect(h.state.activeTool.type).toBe("rectangle");
  });
});

describe("keymap: hold keys", () => {
  it("holds smart zoom on a new key, including the release", async () => {
    await renderWithKeymap({ "editor:smartZoom": ["J"] });
    const executeAction = vi.spyOn(h.app.actionManager, "executeAction");

    // the old key does nothing
    keyDown("f", { code: "KeyF" });
    keyUp("f", { code: "KeyF" });
    expect(GlobalTestState.interactiveCanvas.style.cursor).not.toBe("zoom-in");
    expect(executeAction).not.toHaveBeenCalledWith(
      actionSmartZoom,
      "keyboard",
      expect.anything(),
    );

    keyDown("j", { code: "KeyJ" });
    expect(GlobalTestState.interactiveCanvas.style.cursor).toBe("zoom-in");

    keyUp("j", { code: "KeyJ" });
    expect(executeAction).toHaveBeenCalledWith(
      actionSmartZoom,
      "keyboard",
      expect.anything(),
    );
    expect(GlobalTestState.interactiveCanvas.style.cursor).not.toBe("zoom-in");
  });

  it("releases a held key with modifiers when the modifier goes up first", async () => {
    await renderWithKeymap({ "editor:smartZoom": ["Shift+J"] });
    const executeAction = vi.spyOn(h.app.actionManager, "executeAction");

    keyDown("J", { code: "KeyJ", shiftKey: true });
    expect(GlobalTestState.interactiveCanvas.style.cursor).toBe("zoom-in");

    // Shift is up already
    keyUp("j", { code: "KeyJ" });
    expect(executeAction).toHaveBeenCalledWith(
      actionSmartZoom,
      "keyboard",
      expect.anything(),
    );
  });

  it("holds zoom on a new key in view mode, including the release", async () => {
    await renderWithKeymap({ "editor:holdZoom": ["J"] });
    API.setAppState({ viewModeEnabled: true });
    mouse.reset();
    const startZoom = h.state.zoom.value;

    // the old key does nothing
    keyDown("z", { code: "KeyZ" });
    expect(GlobalTestState.interactiveCanvas.style.cursor).not.toBe("zoom-in");
    keyUp("z", { code: "KeyZ" });

    keyDown("j", { code: "KeyJ" });
    expect(GlobalTestState.interactiveCanvas.style.cursor).toBe("zoom-in");

    mouse.down(100, 100);
    mouse.up(100, 0);
    expect(h.state.zoom.value).toBeGreaterThan(startZoom);

    keyUp("j", { code: "KeyJ" });
    expect(GlobalTestState.interactiveCanvas.style.cursor).toBe(
      CURSOR_TYPE.GRAB,
    );
    mouse.reset();
  });

  it("holds zoom on a new key outside view mode, including the release", async () => {
    await renderWithKeymap({ "editor:holdZoom": ["J"] });

    keyDown("j", { code: "KeyJ" });
    expect(GlobalTestState.interactiveCanvas.style.cursor).toBe("zoom-in");

    keyUp("j", { code: "KeyJ" });
    expect(GlobalTestState.interactiveCanvas.style.cursor).not.toBe("zoom-in");
  });
});

describe("keymap: pickers and eye droppers", () => {
  beforeAll(() => {
    // radix popovers (color picker) need a ResizeObserver; jsdom has none
    // (same stub as test-utils' togglePopover)
    (global as any).ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  const getEyeDropper = () => editorJotaiStore.get(activeEyeDropperAtom);
  const closeEyeDropper = () =>
    act(() => {
      editorJotaiStore.set(activeEyeDropperAtom, null);
    });

  it("keeps swapPreviewOnAlt for the default keys", async () => {
    await renderWithKeymap();

    Keyboard.keyPress(KEYS.I);
    expect(getEyeDropper()).toMatchObject({
      colorPickerType: "elementStroke",
      swapPreviewOnAlt: false,
    });
    closeEyeDropper();

    keyDown("S", { code: "KeyS", shiftKey: true });
    expect(getEyeDropper()).toMatchObject({
      colorPickerType: "elementStroke",
      swapPreviewOnAlt: true,
    });
    closeEyeDropper();

    keyDown("I", { code: "KeyI", shiftKey: true });
    expect(getEyeDropper()).toMatchObject({
      colorPickerType: "elementBackground",
      swapPreviewOnAlt: true,
    });
    closeEyeDropper();
  });

  it("sets swapPreviewOnAlt when the matched user combo has Shift", async () => {
    await renderWithKeymap({
      "editor:eyeDropperStroke": ["J", "Shift+K"],
      "editor:eyeDropperBackground": ["Shift+J"],
    });

    Keyboard.keyPress(KEYS.I);
    expect(getEyeDropper()).toBe(null);

    keyDown("j", { code: "KeyJ" });
    expect(getEyeDropper()).toMatchObject({
      colorPickerType: "elementStroke",
      swapPreviewOnAlt: false,
    });
    closeEyeDropper();

    keyDown("K", { code: "KeyK", shiftKey: true });
    expect(getEyeDropper()).toMatchObject({
      colorPickerType: "elementStroke",
      swapPreviewOnAlt: true,
    });
    closeEyeDropper();

    keyDown("J", { code: "KeyJ", shiftKey: true });
    expect(getEyeDropper()).toMatchObject({
      colorPickerType: "elementBackground",
      swapPreviewOnAlt: true,
    });
    closeEyeDropper();
  });

  it("opens a rebound picker only when its guard passes", async () => {
    await renderWithKeymap({ "editor:strokePicker": ["Shift+J"] });

    // selection tool and no selection: the guard fails
    keyDown("J", { code: "KeyJ", shiftKey: true });
    expect(h.state.openPopup).toBe(null);

    const rectangle = API.createElement({ type: "rectangle" });
    API.setElements([rectangle]);
    API.setSelectedElements([rectangle]);

    keyDown("s", { code: "KeyS" });
    expect(h.state.openPopup).toBe(null);

    keyDown("J", { code: "KeyJ", shiftKey: true });
    expect(h.state.openPopup).toBe("elementStroke");
  });
});

describe("keymap: image export", () => {
  it("opens the image export dialog on Mod+Shift+E by default", async () => {
    await renderWithKeymap();

    keyDown("E", { code: "KeyE", ctrlKey: true, shiftKey: true });
    expect(h.state.openDialog).toEqual({ name: "imageExport" });
  });

  it("does not open it when saveAsImage is off", async () => {
    await renderWithKeymap(undefined, {
      UIOptions: { canvasActions: { saveAsImage: false } },
    });

    keyDown("E", { code: "KeyE", ctrlKey: true, shiftKey: true });
    expect(h.state.openDialog).toBe(null);
  });
});

describe("keymap: local key handlers", () => {
  beforeAll(() => {
    // radix popovers (color picker) need a ResizeObserver; jsdom has none
    // (same stub as test-utils' togglePopover)
    (global as any).ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  it("toggles the eye dropper of the open color picker on the user key", async () => {
    await renderWithKeymap({ "editor:eyeDropperStroke": ["J"] });
    const rectangle = API.createElement({ type: "rectangle" });
    API.setElements([rectangle]);
    API.setSelectedElements([rectangle]);
    togglePopover("Stroke");

    const picker = document.querySelector(".color-picker-content")!;
    expect(picker).not.toBeNull();

    // the old key is not handled by the picker
    expect(fireEvent.keyDown(picker, { key: "i", code: "KeyI" })).toBe(true);
    expect(editorJotaiStore.get(activeEyeDropperAtom)).toBe(null);

    // handled: the picker prevents the default
    expect(fireEvent.keyDown(picker, { key: "j", code: "KeyJ" })).toBe(false);
    expect(editorJotaiStore.get(activeEyeDropperAtom)).not.toBe(null);
    act(() => {
      editorJotaiStore.set(activeEyeDropperAtom, null);
    });
  });

  const startTextEditing = async () => {
    UI.clickTool("text");
    mouse.clickAt(100, 100);
    return getTextEditor();
  };

  it("zooms in on the user key while text is edited", async () => {
    await renderWithKeymap({ "action:zoomIn": ["Mod+J"] });
    const editor = await startTextEditing();
    const startZoom = h.state.zoom.value;

    // the old key
    fireEvent.keyDown(editor, { key: "=", code: "Equal", ctrlKey: true });
    expect(h.state.zoom.value).toBe(startZoom);

    fireEvent.keyDown(editor, { key: "j", code: "KeyJ", ctrlKey: true });
    expect(h.state.zoom.value).toBeGreaterThan(startZoom);
  });

  it("zooms in on a user key with Shift while text is edited", async () => {
    await renderWithKeymap({ "action:zoomIn": ["Mod+Shift+K"] });
    const editor = await startTextEditing();
    const startZoom = h.state.zoom.value;

    fireEvent.keyDown(editor, {
      key: "K",
      code: "KeyK",
      ctrlKey: true,
      shiftKey: true,
    });
    expect(h.state.zoom.value).toBeGreaterThan(startZoom);
  });

  it("does not zoom on the default Mod+Shift++ while text is edited", async () => {
    await renderWithKeymap();
    const editor = await startTextEditing();
    const startZoom = h.state.zoom.value;

    fireEvent.keyDown(editor, {
      key: "+",
      code: "Equal",
      ctrlKey: true,
      shiftKey: true,
    });
    expect(h.state.zoom.value).toBe(startZoom);
  });

  it("types a plain user key in a text element", async () => {
    await renderWithKeymap({
      "action:zoomOut": ["-"],
      "action:increaseFontSize": ["]"],
    });
    const editor = await startTextEditing();
    const startZoom = h.state.zoom.value;
    const startFontSize = h.state.currentItemFontSize;

    // `fireEvent` returns `true` when no handler prevents the default, so
    // the character is typed
    expect(fireEvent.keyDown(editor, { key: "-", code: "Minus" })).toBe(true);
    expect(fireEvent.keyDown(editor, { key: "]", code: "BracketRight" })).toBe(
      true,
    );
    expect(h.state.zoom.value).toBe(startZoom);
    expect(h.state.currentItemFontSize).toBe(startFontSize);
  });

  it("refocuses the open search on the user key", async () => {
    await renderWithKeymap({ "action:searchMenu": ["Alt+J"] });

    keyDown("j", { code: "KeyJ", altKey: true });
    expect(h.state.openSidebar?.tab).toBe(CANVAS_SEARCH_TAB);
    const input =
      h.app.excalidrawContainerValue.container?.querySelector<HTMLInputElement>(
        `.${CLASSES.SEARCH_MENU_INPUT_WRAPPER} input`,
      )!;
    await waitFor(() => expect(input.matches(":focus")).toBe(true));

    act(() => {
      input.blur();
    });
    // the old key
    keyDown("f", { code: "KeyF", ctrlKey: true });
    expect(input.matches(":focus")).toBe(false);

    keyDown("j", { code: "KeyJ", altKey: true });
    expect(input.matches(":focus")).toBe(true);
  });

  it("types a plain user search key in an input of the open search", async () => {
    await renderWithKeymap({ "action:searchMenu": ["/"] });

    keyDown("/", { code: "Slash" });
    expect(h.state.openSidebar?.tab).toBe(CANVAS_SEARCH_TAB);
    const input =
      h.app.excalidrawContainerValue.container?.querySelector<HTMLInputElement>(
        `.${CLASSES.SEARCH_MENU_INPUT_WRAPPER} input`,
      )!;
    await waitFor(() => expect(input.matches(":focus")).toBe(true));

    // `fireEvent` returns `true` when no handler prevents the default
    expect(fireEvent.keyDown(input, { key: "/", code: "Slash" })).toBe(true);
  });

  it("keeps the user hyperlink key from running while a link is edited", async () => {
    await renderWithKeymap({ "action:hyperlink": ["Alt+J"] });
    const rectangle = API.createElement({ type: "rectangle" });
    API.setElements([rectangle]);
    API.setSelectedElements([rectangle]);

    keyDown("j", { code: "KeyJ", altKey: true });
    expect(h.state.showHyperlinkPopup).toBe("editor");
    const input = await waitFor(() => {
      const element = document.querySelector<HTMLInputElement>(
        ".excalidraw-hyperlinkContainer-input",
      );
      expect(element).not.toBe(null);
      return element!;
    });

    // `fireEvent` returns `false` when the handler prevents the default
    expect(fireEvent.keyDown(input, { key: "k", ctrlKey: true })).toBe(true);
    expect(fireEvent.keyDown(input, { key: "j", altKey: true })).toBe(false);
  });
});
