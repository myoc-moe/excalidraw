import { isDarwin } from "@excalidraw/common";

import {
  getBoundTextElement,
  hasBackground,
  isTextElement,
} from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { t } from "./i18n";
import { getShortcutKey } from "./shortcut";

import type { AppClassProperties, AppState } from "./types";

type LabelKey = Parameters<typeof t>[0];

export type KeymapGroup = "tools" | "edit" | "arrange" | "view";

type DefaultBinding = {
  /** default combos; the first one is shown in labels */
  keys: readonly string[];
  /** replaces `keys` on macOS */
  macKeys?: readonly string[];
  /**
   * `event.code` values by default combo, for the combos that match the
   * physical key today (their `keyTest` reads `event.code`). A default combo
   * with codes matches only by those codes, never by character; the modifiers
   * of the combo must still match. Combos of the user `keymap` match by
   * character only.
   */
  codes?: Readonly<Record<string, readonly string[]>>;
  /** i18n key of the human-readable name */
  labelKey: LabelKey;
  group: KeymapGroup;
  /**
   * State condition the command needs besides the key match (the state guard
   * of its action `keyTest`). The key handler must AND it with the match.
   */
  guard?: (
    appState: Readonly<AppState>,
    elements: readonly ExcalidrawElement[],
    app: AppClassProperties,
  ) => boolean;
};

/** checks every entry against `DefaultBinding` and keeps the ids as keys */
const defineBindings = <T extends Record<string, DefaultBinding>>(
  bindings: T,
) => bindings;

/** the state condition shared by the picker keys: something to change */
const hasSelectionOrDrawingTool = (
  appState: Readonly<AppState>,
  app: AppClassProperties,
) =>
  appState.activeTool.type !== "selection" ||
  app.scene.getSelectedElements(appState).length > 0;

const ZOOM_IN_CODES = ["Equal", "NumpadAdd"] as const;
const ZOOM_OUT_CODES = ["Minus", "NumpadSubtract"] as const;
const RESET_ZOOM_CODES = ["Digit0", "Numpad0"] as const;

const ALIGN_ARROW_KEYS = (arrow: string) => [`Mod+Shift+${arrow}`];

/**
 * Single source of the bindable commands and their default keys. Matching
 * and every label read from this table.
 *
 * Binding id: `action:<name>` and `tool:<type>` are the command catalog ids;
 * `editor:*` are the keys handled by the editor itself.
 */
export const DEFAULT_BINDINGS = defineBindings({
  // tools
  "tool:hand": { keys: ["H"], labelKey: "toolBar.hand", group: "tools" },
  "tool:selection": {
    keys: ["V"],
    labelKey: "toolBar.selection",
    group: "tools",
  },
  "tool:rectangle": {
    keys: ["R"],
    labelKey: "toolBar.rectangle",
    group: "tools",
  },
  "tool:diamond": { keys: ["D"], labelKey: "toolBar.diamond", group: "tools" },
  "tool:ellipse": { keys: ["O"], labelKey: "toolBar.ellipse", group: "tools" },
  "tool:arrow": { keys: ["A"], labelKey: "toolBar.arrow", group: "tools" },
  "tool:line": { keys: ["L"], labelKey: "toolBar.line", group: "tools" },
  "tool:freedraw": {
    keys: ["P"],
    labelKey: "toolBar.freedraw",
    group: "tools",
  },
  "tool:text": { keys: ["T"], labelKey: "toolBar.text", group: "tools" },
  "tool:eraser": { keys: ["E"], labelKey: "toolBar.eraser", group: "tools" },
  // smart zoom takes F first, so the frame tool has no default key
  "tool:frame": { keys: [], labelKey: "toolBar.frame", group: "tools" },
  "tool:autoshape": {
    keys: ["X"],
    labelKey: "toolBar.autoshape",
    group: "tools",
  },
  // tools without a key
  "tool:image": { keys: [], labelKey: "toolBar.image", group: "tools" },
  "tool:embeddable": {
    keys: [],
    labelKey: "toolBar.embeddable",
    group: "tools",
  },
  "tool:laser": { keys: [], labelKey: "toolBar.laser", group: "tools" },
  "tool:bucketfill": {
    keys: [],
    labelKey: "toolBar.bucketfill",
    group: "tools",
  },
  "tool:lasso": { keys: [], labelKey: "toolBar.lasso", group: "tools" },
  "editor:toolLock": { keys: ["Q"], labelKey: "toolBar.lock", group: "tools" },

  // edit
  "action:undo": { keys: ["Mod+Z"], labelKey: "buttons.undo", group: "edit" },
  "action:redo": {
    keys: ["Mod+Shift+Z", "Mod+Y"],
    labelKey: "buttons.redo",
    group: "edit",
  },
  "action:cut": { keys: ["Mod+X"], labelKey: "labels.cut", group: "edit" },
  "action:copy": { keys: ["Mod+C"], labelKey: "labels.copy", group: "edit" },
  "action:copyAsPng": {
    keys: ["Shift+Alt+C"],
    codes: { "Shift+Alt+C": ["KeyC"] },
    labelKey: "labels.copyAsPng",
    group: "edit",
  },
  "action:selectAll": {
    keys: ["Mod+A"],
    labelKey: "labels.selectAll",
    group: "edit",
  },
  "action:duplicateSelection": {
    keys: ["Mod+D"],
    labelKey: "labels.duplicateSelection",
    group: "edit",
  },
  "action:group": { keys: ["Mod+G"], labelKey: "labels.group", group: "edit" },
  "action:ungroup": {
    keys: ["Mod+Shift+G"],
    labelKey: "labels.ungroup",
    group: "edit",
  },
  "action:hyperlink": {
    keys: ["Mod+K"],
    labelKey: "toolBar.link",
    group: "edit",
  },
  "action:toggleElementLock": {
    keys: ["Mod+Shift+L"],
    labelKey: "helpDialog.toggleElementLock",
    group: "edit",
    // as the `keyTest` of the action: needs a selection
    guard: (appState, _elements, app) =>
      app.scene.getSelectedElements({
        selectedElementIds: appState.selectedElementIds,
        includeBoundTextElement: false,
      }).length > 0,
  },
  "action:flipHorizontal": {
    keys: ["Shift+H"],
    codes: { "Shift+H": ["KeyH"] },
    labelKey: "labels.flipHorizontal",
    group: "edit",
  },
  "action:flipVertical": {
    keys: ["Shift+V"],
    codes: { "Shift+V": ["KeyV"] },
    labelKey: "labels.flipVertical",
    group: "edit",
  },
  "action:decreaseFontSize": {
    keys: ["Mod+Shift+<", "Mod+Shift+,"],
    labelKey: "labels.decreaseFontSize",
    group: "edit",
  },
  "action:increaseFontSize": {
    keys: ["Mod+Shift+>", "Mod+Shift+."],
    labelKey: "labels.increaseFontSize",
    group: "edit",
  },
  "action:loadScene": {
    keys: ["Mod+O"],
    labelKey: "buttons.load",
    group: "edit",
  },
  "action:saveFileToDisk": {
    keys: ["Mod+Shift+S"],
    labelKey: "exportDialog.disk_title",
    group: "edit",
  },

  // arrange
  "action:arrangeElements": {
    keys: ["Shift+A"],
    labelKey: "labels.arrangeElements",
    group: "arrange",
  },
  "action:alignTop": {
    keys: ALIGN_ARROW_KEYS("ArrowUp"),
    labelKey: "labels.alignTop",
    group: "arrange",
  },
  "action:alignBottom": {
    keys: ALIGN_ARROW_KEYS("ArrowDown"),
    labelKey: "labels.alignBottom",
    group: "arrange",
  },
  "action:alignLeft": {
    keys: ALIGN_ARROW_KEYS("ArrowLeft"),
    labelKey: "labels.alignLeft",
    group: "arrange",
  },
  "action:alignRight": {
    keys: ALIGN_ARROW_KEYS("ArrowRight"),
    labelKey: "labels.alignRight",
    group: "arrange",
  },
  "action:distributeHorizontally": {
    keys: ["Alt+H"],
    codes: { "Alt+H": ["KeyH"] },
    labelKey: "labels.distributeHorizontally",
    group: "arrange",
  },
  "action:distributeVertically": {
    keys: ["Alt+V"],
    codes: { "Alt+V": ["KeyV"] },
    labelKey: "labels.distributeVertically",
    group: "arrange",
  },
  "action:sendBackward": {
    keys: ["Mod+["],
    codes: { "Mod+[": ["BracketLeft"] },
    labelKey: "labels.sendBackward",
    group: "arrange",
  },
  "action:bringForward": {
    keys: ["Mod+]"],
    codes: { "Mod+]": ["BracketRight"] },
    labelKey: "labels.bringForward",
    group: "arrange",
  },
  "action:sendToBack": {
    keys: ["Mod+Shift+["],
    macKeys: ["Mod+Alt+["],
    codes: {
      "Mod+Shift+[": ["BracketLeft"],
      "Mod+Alt+[": ["BracketLeft"],
    },
    labelKey: "labels.sendToBack",
    group: "arrange",
  },
  "action:bringToFront": {
    keys: ["Mod+Shift+]"],
    macKeys: ["Mod+Alt+]"],
    codes: {
      "Mod+Shift+]": ["BracketRight"],
      "Mod+Alt+]": ["BracketRight"],
    },
    labelKey: "labels.bringToFront",
    group: "arrange",
  },

  // view
  "action:zoomIn": {
    keys: ["Mod++", "Mod+Shift++", "Shift++"],
    codes: {
      "Mod++": ZOOM_IN_CODES,
      "Mod+Shift++": ZOOM_IN_CODES,
      "Shift++": ZOOM_IN_CODES,
    },
    labelKey: "buttons.zoomIn",
    group: "view",
  },
  "action:zoomOut": {
    keys: ["Mod+-", "Mod+Shift+-", "Shift+-"],
    codes: {
      "Mod+-": ZOOM_OUT_CODES,
      "Mod+Shift+-": ZOOM_OUT_CODES,
      "Shift+-": ZOOM_OUT_CODES,
    },
    labelKey: "buttons.zoomOut",
    group: "view",
  },
  "action:resetZoom": {
    keys: ["Mod+0", "Mod+Shift+0", "Shift+0"],
    codes: {
      "Mod+0": RESET_ZOOM_CODES,
      "Mod+Shift+0": RESET_ZOOM_CODES,
      "Shift+0": RESET_ZOOM_CODES,
    },
    labelKey: "buttons.resetZoom",
    group: "view",
  },
  "action:zoomToFit": {
    keys: [],
    labelKey: "helpDialog.zoomToFit",
    group: "view",
  },
  "action:zoomToFitSelection": {
    keys: [],
    labelKey: "helpDialog.zoomToSelection",
    group: "view",
  },
  "action:zoomToFitSelectionInViewport": {
    keys: [],
    labelKey: "labels.zoomToFitViewport",
    group: "view",
  },
  "action:gridMode": {
    keys: ["Mod+'"],
    codes: { "Mod+'": ["Quote"] },
    labelKey: "labels.toggleGrid",
    group: "view",
  },
  "action:objectsSnapMode": {
    keys: ["Alt+S"],
    codes: { "Alt+S": ["KeyS"] },
    labelKey: "buttons.objectsSnapMode",
    group: "view",
  },
  "action:stats": {
    keys: ["Alt+/"],
    codes: { "Alt+/": ["Slash"] },
    labelKey: "stats.fullTitle",
    group: "view",
  },
  "action:viewMode": {
    keys: ["Alt+R"],
    codes: { "Alt+R": ["KeyR"] },
    labelKey: "labels.viewMode",
    group: "view",
  },
  "action:toggleTheme": {
    keys: ["Shift+Alt+D"],
    codes: { "Shift+Alt+D": ["KeyD"] },
    labelKey: "buttons.darkMode",
    group: "view",
  },
  "action:searchMenu": {
    keys: ["Mod+F"],
    labelKey: "search.title",
    group: "view",
  },
  "action:toggleShortcuts": {
    keys: ["?"],
    labelKey: "helpDialog.shortcuts",
    group: "view",
  },
  // pickers and eye droppers
  "editor:eyeDropperStroke": {
    keys: ["I", "Shift+S"],
    labelKey: "labels.eyeDropperStroke",
    group: "edit",
  },
  "editor:eyeDropperBackground": {
    keys: ["Shift+I"],
    labelKey: "labels.eyeDropperBackground",
    group: "edit",
  },
  "editor:strokePicker": {
    keys: ["S"],
    labelKey: "labels.stroke",
    group: "edit",
    guard: (appState, _elements, app) =>
      hasSelectionOrDrawingTool(appState, app),
  },
  "editor:backgroundPicker": {
    keys: ["G"],
    labelKey: "labels.changeBackground",
    group: "edit",
    guard: (appState, _elements, app) =>
      hasSelectionOrDrawingTool(appState, app) &&
      (hasBackground(appState.activeTool.type) ||
        app.scene
          .getSelectedElements(appState)
          .some((element) => hasBackground(element.type))),
  },
  "editor:fontPicker": {
    keys: ["Shift+F"],
    labelKey: "labels.fontFamily",
    group: "edit",
    guard: (appState, _elements, app) =>
      hasSelectionOrDrawingTool(appState, app) &&
      (appState.activeTool.type === "text" ||
        app.scene
          .getSelectedElements(appState)
          .some(
            (element) =>
              isTextElement(element) ||
              getBoundTextElement(
                element,
                app.scene.getNonDeletedElementsMap(),
              ),
          )),
  },
  "editor:smartZoom": {
    keys: ["F"],
    labelKey: "helpDialog.smartZoom",
    group: "view",
  },
  "editor:holdZoom": {
    keys: ["Z"],
    labelKey: "helpDialog.dragToZoom",
    group: "view",
  },
});

export type BindingId = keyof typeof DEFAULT_BINDINGS;

/**
 * User overrides by binding id. A present id replaces all default keys of
 * that binding, `[]` removes them, an absent id keeps the defaults.
 */
export type Keymap = Partial<Record<BindingId, readonly string[]>>;

export type KeymapEntry = {
  id: BindingId;
  labelKey: LabelKey;
  /** the translated name */
  label: string;
  group: KeymapGroup;
  defaultKeys: string[];
};

export type ParsedCombo = {
  ctrl: boolean;
  meta: boolean;
  alt: boolean;
  shift: boolean;
  /** letters upper-case */
  key: string;
};

const BINDINGS: Readonly<Record<string, DefaultBinding>> = DEFAULT_BINDINGS;

export const isBindingId = (id: string): id is BindingId =>
  Object.prototype.hasOwnProperty.call(DEFAULT_BINDINGS, id);

export const getDefaultKeys = (
  id: BindingId,
  isMac: boolean = isDarwin,
): string[] => {
  const binding = BINDINGS[id];
  return [...((isMac && binding.macKeys) || binding.keys)];
};

/**
 * Parses `Mod+Shift+Z`. `Mod` is Cmd on macOS and Ctrl elsewhere, `Ctrl` is
 * the Control key on macOS and the same as `Mod` elsewhere. Returns `null`
 * for an invalid combo.
 */
export const parseCombo = (
  combo: string,
  isMac: boolean = isDarwin,
): ParsedCombo | null => {
  // the key can be "+" itself, e.g. "Mod++"
  let key: string;
  let modifiers: string[];
  if (combo === "+") {
    key = "+";
    modifiers = [];
  } else if (combo.endsWith("++")) {
    key = "+";
    modifiers = combo.slice(0, -2).split("+");
  } else {
    const parts = combo.split("+");
    key = parts[parts.length - 1];
    modifiers = parts.slice(0, -1);
  }

  if (!key) {
    return null;
  }

  const parsed: ParsedCombo = {
    ctrl: false,
    meta: false,
    alt: false,
    shift: false,
    key: key.length === 1 ? key.toUpperCase() : key,
  };

  for (const modifier of modifiers) {
    switch (modifier) {
      case "Mod":
        if (isMac) {
          parsed.meta = true;
        } else {
          parsed.ctrl = true;
        }
        break;
      case "Ctrl":
        parsed.ctrl = true;
        break;
      case "Alt":
        parsed.alt = true;
        break;
      case "Shift":
        parsed.shift = true;
        break;
      default:
        return null;
    }
  }

  return parsed;
};

const SHIFTED_SYMBOLS = '?<>+:"{}|_~!@#$%^&*()';

type KeyEventLike = Pick<
  KeyboardEvent,
  "key" | "code" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey"
>;

const matchesParsed = (event: KeyEventLike, combo: ParsedCombo): boolean => {
  if (
    event.ctrlKey !== combo.ctrl ||
    event.metaKey !== combo.meta ||
    event.altKey !== combo.alt
  ) {
    return false;
  }

  const eventKey = event.key;
  const keyMatches =
    typeof eventKey === "string" &&
    (eventKey.length === 1 ? eventKey.toUpperCase() : eventKey) === combo.key;
  // symbols that need Shift on a US keyboard: `event.key` already says so
  const isShiftedSymbol =
    combo.key.length === 1 && SHIFTED_SYMBOLS.includes(combo.key);

  if (keyMatches) {
    // a shifted symbol (`?`, `<`, ...) is already shifted in `event.key`, so
    // Shift is only compared when the combo names it; other symbols (`[`)
    // need Shift off
    return isShiftedSymbol && !combo.shift
      ? true
      : event.shiftKey === combo.shift;
  }

  return false;
};

/**
 * Whether the key event is exactly the combo, by character (`event.key`): all
 * modifiers must match. Pass an event that went through the key normalization
 * of the editor.
 */
export const matchesCombo = (
  event: KeyEventLike,
  combo: string,
  isMac: boolean = isDarwin,
): boolean => {
  const parsed = parseCombo(combo, isMac);
  return parsed !== null && matchesParsed(event, parsed);
};

/** The keys of a binding: the user keys when present, else the defaults. */
export const resolveKeys = (
  id: BindingId,
  keymap?: Keymap | null,
  isMac: boolean = isDarwin,
): string[] => {
  if (keymap && Object.prototype.hasOwnProperty.call(keymap, id)) {
    return [...(keymap[id] ?? [])];
  }
  return getDefaultKeys(id, isMac);
};

/**
 * Whether the event matches the binding. A default combo with `codes` matches
 * by the physical key only, as its `keyTest` does today; every other combo,
 * and every combo of the user `keymap`, matches by character only.
 */
export const matchesBinding = (
  event: KeyEventLike,
  id: BindingId,
  keymap?: Keymap | null,
  isMac: boolean = isDarwin,
): boolean => {
  const isUserBinding = Boolean(
    keymap && Object.prototype.hasOwnProperty.call(keymap, id),
  );
  const codes: Readonly<Record<string, readonly string[]>> =
    (!isUserBinding && BINDINGS[id].codes) || {};
  return resolveKeys(id, keymap, isMac).some((combo) => {
    const comboCodes = codes[combo];
    if (!comboCodes) {
      return matchesCombo(event, combo, isMac);
    }
    const parsed = parseCombo(combo, isMac);
    return (
      parsed !== null &&
      event.ctrlKey === parsed.ctrl &&
      event.metaKey === parsed.meta &&
      event.altKey === parsed.alt &&
      event.shiftKey === parsed.shift &&
      comboCodes.includes(event.code)
    );
  });
};

const ARROW_SYMBOLS: Readonly<Record<string, string>> = {
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
};

/**
 * The parts of a combo for display, e.g. `["Ctrl", "Shift", "Z"]`. Returns
 * `[]` for an invalid combo.
 */
export const formatCombo = (combo: string): string[] => {
  const parsed = parseCombo(combo, isDarwin);
  if (!parsed) {
    return [];
  }
  const parts: string[] = [];
  if (parsed.ctrl) {
    // on macOS `Ctrl` is the Control key; elsewhere `Mod` is Ctrl
    parts.push(t("keys.ctrl"));
  }
  if (parsed.meta) {
    parts.push(getShortcutKey("Cmd"));
  }
  if (parsed.alt) {
    parts.push(getShortcutKey("Alt"));
  }
  if (parsed.shift) {
    parts.push(getShortcutKey("Shift"));
  }
  parts.push(ARROW_SYMBOLS[parsed.key] ?? getShortcutKey(parsed.key));
  return parts;
};

/**
 * Every bindable command with its name, group and default keys. Pure: needs
 * no editor instance, so a settings page can list it with no canvas open.
 */
export const getKeymapEntries = (isMac: boolean = isDarwin): KeymapEntry[] =>
  (Object.keys(DEFAULT_BINDINGS) as BindingId[]).map((id) => {
    const { labelKey, group } = BINDINGS[id];
    return {
      id,
      labelKey,
      label: t(labelKey),
      group,
      defaultKeys: getDefaultKeys(id, isMac),
    };
  });
