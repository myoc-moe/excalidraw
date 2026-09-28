import { vi } from "vitest";

import { THEME, capitalizeString, resolvablePromise } from "@excalidraw/common";

import { getShortcutFromShortcutName } from "../actions/shortcuts";
import { t } from "../i18n";
import { Excalidraw } from "../index";
import {
  getToolShortcut,
  MYOC_SIMPLIFIED_EXTRA_TOOL_TYPES,
  MYOC_SIMPLIFIED_MAIN_TOOL_TYPES,
  TOOLS,
} from "../components/Tools";

import { act, render } from "./test-utils";

import type { Action } from "../actions/types";
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
