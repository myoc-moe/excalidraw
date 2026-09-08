import { getShortcutKey } from "./shortcut";

import type { ActionName } from "./actions/types";

type KeyboardShortcutModifiers = {
  ctrlOrCmd?: boolean;
  ctrl?: boolean;
  meta?: boolean;
  alt?: boolean;
  shift?: boolean;
};

export type KeyboardShortcut = KeyboardShortcutModifiers &
  (
    | {
        /** `KeyboardEvent.key` (case-insensitive for single letters). */
        key: string;
        code?: never;
      }
    | {
        /** `KeyboardEvent.code`, useful for layout-independent shortcuts. */
        code: string;
        key?: never;
      }
  );

export type KeyboardShortcutCommand =
  | ActionName
  | `tool:${
      | "hand"
      | "selection"
      | "rectangle"
      | "diamond"
      | "ellipse"
      | "arrow"
      | "line"
      | "freedraw"
      | "text"
      | "image"
      | "eraser"
      | "frame"
      | "autoshape"
      | "embeddable"
      | "laser"
      | "bucketfill"
      | "lasso"}`
  | "toolLock"
  | "strokeEyeDropper"
  | "backgroundEyeDropper"
  | "helpDialog"
  | "imageExport"
  | "elementStroke"
  | "elementBackground"
  | "fontFamily";

/**
 * A partial, controlled set of shortcut overrides. Missing commands retain
 * Excalidraw's defaults; an empty array explicitly disables a command.
 */
export type KeyboardShortcutOverrides = Partial<
  Record<KeyboardShortcutCommand, readonly KeyboardShortcut[]>
>;

export const matchesKeyboardShortcut = (
  event: Pick<
    KeyboardEvent,
    "key" | "code" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey"
  >,
  shortcut: KeyboardShortcut,
) => {
  if (!shortcut.key && !shortcut.code) {
    return false;
  }

  const keyMatches = shortcut.key
    ? shortcut.key.length === 1
      ? event.key.toLocaleLowerCase() === shortcut.key.toLocaleLowerCase()
      : event.key === shortcut.key
    : true;
  const codeMatches = shortcut.code ? event.code === shortcut.code : true;
  const ctrlOrCmd = shortcut.ctrlOrCmd === true;

  return (
    keyMatches &&
    codeMatches &&
    (ctrlOrCmd
      ? event.ctrlKey || event.metaKey
      : event.ctrlKey === !!shortcut.ctrl) &&
    (ctrlOrCmd ? true : event.metaKey === !!shortcut.meta) &&
    event.altKey === !!shortcut.alt &&
    event.shiftKey === !!shortcut.shift
  );
};

export const matchesKeyboardShortcuts = (
  event: Parameters<typeof matchesKeyboardShortcut>[0],
  shortcuts: readonly KeyboardShortcut[],
) => shortcuts.some((shortcut) => matchesKeyboardShortcut(event, shortcut));

export const formatKeyboardShortcut = (shortcut: KeyboardShortcut) => {
  const modifiers = [
    shortcut.ctrlOrCmd && "CtrlOrCmd",
    shortcut.ctrl && "Ctrl",
    shortcut.meta && "Meta",
    shortcut.alt && "Alt",
    shortcut.shift && "Shift",
  ].filter(Boolean);
  const key = shortcut.key ?? shortcut.code ?? "";
  return getShortcutKey(
    [...modifiers, key.length === 1 ? key.toLocaleUpperCase() : key].join("+"),
  );
};
