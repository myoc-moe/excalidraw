import { vi } from "vitest";

import { THEME, capitalizeString, resolvablePromise } from "@excalidraw/common";

import { getShortcutFromShortcutName } from "../actions/shortcuts";
import { getShortcutKey } from "../shortcut";
import { t } from "../i18n";
import { Excalidraw } from "../index";
import {
  getToolShortcut,
  MYOC_SIMPLIFIED_EXTRA_TOOL_TYPES,
  MYOC_SIMPLIFIED_MAIN_TOOL_TYPES,
  TOOLS,
} from "../components/Tools";

import { act, fireEvent, GlobalTestState, render } from "./test-utils";

import type { Action } from "../actions/types";
import type { Keymap } from "../keymap";
import type { ExcalidrawImperativeAPI, ExcalidrawProps } from "../types";

const renderEditor = async (props: Partial<ExcalidrawProps> = {}) => {
  const apiPromise = resolvablePromise<ExcalidrawImperativeAPI>();
  await render(
    <Excalidraw
      {...props}
      onExcalidrawAPI={(api) => api && apiPromise.resolve(api)}
    />,
  );
  return apiPromise;
};

const createAction = (
  name: string,
  overrides: Partial<Action> = {},
): Action => ({
  name,
  label: "buttons.zoomIn",
  perform: () => false,
  trackEvent: false,
  keyTest: () => false,
  ...overrides,
});

const getCatalogEntry = (api: ExcalidrawImperativeAPI, id: string) =>
  api.getCommandCatalog().find((entry) => entry.id === id);

describe("Excalidraw command catalog API", () => {
  it("resolves live labels, action keywords, declared shortcuts, and missing shortcuts", async () => {
    const api = await renderEditor({
      UIOptions: { canvasActions: { toggleTheme: true } },
    });

    const themeEntry = getCatalogEntry(api, "action:toggleTheme");
    expect(themeEntry).toMatchObject({
      kind: "action",
      label: t("buttons.darkMode"),
      keywords: ["toggle", "dark", "light", "mode", "theme"],
      shortcut: getShortcutFromShortcutName("toggleTheme"),
    });
    expect(themeEntry?.icon).toBeDefined();
    const initialThemeIcon = themeEntry?.icon;

    act(() => {
      api.updateScene({ appState: { theme: THEME.DARK } });
    });
    expect(getCatalogEntry(api, "action:toggleTheme")?.label).toBe(
      t("buttons.lightMode"),
    );
    expect(getCatalogEntry(api, "action:toggleTheme")?.icon).not.toBe(
      initialThemeIcon,
    );

    const searchEntry = getCatalogEntry(api, "action:searchMenu");
    expect(searchEntry).toMatchObject({
      keywords: ["search", "find"],
      shortcut: getShortcutFromShortcutName("searchMenu"),
    });
    // a bindable action has no `keyTest`; the default keys list it
    expect(getCatalogEntry(api, "action:selectAll")).toMatchObject({
      shortcut: expect.any(String),
    });
    // a bindable action without a default key is not listed
    expect(getCatalogEntry(api, "action:zoomToFit")).toBeUndefined();

    const dynamicAction = createAction("hostOnlyCommand", {
      label: "buttons.zoomIn",
      keywords: ["host", "custom"],
      icon: <span data-testid="host-command-icon" />,
    });
    act(() => api.registerAction(dynamicAction));
    expect(getCatalogEntry(api, "action:hostOnlyCommand")).toMatchObject({
      label: t("buttons.zoomIn"),
      keywords: ["host", "custom"],
      icon: <span data-testid="host-command-icon" />,
    });
    expect(getCatalogEntry(api, "action:hostOnlyCommand")).not.toHaveProperty(
      "shortcut",
    );

    const noKeyCommand = createAction("hostPanelOnlyAction", {
      keyTest: undefined,
    });
    act(() => api.registerAction(noKeyCommand));
    expect(getCatalogEntry(api, "action:hostPanelOnlyAction")).toBeUndefined();
    expect(api.executeCommand("action:hostPanelOnlyAction")).toBe(false);

    for (const id of [
      "action:changeProjectName",
      "action:changeExportScale",
      "action:changeArrowhead",
      "action:changeFontFamily",
    ]) {
      expect(getCatalogEntry(api, id)).toBeUndefined();
      expect(api.executeCommand(id)).toBe(false);
    }
  });

  it("reflects predicate, canvas-action, view-mode, and interaction availability", async () => {
    const api = await renderEditor({
      UIOptions: { canvasActions: { toggleTheme: true } },
    });
    const predicateAction = createAction("hostPredicateCommand", {
      viewMode: true,
      predicate: (_elements, appState) => !appState.gridModeEnabled,
    });
    const viewModeAction = createAction("hostEditOnlyCommand");
    act(() => {
      api.registerAction(predicateAction);
      api.registerAction(viewModeAction);
    });

    expect(getCatalogEntry(api, "action:hostPredicateCommand")).toBeDefined();
    act(() => {
      api.updateScene({ appState: { gridModeEnabled: true } });
    });
    expect(getCatalogEntry(api, "action:hostPredicateCommand")).toBeUndefined();
    expect(api.executeCommand("action:hostPredicateCommand")).toBe(false);

    expect(getCatalogEntry(api, "action:hostEditOnlyCommand")).toBeDefined();
    act(() => {
      api.updateScene({ appState: { viewModeEnabled: true } });
    });
    expect(getCatalogEntry(api, "action:hostEditOnlyCommand")).toBeUndefined();
    expect(api.executeCommand("action:hostEditOnlyCommand")).toBe(false);

    const nonInteractiveApi = await renderEditor({ interaction: false });
    expect(getCatalogEntry(nonInteractiveApi, "action:toggleTheme")).toBe(
      undefined,
    );
    expect(getCatalogEntry(nonInteractiveApi, "tool:freedraw")).toBeUndefined();
  });

  it("MyOC regression: follows the declared simplified-mode tool lists and shortcuts", async () => {
    const api = await renderEditor();
    const toolEntries = api
      .getCommandCatalog()
      .filter((entry) => entry.kind === "tool");
    const toolIds = toolEntries.map((entry) => entry.id);
    const simplifiedTypes = [
      ...MYOC_SIMPLIFIED_MAIN_TOOL_TYPES,
      ...MYOC_SIMPLIFIED_EXTRA_TOOL_TYPES,
    ];

    expect(toolIds).toEqual(simplifiedTypes.map((type) => `tool:${type}`));
    expect(toolIds).not.toContain("tool:hand");
    expect(toolIds).not.toContain("tool:lasso");
    expect(toolIds).not.toContain("tool:frame");
    expect(getCatalogEntry(api, "tool:freedraw")?.shortcut).toBe(
      getToolShortcut("freedraw"),
    );
    expect(getCatalogEntry(api, "tool:freedraw")?.icon).toBe(
      TOOLS.freedraw.icon,
    );
    expect(getCatalogEntry(api, "tool:autoshape")?.shortcut).toBe(
      getToolShortcut("autoshape"),
    );
    expect(getCatalogEntry(api, "tool:rectangle")?.label).toBe(
      capitalizeString(t("toolBar.rectangle")),
    );
  });

  it("MyOC regression: the selection entry activates the preferred lasso tool", async () => {
    const api = await renderEditor();
    act(() => {
      api.updateScene({
        appState: {
          preferredSelectionTool: { type: "lasso", initialized: true },
        },
      });
    });

    expect(getCatalogEntry(api, "tool:selection")).toMatchObject({
      label: capitalizeString(t("toolBar.lasso")),
      shortcut: getToolShortcut("selection"),
      icon: TOOLS.lasso.icon,
    });
    act(() => {
      expect(api.executeCommand("tool:selection")).toBe(true);
    });
    expect(api.getAppState().activeTool.type).toBe("lasso");
  });

  it("executes available actions and tools and rejects unknown or unavailable IDs", async () => {
    const api = await renderEditor({
      UIOptions: { canvasActions: { toggleTheme: true } },
    });
    const originalTheme = api.getAppState().theme;

    act(() => {
      expect(api.executeCommand("action:toggleTheme")).toBe(true);
    });
    expect(api.getAppState().theme).not.toBe(originalTheme);

    act(() => {
      expect(api.executeCommand("tool:rectangle")).toBe(true);
    });
    expect(api.getAppState().activeTool.type).toBe("rectangle");
    expect(api.executeCommand("action:unknown")).toBe(false);
    expect(api.executeCommand("tool:unknown")).toBe(false);

    window.h.app.props.UIOptions.canvasActions.toggleTheme = false;
    expect(getCatalogEntry(api, "action:toggleTheme")).toBeUndefined();
    expect(api.executeCommand("action:toggleTheme")).toBe(false);

    window.h.app.props.UIOptions.tools = { image: false };
    expect(getCatalogEntry(api, "tool:image")).toBeUndefined();
    expect(api.executeCommand("tool:image")).toBe(false);
  });

  it("includes dynamically registered actions and executes them from the live registry", async () => {
    const api = await renderEditor();
    const perform = vi.fn(() => false as const);
    const action = createAction("lateRegisteredCommand", {
      keywords: ["late", "registered"],
      perform,
    });

    act(() => api.registerAction(action));
    expect(getCatalogEntry(api, "action:lateRegisteredCommand")).toMatchObject({
      keywords: ["late", "registered"],
    });
    act(() => {
      expect(api.executeCommand("action:lateRegisteredCommand")).toBe(true);
    });
    expect(perform).toHaveBeenCalledTimes(1);
  });

  it("respects nested export options for the save-to-disk command", async () => {
    const api = await renderEditor({
      UIOptions: { canvasActions: { export: { saveFileToDisk: false } } },
    });

    expect(getCatalogEntry(api, "action:saveFileToDisk")).toBeUndefined();
    expect(api.executeCommand("action:saveFileToDisk")).toBe(false);

    window.h.app.props.UIOptions.canvasActions.export.saveFileToDisk = true;
    expect(getCatalogEntry(api, "action:saveFileToDisk")).toBeDefined();
  });
});

describe("labels read the keymap", () => {
  const ctrl = (key: string) => getShortcutKey(`CtrlOrCmd+${key}`);

  const openHelpDialog = (showAll: boolean) => {
    act(() => {
      window.h.setState({ openDialog: { name: "help" } });
    });
    if (showAll) {
      fireEvent.click(
        document.querySelector<HTMLButtonElement>(
          ".HelpDialog .toggle-button",
        )!,
      );
    }
  };

  /** the key caps of the help dialog row with the label */
  const getHelpRowKeys = (label: string) => {
    const row = [
      ...document.querySelectorAll<HTMLElement>(".HelpDialog__shortcut"),
    ].find((element) => element.firstElementChild?.textContent === label);
    return row
      ? [...row.querySelectorAll("kbd")].map((kbd) => kbd.textContent)
      : null;
  };

  it("keeps the default labels without a keymap", async () => {
    const api = await renderEditor();

    expect(getCatalogEntry(api, "action:selectAll")?.shortcut).toBe(ctrl("A"));
    expect(getCatalogEntry(api, "tool:rectangle")?.shortcut).toBe("R");
    // not in the legacy labels: no label without a user key
    expect(getCatalogEntry(api, "action:undo")?.shortcut).toBeUndefined();
    expect(getCatalogEntry(api, "action:saveFileToDisk")?.shortcut).toBe(
      getShortcutKey("CtrlOrCmd+Shift+S"),
    );
    expect(
      document
        .querySelector('[data-testid="toolbar-freedraw"]')
        ?.getAttribute("title"),
    ).toBe(`${capitalizeString(t("toolBar.freedraw"))} — P`);
  });

  it("shows the user keys in the command catalog", async () => {
    const keymap: Keymap = {
      "action:selectAll": ["Mod+Shift+K"],
      "action:toggleTheme": [],
      "action:undo": ["Mod+Alt+U"],
      "tool:rectangle": ["W", "Shift+W"],
      "tool:text": ["Alt+F"],
    };
    const api = await renderEditor({
      keymap,
      UIOptions: { canvasActions: { toggleTheme: true } },
    });

    expect(getCatalogEntry(api, "action:selectAll")?.shortcut).toBe(
      ctrl("Shift+K"),
    );
    // several keys show joined with "or"
    expect(getCatalogEntry(api, "tool:rectangle")?.shortcut).toBe(
      `W ${t("helpDialog.or")} ${getShortcutKey("Shift+W")}`,
    );
    expect(getCatalogEntry(api, "tool:text")?.shortcut).toBe(
      getShortcutKey("Alt+F"),
    );
    expect(getCatalogEntry(api, "action:undo")?.shortcut).toBe(
      getShortcutKey("CtrlOrCmd+Alt+U"),
    );
    // a removed key shows no label
    expect(
      getCatalogEntry(api, "action:toggleTheme")?.shortcut,
    ).toBeUndefined();
    // a binding the keymap does not name keeps its default
    expect(getCatalogEntry(api, "tool:ellipse")?.shortcut).toBe("O");
  });

  it("shows the user keys in the tool tooltip", async () => {
    await renderEditor({ keymap: { "tool:freedraw": ["W"] } });

    expect(
      document
        .querySelector('[data-testid="toolbar-freedraw"]')
        ?.getAttribute("title"),
    ).toBe(`${capitalizeString(t("toolBar.freedraw"))} — W`);
    expect(
      document
        .querySelector('[data-testid="toolbar-eraser"]')
        ?.getAttribute("title"),
    ).toBe(`${capitalizeString(t("toolBar.eraser"))} — E`);
  });

  it("shows the user keys in the context menu", async () => {
    await renderEditor({ keymap: { "action:selectAll": ["Mod+Shift+K"] } });

    fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
      button: 2,
      clientX: 1,
      clientY: 1,
    });

    const item = document.querySelector(
      '.context-menu [data-testid="selectAll"]',
    );
    expect(item?.querySelector("kbd")?.textContent).toBe(ctrl("Shift+K"));
    expect(
      document.querySelector('.context-menu [data-testid="gridMode"] kbd')
        ?.textContent,
    ).toBe(getShortcutKey("CtrlOrCmd+'"));
  });

  it("shows the user keys in the help dialog", async () => {
    await renderEditor({
      keymap: {
        "tool:rectangle": ["W"],
        "tool:frame": ["Alt+F"],
        "action:redo": ["Mod+Shift+K", "Mod+Alt+K"],
        "action:selectAll": [],
        "action:zoomIn": ["Mod+Shift+="],
        "editor:smartZoom": ["J"],
        "editor:holdZoom": ["K"],
      },
    });
    openHelpDialog(true);

    expect(getHelpRowKeys(t("toolBar.rectangle"))).toEqual(["W"]);
    expect(getHelpRowKeys(t("toolBar.frame"))).toEqual([
      getShortcutKey("Alt"),
      "F",
    ]);
    // the "or" between two keys is text, not a key cap
    expect(getHelpRowKeys(t("buttons.redo"))).toEqual([
      getShortcutKey("Ctrl"),
      getShortcutKey("Shift"),
      "K",
      getShortcutKey("Ctrl"),
      getShortcutKey("Alt"),
      "K",
    ]);
    // a removed key hides the row
    expect(getHelpRowKeys(t("labels.selectAll"))).toBeNull();
    expect(getHelpRowKeys(t("buttons.zoomIn"))).toEqual([
      getShortcutKey("Ctrl"),
      getShortcutKey("Shift"),
      "=",
    ]);
    expect(getHelpRowKeys(t("helpDialog.smartZoom"))).toEqual(["J"]);
    expect(getHelpRowKeys(t("helpDialog.dragToZoom"))).toEqual([
      "K",
      t("helpDialog.drag"),
    ]);
    // a fixed key (copy) shows as before
    expect(getHelpRowKeys(t("labels.copy"))).toEqual([
      getShortcutKey("Ctrl"),
      "C",
    ]);
  });

  it("shows the user keys in the basic help dialog", async () => {
    await renderEditor({
      keymap: { "tool:freedraw": ["W"], "tool:image": ["Alt+I"] },
    });
    openHelpDialog(false);

    expect(getHelpRowKeys(t("toolBar.freedraw"))).toEqual(["W"]);
    expect(getHelpRowKeys(t("toolBar.image"))).toEqual([
      getShortcutKey("Alt"),
      "I",
    ]);
    expect(getHelpRowKeys(t("toolBar.eraser"))).toEqual(["E"]);
  });

  it("builds the help dialog tool rows from the default keys", async () => {
    await renderEditor();
    openHelpDialog(true);

    expect(getHelpRowKeys(t("toolBar.hand"))).toEqual(["H"]);
    expect(getHelpRowKeys(t("toolBar.freedraw"))).toEqual(["P"]);
    expect(getHelpRowKeys(t("toolBar.autoshape"))).toEqual(["X"]);
    // F is smart zoom and I is the eye dropper
    expect(getHelpRowKeys(t("toolBar.frame"))).toBeNull();
    expect(getHelpRowKeys(t("toolBar.image"))).toBeNull();
  });
});
