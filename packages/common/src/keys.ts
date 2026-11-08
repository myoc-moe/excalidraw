import { isDarwin } from "./editorInterface";

import type { ValueOf } from "./utility-types";

export const CODES = {
  EQUAL: "Equal",
  MINUS: "Minus",
  NUM_ADD: "NumpadAdd",
  NUM_SUBTRACT: "NumpadSubtract",
  NUM_ZERO: "Numpad0",
  BRACKET_RIGHT: "BracketRight",
  BRACKET_LEFT: "BracketLeft",
  ONE: "Digit1",
  TWO: "Digit2",
  THREE: "Digit3",
  NINE: "Digit9",
  QUOTE: "Quote",
  ZERO: "Digit0",
  SLASH: "Slash",
  C: "KeyC",
  D: "KeyD",
  H: "KeyH",
  V: "KeyV",
  Z: "KeyZ",
  Y: "KeyY",
  R: "KeyR",
  S: "KeyS",
} as const;

export const KEYS = {
  ARROW_DOWN: "ArrowDown",
  ARROW_LEFT: "ArrowLeft",
  ARROW_RIGHT: "ArrowRight",
  ARROW_UP: "ArrowUp",
  PAGE_UP: "PageUp",
  PAGE_DOWN: "PageDown",
  BACKSPACE: "Backspace",
  ALT: "Alt",
  CTRL_OR_CMD: isDarwin ? "metaKey" : "ctrlKey",
  DELETE: "Delete",
  ENTER: "Enter",
  ESCAPE: "Escape",
  QUESTION_MARK: "?",
  SPACE: " ",
  TAB: "Tab",
  CHEVRON_LEFT: "<",
  CHEVRON_RIGHT: ">",
  PERIOD: ".",
  COMMA: ",",
  SUBTRACT: "-",
  SLASH: "/",

  A: "a",
  B: "b",
  C: "c",
  D: "d",
  E: "e",
  F: "f",
  G: "g",
  H: "h",
  I: "i",
  L: "l",
  O: "o",
  P: "p",
  Q: "q",
  R: "r",
  S: "s",
  T: "t",
  V: "v",
  X: "x",
  Y: "y",
  Z: "z",
  K: "k",
  W: "w",

  0: "0",
  1: "1",
  2: "2",
  3: "3",
  4: "4",
  5: "5",
  6: "6",
  7: "7",
  8: "8",
  9: "9",
} as const;

export type Key = keyof typeof KEYS;

// defines key code mapping for matching codes as fallback to respective keys on non-latin keyboard layouts
export const KeyCodeMap = new Map<ValueOf<typeof KEYS>, ValueOf<typeof CODES>>([
  [KEYS.Z, CODES.Z],
  [KEYS.Y, CODES.Y],
]);

export const isLatinChar = (key: string) => /^[a-z]$/.test(key.toLowerCase());

// US QWERTY characters for the printable physical keys, as [plain, shifted]
const US_QWERTY_CODE_CHARS: Readonly<
  Record<string, readonly [string, string]>
> = {
  Digit0: ["0", ")"],
  Digit1: ["1", "!"],
  Digit2: ["2", "@"],
  Digit3: ["3", "#"],
  Digit4: ["4", "$"],
  Digit5: ["5", "%"],
  Digit6: ["6", "^"],
  Digit7: ["7", "&"],
  Digit8: ["8", "*"],
  Digit9: ["9", "("],
  Minus: ["-", "_"],
  Equal: ["=", "+"],
  BracketLeft: ["[", "{"],
  BracketRight: ["]", "}"],
  Backslash: ["\\", "|"],
  Semicolon: [";", ":"],
  Quote: ["'", '"'],
  Backquote: ["`", "~"],
  Comma: [",", "<"],
  Period: [".", ">"],
  Slash: ["/", "?"],
  Space: [" ", " "],
};

// physical keys whose `event.key` is the code name itself, used when the
// input method reports "Process" or "Unidentified" for them
const NAMED_KEY_CODES: Readonly<Record<string, string>> = {
  Escape: "Escape",
  Enter: "Enter",
  NumpadEnter: "Enter",
  Tab: "Tab",
  Backspace: "Backspace",
  Delete: "Delete",
  ArrowUp: "ArrowUp",
  ArrowDown: "ArrowDown",
  ArrowLeft: "ArrowLeft",
  ArrowRight: "ArrowRight",
};

// `event.key` values that do not name a key: the input method kept the key
// back. ("Dead" is left out: dead keys occur on Latin layouts, which keep
// their own behaviour.)
const UNRESOLVED_KEYS = new Set(["Process", "Unidentified"]);

// named keys: "Escape", "ArrowLeft", "PageUp", "F1", "Shift", ...
const NAMED_KEY_RE = /^[A-Z][A-Za-z0-9]+$/;

// a character of a non-Latin script (Bopomofo, Cyrillic, Greek, Hebrew, Han,
// Kana, Hangul, ...) or a full-width form ("？"). Latin letters and the
// Common-script symbols of Latin layouts ("&", "§", "£", "°", Option
// characters on macOS) do not match.
const NON_LATIN_KEY_RE =
  /[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]|[\uFF01-\uFF5E]/u;

/**
 * Returns the key that shortcuts compare against, for any keyboard layout or
 * input method.
 *
 * - A Latin letter, a symbol (ASCII, or Common script such as "§", "£")
 *   and a named key (`Escape`, `ArrowLeft`, ...) stay as they are, so Latin
 *   layouts (US, AZERTY, QWERTZ, Dvorak, ...) keep their own behaviour.
 * - A non-Latin character (macOS Zhuyin "ㄐ", Cyrillic "я", Greek, Hebrew,
 *   CJK, full-width punctuation) and "Process" / "Unidentified" become the
 *   US QWERTY character of the physical key (`event.code`), e.g.
 *   "ㄐ" on `KeyR` becomes "r".
 *
 * With Alt the key stays as it is: Option changes the character on macOS,
 * and Alt shortcuts compare `event.code`.
 */
export const getLayoutIndependentKey = (event: {
  key: string;
  code: string;
  shiftKey: boolean;
  altKey: boolean;
}): string => {
  const { key, code } = event;
  // synthetic events may carry no key or code
  if (typeof key !== "string" || typeof code !== "string") {
    return key;
  }

  const isUnresolved = UNRESOLVED_KEYS.has(key);
  if (
    !isUnresolved &&
    (NAMED_KEY_RE.test(key) || event.altKey || !NON_LATIN_KEY_RE.test(key))
  ) {
    return key;
  }

  if (/^Key[A-Z]$/.test(code)) {
    const letter = code.slice(3);
    return event.shiftKey ? letter : letter.toLowerCase();
  }
  // the digit also when NumLock is off; numpad operators keep their key
  const numpadDigit = /^Numpad([0-9])$/.exec(code);
  if (numpadDigit) {
    return numpadDigit[1];
  }
  const chars = US_QWERTY_CODE_CHARS[code];
  if (chars) {
    return event.shiftKey ? chars[1] : chars[0];
  }
  if (isUnresolved && NAMED_KEY_CODES[code]) {
    return NAMED_KEY_CODES[code];
  }

  return key;
};

/**
 * Used to match key events for any keyboard layout, especially on Windows and Linux,
 * where non-latin character with modified (CMD) is not substituted with latin-based alternative.
 *
 * Uses `event.key` when it's latin, otherwise fallbacks to `event.code` (if mapping exists).
 *
 * Example of pressing "z" on different layouts, with the chosen key or code highlighted in []:
 *
 * Layout                | Code  | Key | Comment
 * --------------------- | ----- | --- | -------
 * U.S.                  |  KeyZ  | [z] |
 * Czech                 |  KeyY  | [z] |
 * Turkish               |  KeyN  | [z] |
 * French                |  KeyW  | [z] |
 * Macedonian            | [KeyZ] |  з  | z with cmd; з is Cyrillic equivalent of z
 * Russian               | [KeyZ] |  я  | z with cmd
 * Serbian               | [KeyZ] |  ѕ  | z with cmd
 * Greek                 | [KeyZ] |  ζ  | z with cmd; also ζ is Greek equivalent of z
 * Hebrew                | [KeyZ] |  ז  | z with cmd; also ז is Hebrew equivalent of z
 * Pinyin - Simplified   |  KeyZ  | [z] | due to IME
 * Cangije - Traditional | [KeyZ] |  重 | z with cmd
 * Japanese              | [KeyZ] |  つ | z with cmd
 * 2-Set Korean          | [KeyZ] |  ㅋ | z with cmd
 *
 * More details in https://github.com/excalidraw/excalidraw/pull/5944
 */
export const matchKey = (
  event: KeyboardEvent | React.KeyboardEvent<Element>,
  key: ValueOf<typeof KEYS>,
): boolean => {
  // for latin layouts use key
  if (key === event.key.toLowerCase()) {
    return true;
  }

  // non-latin layouts and input methods fall back to the physical key
  if (getLayoutIndependentKey(event).toLowerCase() === key) {
    return true;
  }

  // kept for Alt + a non-Latin key, which `getLayoutIndependentKey` leaves
  // as it is
  const code = KeyCodeMap.get(key);
  return Boolean(code && !isLatinChar(event.key) && event.code === code);
};

export const isArrowKey = (key: string) =>
  key === KEYS.ARROW_LEFT ||
  key === KEYS.ARROW_RIGHT ||
  key === KEYS.ARROW_DOWN ||
  key === KEYS.ARROW_UP;

export const shouldResizeFromCenter = (event: MouseEvent | KeyboardEvent) =>
  event.altKey;

export const shouldMaintainAspectRatio = (event: MouseEvent | KeyboardEvent) =>
  event.shiftKey;

export const shouldRotateWithDiscreteAngle = (
  event: MouseEvent | KeyboardEvent | React.PointerEvent<HTMLCanvasElement>,
) => event.shiftKey;
