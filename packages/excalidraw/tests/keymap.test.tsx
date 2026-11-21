import React from "react";
import { vi } from "vitest";

import {
  CANVAS_SEARCH_TAB,
  CLASSES,
  CURSOR_TYPE,
  KEYS,
} from "@excalidraw/common";

import { Excalidraw, WelcomeScreen } from "../index";
import { createRedoAction, createUndoAction } from "../actions/actionHistory";
import { actionCopy } from "../actions/actionClipboard";
import { actionSmartZoom } from "../actions/actionSmartZoom";
import { activeEyeDropperAtom } from "../components/EyeDropper";
import { editorJotaiStore } from "../editor-jotai";
import { getKeymapEntries, matchesBinding } from "../keymap";

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

describe("keymap: copy, cut and paste keys are fixed", () => {
  it("ignores a keymap entry for action:copy", async () => {
    // no real clipboard write
    const perform = vi.spyOn(actionCopy, "perform").mockReturnValue(false);
    // not a binding id: the app cannot pass it, but a stored keymap could
    await renderWithKeymap({ "action:copy": ["Mod+J"] } as unknown as Keymap);
    const rectangle = API.createElement({ type: "rectangle" });
    API.setElements([rectangle]);
    API.setSelectedElements([rectangle]);

    keyDown("j", { code: "KeyJ", ctrlKey: true });
    expect(perform).not.toHaveBeenCalled();

    keyDown("c", { code: "KeyC", ctrlKey: true });
    expect(perform).toHaveBeenCalledTimes(1);
    perform.mockRestore();
  });

  it("does not list copy, cut and paste", () => {
    const ids = getKeymapEntries(false).map((entry) => entry.id as string);
    expect(ids).not.toContain("action:copy");
    expect(ids).not.toContain("action:cut");
    expect(ids).not.toContain("action:paste");
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

  it("releases a held shifted symbol when Shift goes up first", async () => {
    await renderWithKeymap({ "editor:smartZoom": ["!"] });
    const executeAction = vi.spyOn(h.app.actionManager, "executeAction");

    keyDown("!", { code: "Digit1", shiftKey: true });
    expect(GlobalTestState.interactiveCanvas.style.cursor).toBe("zoom-in");

    // Shift is up already: the same physical key sends "1"
    keyUp("1", { code: "Digit1" });
    expect(executeAction).toHaveBeenCalledWith(
      actionSmartZoom,
      "keyboard",
      expect.anything(),
    );
    expect(GlobalTestState.interactiveCanvas.style.cursor).not.toBe("zoom-in");
  });

  it("releases a held zoom symbol when Shift goes up first", async () => {
    await renderWithKeymap({ "editor:holdZoom": ["!"] });

    keyDown("!", { code: "Digit1", shiftKey: true });
    expect(GlobalTestState.interactiveCanvas.style.cursor).toBe("zoom-in");

    keyUp("1", { code: "Digit1" });
    expect(GlobalTestState.interactiveCanvas.style.cursor).not.toBe("zoom-in");
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

  it("refocuses the open search on a user key of a non-Latin layout", async () => {
    await renderWithKeymap({ "action:searchMenu": ["Mod+J"] });

    // Cyrillic layout: "о" on the J key
    keyDown("о", { code: "KeyJ", ctrlKey: true });
    expect(h.state.openSidebar?.tab).toBe(CANVAS_SEARCH_TAB);
    const input =
      h.app.excalidrawContainerValue.container?.querySelector<HTMLInputElement>(
        `.${CLASSES.SEARCH_MENU_INPUT_WRAPPER} input`,
      )!;
    await waitFor(() => expect(input.matches(":focus")).toBe(true));

    act(() => {
      input.blur();
    });
    expect(input.matches(":focus")).toBe(false);

    // the search menu handles the raw event: it normalizes the key too
    keyDown("о", { code: "KeyJ", ctrlKey: true });
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

describe("keymap: help dialog link", () => {
  const openHelpDialog = () => {
    act(() => {
      window.h.setState({ openDialog: { name: "help" } });
    });
  };

  const getChangeButton = () =>
    [
      ...document.querySelectorAll<HTMLButtonElement>(".HelpDialog button"),
    ].find((button) => button.textContent === "Change shortcuts…");

  it("shows the footer link only with onOpenKeyboardShortcuts", async () => {
    await renderWithKeymap();
    openHelpDialog();
    expect(document.querySelector(".HelpDialog__footer")).toBe(null);
    expect(getChangeButton()).toBeUndefined();
  });

  it("shows the footer note and link with onOpenKeyboardShortcuts", async () => {
    await renderWithKeymap(undefined, {
      onOpenKeyboardShortcuts: vi.fn(),
    });
    openHelpDialog();
    expect(
      document.querySelector(".HelpDialog__footer")?.textContent,
    ).toContain("Showing your shortcuts. Changed keys are in this list too.");
    expect(getChangeButton()).toBeDefined();
  });

  it("closes the help dialog and calls the prop once on click", async () => {
    const onOpenKeyboardShortcuts = vi.fn();
    await renderWithKeymap(undefined, { onOpenKeyboardShortcuts });
    openHelpDialog();

    fireEvent.click(getChangeButton()!);

    expect(onOpenKeyboardShortcuts).toHaveBeenCalledTimes(1);
    expect(h.state.openDialog).toBe(null);
  });
});

describe("keymap: eyedropper labels", () => {
  it("gives the stroke and background eyedroppers different labels", () => {
    const entries = getKeymapEntries(false);
    const stroke = entries.find((e) => e.id === "editor:eyeDropperStroke");
    const background = entries.find(
      (e) => e.id === "editor:eyeDropperBackground",
    );

    expect(stroke?.label).toBe("Pick stroke color from canvas");
    expect(background?.label).toBe("Pick background color from canvas");
  });
});

describe("keymap: live key labels", () => {
  const getByTestId = (testId: string) =>
    document.querySelector<HTMLElement>(`[data-testid="${testId}"]`);

  const renderWithWelcome = async (keymap?: Keymap) => {
    await render(
      <Excalidraw
        keymap={keymap}
        handleKeyboardGlobally
        initialData={{ appState: { myocSimplifiedMode: false } }}
      >
        <WelcomeScreen />
      </Excalidraw>,
    );
  };

  const getWelcomeShortcuts = () =>
    [...document.querySelectorAll(".welcome-screen-menu-item__shortcut")].map(
      (el) => el.textContent,
    );

  it("keeps the default texts without a keymap", async () => {
    await renderWithWelcome();
    expect(
      document.querySelector(".zoom-in-button")?.getAttribute("title"),
    ).toBe("Zoom in — Ctrl++");
    expect(
      document.querySelector(".zoom-out-button")?.getAttribute("title"),
    ).toBe("Zoom out — Ctrl+-");
    expect(getByTestId("toolbar-lock")?.getAttribute("title")).toBe(
      "Keep selected tool active after drawing — Q",
    );
    expect(getByTestId("button-smart-zoom")?.getAttribute("title")).toBe(
      "Smart Zoom - F",
    );
    expect(getWelcomeShortcuts()).toEqual(["Ctrl+O", "?"]);
  });

  it("shows the user keys", async () => {
    await renderWithWelcome({
      "action:zoomIn": ["Alt+J"],
      "editor:toolLock": ["Shift+K"],
      "editor:smartZoom": ["M"],
      "action:toggleShortcuts": ["Mod+H"],
      "action:loadScene": ["Mod+L"],
    });
    expect(
      document.querySelector(".zoom-in-button")?.getAttribute("title"),
    ).toBe("Zoom in — Alt+J");
    expect(getByTestId("toolbar-lock")?.getAttribute("title")).toBe(
      "Keep selected tool active after drawing — Shift+K",
    );
    expect(getByTestId("button-smart-zoom")?.getAttribute("title")).toBe(
      "Smart Zoom - M",
    );
    expect(getWelcomeShortcuts()).toEqual(["Ctrl+L", "Ctrl+H"]);
  });

  it("updates the labels when the keymap prop changes", async () => {
    await renderWithWelcome();
    expect(getByTestId("toolbar-rectangle")?.getAttribute("title")).toBe(
      "Rectangle — R",
    );
    expect(
      document.querySelector(".zoom-in-button")?.getAttribute("title"),
    ).toBe("Zoom in — Ctrl++");

    // no other state changes
    GlobalTestState.renderResult.rerender(
      <Excalidraw
        keymap={{ "tool:rectangle": ["J"], "action:zoomIn": ["Alt+J"] }}
        handleKeyboardGlobally
        initialData={{ appState: { myocSimplifiedMode: false } }}
      >
        <WelcomeScreen />
      </Excalidraw>,
    );

    expect(getByTestId("toolbar-rectangle")?.getAttribute("title")).toBe(
      "Rectangle — J",
    );
    expect(
      document.querySelector(".zoom-in-button")?.getAttribute("title"),
    ).toBe("Zoom in — Alt+J");
  });

  it("shows no key for an unbound command", async () => {
    await renderWithWelcome({
      "action:zoomIn": [],
      "editor:toolLock": [],
      "editor:smartZoom": [],
      "action:toggleShortcuts": [],
      "action:loadScene": [],
    });
    expect(
      document.querySelector(".zoom-in-button")?.getAttribute("title"),
    ).toBe("Zoom in");
    expect(getByTestId("toolbar-lock")?.getAttribute("title")).toBe(
      "Keep selected tool active after drawing",
    );
    expect(getByTestId("button-smart-zoom")?.getAttribute("title")).toBe(
      "Smart Zoom",
    );
    expect(getWelcomeShortcuts()).toEqual([]);
  });
});
