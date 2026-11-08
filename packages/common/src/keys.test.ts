import { getLayoutIndependentKey, KEYS, matchKey } from "./keys";

const ev = (
  key: string,
  code: string,
  mods: { shiftKey?: boolean; altKey?: boolean } = {},
) => ({
  key,
  code,
  shiftKey: mods.shiftKey ?? false,
  altKey: mods.altKey ?? false,
});

describe("getLayoutIndependentKey", () => {
  describe("keeps the key of Latin layouts (regression)", () => {
    it.each([
      ["US letter", ev("r", "KeyR"), "r"],
      ["US shifted letter", ev("R", "KeyR", { shiftKey: true }), "R"],
      ["CapsLock letter", ev("R", "KeyR"), "R"],
      ["US digit", ev("2", "Digit2"), "2"],
      ["US question mark", ev("?", "Slash", { shiftKey: true }), "?"],
      ["US space", ev(" ", "Space"), " "],
      ["AZERTY a on KeyQ", ev("a", "KeyQ"), "a"],
      ["AZERTY & on Digit1", ev("&", "Digit1"), "&"],
      ["AZERTY é on Digit2", ev("é", "Digit2"), "é"],
      ["QWERTZ z on KeyY", ev("z", "KeyY"), "z"],
      ["QWERTZ ß on Minus", ev("ß", "Minus"), "ß"],
      ["QWERTZ § on Digit3", ev("§", "Digit3", { shiftKey: true }), "§"],
      ["AZERTY § on Slash", ev("§", "Slash", { shiftKey: true }), "§"],
      ["AZERTY ² on Backquote", ev("²", "Backquote"), "²"],
      ["UK £ on Digit3", ev("£", "Digit3", { shiftKey: true }), "£"],
      ["Spanish ¡ on Equal", ev("¡", "Equal"), "¡"],
      ["Dvorak o on KeyS", ev("o", "KeyS"), "o"],
      ["dead key", ev("Dead", "BracketLeft"), "Dead"],
      ["named key", ev("Escape", "Escape"), "Escape"],
      ["arrow key", ev("ArrowLeft", "ArrowLeft"), "ArrowLeft"],
      ["function key", ev("F1", "F1"), "F1"],
      ["modifier key", ev("Shift", "ShiftLeft"), "Shift"],
      ["macOS Option character", ev("∑", "KeyW", { altKey: true }), "∑"],
    ])("%s", (_, event, expected) => {
      expect(getLayoutIndependentKey(event)).toBe(expected);
    });
  });

  describe("macOS Zhuyin (Bopomofo characters)", () => {
    it.each([
      ["ㄐ on KeyR", ev("ㄐ", "KeyR"), "r"],
      ["ㄆ on KeyQ", ev("ㄆ", "KeyQ"), "q"],
      ["ㄉ on Digit2", ev("ㄉ", "Digit2"), "2"],
      ["ㄝ on Comma", ev("ㄝ", "Comma"), ","],
      ["ㄡ on Period", ev("ㄡ", "Period"), "."],
      ["ㄥ on Slash", ev("ㄥ", "Slash"), "/"],
      [
        "full-width ？ on Slash with Shift",
        ev("？", "Slash", { shiftKey: true }),
        "?",
      ],
      ["ㄦ on Minus", ev("ㄦ", "Minus"), "-"],
      ["ㄇ on KeyA with Shift", ev("ㄇ", "KeyA", { shiftKey: true }), "A"],
    ])("%s", (_, event, expected) => {
      expect(getLayoutIndependentKey(event)).toBe(expected);
    });
  });

  describe("other non-Latin layouts", () => {
    it.each([
      ["Russian я on KeyZ", ev("я", "KeyZ"), "z"],
      ["Greek ρ on KeyR", ev("ρ", "KeyR"), "r"],
      ["Hebrew ר on KeyR", ev("ר", "KeyR"), "r"],
      ["Korean ㄱ on KeyR", ev("ㄱ", "KeyR"), "r"],
      ["Japanese す on KeyR", ev("す", "KeyR"), "r"],
      ["Cangjie 口 on KeyR", ev("口", "KeyR"), "r"],
      ["Arabic numpad ٢ on Numpad2", ev("٢", "Numpad2"), "2"],
    ])("%s", (_, event, expected) => {
      expect(getLayoutIndependentKey(event)).toBe(expected);
    });
  });

  describe("input method reports Process / Unidentified", () => {
    it.each([
      ["Process on KeyR", ev("Process", "KeyR"), "r"],
      [
        "Process on KeyA with Shift",
        ev("Process", "KeyA", { shiftKey: true }),
        "A",
      ],
      ["Process on Digit2", ev("Process", "Digit2"), "2"],
      ["Process on Escape", ev("Process", "Escape"), "Escape"],
      ["Process on Delete", ev("Process", "Delete"), "Delete"],
      ["Process on NumpadEnter", ev("Process", "NumpadEnter"), "Enter"],
      ["Unidentified on KeyZ", ev("Unidentified", "KeyZ"), "z"],
      ["Process on an unknown code", ev("Process", "IntlRo"), "Process"],
    ])("%s", (_, event, expected) => {
      expect(getLayoutIndependentKey(event)).toBe(expected);
    });
  });

  it("returns a missing key as it is", () => {
    expect(
      getLayoutIndependentKey({
        key: undefined as unknown as string,
        code: "KeyZ",
        shiftKey: false,
        altKey: false,
      }),
    ).toBe(undefined);
  });
});

describe("matchKey", () => {
  const kb = (key: string, code: string) =>
    ({ key, code, shiftKey: false, altKey: false } as KeyboardEvent);

  it("matches Latin keys by key (regression)", () => {
    expect(matchKey(kb("z", "KeyZ"), KEYS.Z)).toBe(true);
    // AZERTY: the "a" key is on KeyQ
    expect(matchKey(kb("a", "KeyQ"), KEYS.A)).toBe(true);
    expect(matchKey(kb("a", "KeyQ"), KEYS.Q)).toBe(false);
  });

  it("matches non-Latin keys by physical key", () => {
    expect(matchKey(kb("ㄐ", "KeyR"), KEYS.R)).toBe(true);
    expect(matchKey(kb("я", "KeyZ"), KEYS.Z)).toBe(true);
    expect(matchKey(kb("Process", "KeyA"), KEYS.A)).toBe(true);
    expect(matchKey(kb("ㄐ", "KeyR"), KEYS.T)).toBe(false);
  });
});
