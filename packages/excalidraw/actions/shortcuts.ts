import { isWindows } from "@excalidraw/common";

import type { SubtypeOf } from "@excalidraw/common/utility-types";

import { t } from "../i18n";
import {
  getDefaultKeys,
  isBindingId,
  parseCombo,
  resolveKeys,
} from "../keymap";
import { getShortcutKey } from "../shortcut";

import type { BindingId, Keymap } from "../keymap";

import type { ActionName } from "./types";

export type ShortcutName =
  | SubtypeOf<
      ActionName,
      | "toggleTheme"
      | "loadScene"
      | "cut"
      | "copy"
      | "paste"
      | "copyStyles"
      | "pasteStyles"
      | "selectAll"
      | "deleteSelectedElements"
      | "duplicateSelection"
      | "sendBackward"
      | "bringForward"
      | "sendToBack"
      | "bringToFront"
      | "copyAsPng"
      | "group"
      | "ungroup"
      | "gridMode"
      | "objectsSnapMode"
      | "stats"
      | "viewMode"
      | "flipHorizontal"
      | "flipVertical"
      | "flipViewpointHorizontal"
      | "flipViewpointVertical"
      | "hyperlink"
      | "toggleElementLock"
      | "resetZoom"
      | "zoomOut"
      | "zoomIn"
      | "zoomToFit"
      | "zoomToFitSelectionInViewport"
      | "zoomToFitSelection"
      | "smartZoom"
      | "saveFileToDisk"
      | "saveToActiveFile"
      | "toggleShortcuts"
      | "wrapSelectionInFrame"
      | "arrangeElements"
    >
  | "saveScene"
  | "imageExport"
  | "searchMenu"
  | "toolLock";

const KEY_NAMES: Readonly<Record<string, string>> = {
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
};

/**
 * The label of a combo, e.g. `Ctrl+Shift+Z` (`Cmd` for `Mod` on macOS).
 * Returns `""` for an invalid combo.
 */
export const formatComboLabel = (combo: string): string => {
  const parsed = parseCombo(combo);
  if (!parsed) {
    return "";
  }
  const parts: string[] = [];
  if (parsed.ctrl) {
    parts.push(t("keys.ctrl"));
  }
  if (parsed.meta) {
    parts.push(t("keys.cmd"));
  }
  // Shift before Alt, as the labels of the editor always were
  if (parsed.shift) {
    parts.push(getShortcutKey("Shift"));
  }
  if (parsed.alt) {
    parts.push(getShortcutKey("Alt"));
  }
  parts.push(KEY_NAMES[parsed.key] ?? getShortcutKey(parsed.key));
  return parts.join("+");
};

/**
 * Default combos that labels show when the user did not change the binding.
 * Other bindings show their first default combo only.
 */
const DEFAULT_SHOWN_KEYS: Partial<Record<BindingId, () => string[]>> = {
  "action:redo": () => (isWindows ? ["Mod+Y", "Mod+Shift+Z"] : ["Mod+Shift+Z"]),
  "editor:eyeDropperStroke": () => getDefaultKeys("editor:eyeDropperStroke"),
};

/**
 * The labels of a binding, one per key: all keys of a user binding, else the
 * default keys that labels show.
 */
export const getBindingLabels = (
  id: BindingId,
  keymap?: Keymap | null,
): string[] => {
  const combos =
    keymap && Object.prototype.hasOwnProperty.call(keymap, id)
      ? resolveKeys(id, keymap)
      : DEFAULT_SHOWN_KEYS[id]?.() ?? getDefaultKeys(id).slice(0, 1);
  return combos.map(formatComboLabel).filter(Boolean);
};

/** the labels as one text: several keys show joined with "or" */
export const joinLabels = (labels: readonly string[]) =>
  labels.join(` ${t("helpDialog.or")} `);

/** commands that have a fixed key, which the user cannot change */
const FIXED_SHORTCUTS: Partial<Record<ShortcutName, string[]>> = {
  saveScene: [getShortcutKey("CtrlOrCmd+S")],
  imageExport: [getShortcutKey("CtrlOrCmd+Shift+E")],
  paste: [getShortcutKey("CtrlOrCmd+V")],
  copyStyles: [getShortcutKey("CtrlOrCmd+Alt+C")],
  pasteStyles: [getShortcutKey("CtrlOrCmd+Alt+V")],
  deleteSelectedElements: [getShortcutKey("Delete")],
  flipViewpointHorizontal: [getShortcutKey("Shift+R")],
  flipViewpointVertical: [getShortcutKey("Alt+Shift+R")],
  saveToActiveFile: [getShortcutKey("CtrlOrCmd+S")],
};

const SHORTCUT_NAMES: Record<ShortcutName, true> = {
  toggleTheme: true,
  loadScene: true,
  cut: true,
  copy: true,
  paste: true,
  copyStyles: true,
  pasteStyles: true,
  selectAll: true,
  deleteSelectedElements: true,
  duplicateSelection: true,
  sendBackward: true,
  bringForward: true,
  sendToBack: true,
  bringToFront: true,
  copyAsPng: true,
  group: true,
  ungroup: true,
  gridMode: true,
  objectsSnapMode: true,
  stats: true,
  viewMode: true,
  flipHorizontal: true,
  flipVertical: true,
  flipViewpointHorizontal: true,
  flipViewpointVertical: true,
  hyperlink: true,
  toggleElementLock: true,
  resetZoom: true,
  zoomOut: true,
  zoomIn: true,
  zoomToFit: true,
  zoomToFitSelectionInViewport: true,
  zoomToFitSelection: true,
  smartZoom: true,
  saveFileToDisk: true,
  saveToActiveFile: true,
  toggleShortcuts: true,
  wrapSelectionInFrame: true,
  arrangeElements: true,
  saveScene: true,
  imageExport: true,
  searchMenu: true,
  toolLock: true,
};

const getShortcutBindingId = (name: string): BindingId | null => {
  const id =
    name === "toolLock" || name === "smartZoom"
      ? `editor:${name}`
      : `action:${name}`;
  return isBindingId(id) ? id : null;
};

/**
 * The legacy shortcut names show their default keys; any other bindable action
 * shows a key only when the user bound it.
 */
const getShortcutLabels = (name: string, keymap?: Keymap | null) => {
  const id = getShortcutBindingId(name);
  if (!id) {
    return FIXED_SHORTCUTS[name as ShortcutName] ?? [];
  }
  const isBoundByUser =
    keymap && Object.prototype.hasOwnProperty.call(keymap, id);
  if (
    !isBoundByUser &&
    !Object.prototype.hasOwnProperty.call(SHORTCUT_NAMES, name)
  ) {
    return [];
  }
  return getBindingLabels(id, keymap);
};

/**
 * The label of a command: several keys show joined with "or". `idx` picks one
 * shortcut of the command instead.
 */
export const getShortcutFromShortcutName = (
  name: ShortcutName,
  idx?: number,
  keymap?: Keymap | null,
) => {
  const labels = getShortcutLabels(name, keymap);
  if (idx === undefined) {
    return joinLabels(labels);
  }
  if (name === "duplicateSelection" && idx === 1) {
    // the second shortcut is the drag, which is not a key
    return getShortcutKey(`Alt+${t("helpDialog.drag")}`);
  }
  return labels[idx] || labels[0] || "";
};

/** The label of an action for the command catalog. */
export const getActionShortcut = (
  name: string,
  keymap?: Keymap | null,
): string | undefined =>
  joinLabels(getShortcutLabels(name, keymap)) || undefined;

/** a tooltip: the name and, when the binding has keys, its keys */
export const getTitleWithShortcut = (
  label: string,
  id: BindingId,
  keymap?: Keymap | null,
) => {
  const shortcut = joinLabels(getBindingLabels(id, keymap));
  return shortcut ? `${label} — ${shortcut}` : label;
};
