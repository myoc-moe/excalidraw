import { KEYS } from "@excalidraw/common";

import {
  DEFAULT_BINDINGS,
  formatCombo,
  getDefaultKeys,
  getKeymapEntries,
  matchesBinding,
  matchesCombo,
  parseCombo,
  resolveKeys,
} from "./keymap";

import { actions } from "./actions/register";
import { TOOLS } from "./components/Tools";

import type { BindingId } from "./keymap";

const ev = (
  key: string,
  mods: Partial<{
    code: string;
    ctrlKey: boolean;
    metaKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
  }> = {},
) => ({
  key,
  code: "",
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...mods,
});

const platform = vi.hoisted(() => ({ isMac: false }));

// `KEYS.CTRL_OR_CMD` and `isDarwin` are read from the platform when the code
// runs, so the tests switch the platform by `platform.isMac`
vi.mock("@excalidraw/common", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@excalidraw/common")>();
  const keys = Object.create(actual.KEYS, {
    CTRL_OR_CMD: {
      get: () => (platform.isMac ? "metaKey" : "ctrlKey"),
      enumerable: true,
    },
  });
  return new Proxy(actual, {
    get: (target, prop) =>
      prop === "isDarwin"
        ? platform.isMac
        : prop === "KEYS"
        ? keys
        : Reflect.get(target, prop),
  });
});

// every module registers its actions on import
import.meta.glob(["./actions/action*.{ts,tsx}", "!./actions/*.test.*"], {
  eager: true,
});

describe("parseCombo", () => {
  it("parses modifiers and key per platform", () => {
    expect(parseCombo("Mod+Shift+z", true)).toEqual({
      ctrl: false,
      meta: true,
      alt: false,
      shift: true,
      key: "Z",
    });
    expect(parseCombo("Mod+Shift+Z", false)).toMatchObject({
      ctrl: true,
      meta: false,
    });
    expect(parseCombo("Ctrl+R", true)).toMatchObject({ ctrl: true });
    expect(parseCombo("Alt+R", false)).toMatchObject({ alt: true, key: "R" });
  });

  it("parses a plus key and named keys", () => {
    expect(parseCombo("Mod++", false)).toMatchObject({ ctrl: true, key: "+" });
    expect(parseCombo("+", false)).toMatchObject({ key: "+" });
    expect(parseCombo("Mod+Shift+ArrowUp", false)).toMatchObject({
      key: "ArrowUp",
    });
  });

  it("rejects invalid combos", () => {
    expect(parseCombo("Foo+R", false)).toBeNull();
    expect(parseCombo("", false)).toBeNull();
    expect(parseCombo("Mod+", false)).toBeNull();
  });
});

describe("matchesCombo", () => {
  it("matches Mod as Cmd on Mac", () => {
    expect(matchesCombo(ev("z", { metaKey: true }), "Mod+Z", true)).toBe(true);
    expect(matchesCombo(ev("z", { ctrlKey: true }), "Mod+Z", true)).toBe(false);
  });

  it("matches Mod as Ctrl on Windows", () => {
    expect(matchesCombo(ev("z", { ctrlKey: true }), "Mod+Z", false)).toBe(true);
    expect(matchesCombo(ev("z", { metaKey: true }), "Mod+Z", false)).toBe(
      false,
    );
  });

  it("requires exact modifiers", () => {
    expect(matchesCombo(ev("r"), "R", false)).toBe(true);
    expect(matchesCombo(ev("R", { shiftKey: true }), "R", false)).toBe(false);
    expect(matchesCombo(ev("r", { ctrlKey: true }), "R", false)).toBe(false);
    expect(matchesCombo(ev("R", { shiftKey: true }), "Shift+R", false)).toBe(
      true,
    );
  });

  it("matches symbols", () => {
    expect(matchesCombo(ev("]", { ctrlKey: true }), "Mod+]", false)).toBe(true);
    expect(matchesCombo(ev("?", { shiftKey: true }), "?", false)).toBe(true);
    expect(
      matchesCombo(ev("+", { ctrlKey: true, shiftKey: true }), "Mod++", false),
    ).toBe(true);
    // a combo from the user keymap matches by character only
    expect(
      matchesCombo(
        ev("}", { ctrlKey: true, shiftKey: true, code: "BracketRight" }),
        "Mod+Shift+]",
        false,
      ),
    ).toBe(false);
  });

  it("requires Shift off for symbol combos without Shift", () => {
    expect(matchesCombo(ev("[", { ctrlKey: true }), "Mod+[", false)).toBe(true);
    expect(
      matchesCombo(ev("[", { ctrlKey: true, shiftKey: true }), "Mod+[", false),
    ).toBe(false);
    expect(
      matchesCombo(
        ev("{", { ctrlKey: true, shiftKey: true, code: "BracketLeft" }),
        "Mod+[",
        false,
      ),
    ).toBe(false);
  });

  it("matches Alt defaults by the physical key, other user combos by character", () => {
    const option = ev("®", { altKey: true, code: "KeyR" });
    expect(matchesBinding(option, "action:viewMode", null, true)).toBe(true);
    expect(matchesCombo(option, "Alt+R", true)).toBe(false);
    // a user combo equal to a default combo matches as that default
    expect(
      matchesBinding(
        option,
        "action:viewMode",
        { "action:viewMode": ["Alt+R"] },
        true,
      ),
    ).toBe(true);
    // a user combo that is not a default combo matches by character
    expect(
      matchesBinding(
        ev("†", { altKey: true, code: "KeyT" }),
        "action:viewMode",
        { "action:viewMode": ["Alt+T"] },
        true,
      ),
    ).toBe(false);
    expect(
      matchesBinding(
        ev("t", { altKey: true, code: "KeyT" }),
        "action:viewMode",
        { "action:viewMode": ["Alt+T"] },
        true,
      ),
    ).toBe(true);
  });

  it("matches a user combo equal to a default combo by the default codes", () => {
    const keymap = { "action:zoomIn": ["Mod++"] };
    // Ctrl and the `=` key, as the default
    expect(
      matchesBinding(
        ev("=", { ctrlKey: true, code: "Equal" }),
        "action:zoomIn",
        keymap,
        false,
      ),
    ).toBe(true);
    expect(
      matchesBinding(
        ev("+", { ctrlKey: true, code: "NumpadAdd" }),
        "action:zoomIn",
        keymap,
        false,
      ),
    ).toBe(true);
    // the other default combos are removed
    expect(
      matchesBinding(
        ev("+", { shiftKey: true, code: "Equal" }),
        "action:zoomIn",
        keymap,
        false,
      ),
    ).toBe(false);
  });

  it("normalizes the event key of a non-Latin layout", () => {
    // Cyrillic layout: "о" on the J key
    const event = ev("о", { ctrlKey: true, code: "KeyJ" });
    expect(
      matchesBinding(
        event,
        "action:searchMenu",
        { "action:searchMenu": ["Mod+J"] },
        false,
      ),
    ).toBe(true);
    // CapsLock: "J" with no Shift is "j"
    expect(
      matchesBinding(
        ev("J", { code: "KeyJ" }),
        "tool:rectangle",
        { "tool:rectangle": ["J"] },
        false,
      ),
    ).toBe(true);
  });

  it("does not match with a letter and Shift on another physical key", () => {
    expect(
      matchesCombo(ev("P", { shiftKey: true, code: "KeyR" }), "Shift+R", false),
    ).toBe(false);
  });
});

describe("resolveKeys", () => {
  it("keeps defaults for an absent id", () => {
    expect(resolveKeys("tool:rectangle", {}, false)).toEqual(["R"]);
    expect(resolveKeys("tool:rectangle", undefined, false)).toEqual(["R"]);
  });

  it("replaces all defaults for a present id", () => {
    const keymap = { "action:redo": ["Mod+Shift+R"] };
    expect(resolveKeys("action:redo", keymap, false)).toEqual(["Mod+Shift+R"]);
    expect(
      matchesBinding(ev("y", { ctrlKey: true }), "action:redo", keymap, false),
    ).toBe(false);
  });

  it("removes the keys with an empty list", () => {
    const keymap = { "tool:rectangle": [] };
    expect(resolveKeys("tool:rectangle", keymap, false)).toEqual([]);
    expect(matchesBinding(ev("r"), "tool:rectangle", keymap, false)).toBe(
      false,
    );
  });

  it("uses platform defaults", () => {
    expect(getDefaultKeys("action:sendToBack", true)).toEqual(["Mod+Alt+["]);
    expect(getDefaultKeys("action:sendToBack", false)).toEqual(["Mod+Shift+["]);
  });

  it("matches the old shortcuts", () => {
    expect(
      matchesBinding(ev("y", { ctrlKey: true }), "action:redo", null, false),
    ).toBe(true);
    expect(matchesBinding(ev("q"), "editor:toolLock", null, false)).toBe(true);
  });
});

describe("formatCombo", () => {
  it("returns the display parts", () => {
    expect(formatCombo("Shift+R")).toEqual(["Shift", "R"]);
    expect(formatCombo("Mod+Shift+ArrowUp").slice(-1)).toEqual(["Up"]);
    expect(formatCombo("Alt+Shift+R")).toEqual(["Shift", "Alt", "R"]);
    expect(formatCombo("bad+R")).toEqual([]);
  });
});

describe("getKeymapEntries", () => {
  const entries = getKeymapEntries(false);

  it("lists every binding once with a group and a label", () => {
    expect(entries.map((entry) => entry.id).sort()).toEqual(
      (Object.keys(DEFAULT_BINDINGS) as BindingId[]).sort(),
    );
    for (const entry of entries) {
      expect(["tools", "edit", "arrange", "view"]).toContain(entry.group);
      expect(entry.label).not.toBe("");
      expect(entry.label).not.toBe(entry.labelKey);
    }
  });

  it("has valid default combos", () => {
    for (const entry of entries) {
      for (const combo of entry.defaultKeys) {
        expect(parseCombo(combo, false)).not.toBeNull();
      }
    }
  });
});

describe("parity with the tools", () => {
  it("has a binding for every tool and the other way round", () => {
    const toolIds = Object.keys(DEFAULT_BINDINGS)
      .filter((id) => id.startsWith("tool:"))
      .sort();
    expect(toolIds).toEqual(
      Object.keys(TOOLS)
        .map((type) => `tool:${type}`)
        .sort(),
    );
  });

  it("has the default keys of the tools", () => {
    const keys = Object.fromEntries(
      Object.keys(TOOLS).map((type) => [
        type,
        getDefaultKeys(`tool:${type}` as BindingId, false),
      ]),
    );
    expect(keys).toEqual({
      hand: ["H"],
      selection: ["V"],
      rectangle: ["R"],
      diamond: ["D"],
      ellipse: ["O"],
      arrow: ["A"],
      line: ["L"],
      freedraw: ["P"],
      text: ["T"],
      image: [],
      eraser: ["E"],
      // smart zoom takes F first
      frame: [],
      autoshape: ["X"],
      embeddable: [],
      laser: [],
      bucketfill: [],
      lasso: [],
    });
  });
});

// actions with a `keyTest` that are not bindable
const NOT_BINDABLE_ACTIONS: Record<string, string> = {
  // keys with a state guard: they stay fixed
  deselect: "Escape with a state guard",
  finalize: "Escape and Enter with a state guard",
  deleteSelectedElements: "Delete and Backspace stay fixed",
  // the `keyTest` always returns `false`
  saveToActiveFile: "no key",
  // viewpoint keys stay fixed
  flipViewpointHorizontal: "viewpoint key",
  flipViewpointVertical: "viewpoint key",
  // the browser fires its copy and cut events on these keys (D6)
  copy: "fixed: native copy event",
  cut: "fixed: native cut event",
};

// US QWERTY: unshifted symbol -> [code, shifted symbol]
const SYMBOL_KEYS: Record<string, [string, string]> = {
  "-": ["Minus", "_"],
  "=": ["Equal", "+"],
  "[": ["BracketLeft", "{"],
  "]": ["BracketRight", "}"],
  "'": ["Quote", '"'],
  "/": ["Slash", "?"],
  ",": ["Comma", "<"],
  ".": ["Period", ">"],
};
const SHIFTED_TO_BASE: Record<string, string> = Object.fromEntries(
  Object.entries(SYMBOL_KEYS).map(([base, [, shifted]]) => [shifted, base]),
);

/** the event a US QWERTY keyboard sends for the combo */
const synthesizeEvent = (combo: string, isMac: boolean) => {
  const parsed = parseCombo(combo, isMac)!;
  let { key } = parsed;
  let code = "";
  let shiftKey = parsed.shift;
  if (/^[A-Z]$/.test(key)) {
    code = `Key${key}`;
    key = shiftKey ? key : key.toLowerCase();
  } else if (/^[0-9]$/.test(key)) {
    code = `Digit${key}`;
  } else if (key === "+") {
    // the numpad plus key, or Shift and `=`
    code = shiftKey ? "Equal" : "NumpadAdd";
  } else if (SYMBOL_KEYS[key]) {
    code = SYMBOL_KEYS[key][0];
    if (shiftKey) {
      key = SYMBOL_KEYS[key][1];
    }
  } else if (SHIFTED_TO_BASE[key]) {
    // a shifted symbol: the user holds Shift
    code = SYMBOL_KEYS[SHIFTED_TO_BASE[key]][0];
    shiftKey = true;
  }
  return {
    key,
    code,
    ctrlKey: parsed.ctrl,
    metaKey: parsed.meta,
    altKey: parsed.alt,
    shiftKey,
  };
};

describe.each([
  ["Mac", true],
  ["Windows", false],
])("parity with the action key tests on %s", (_name, isMac) => {
  beforeAll(() => {
    platform.isMac = isMac;
    expect(KEYS.CTRL_OR_CMD).toBe(isMac ? "metaKey" : "ctrlKey");
  });

  afterAll(() => {
    platform.isMac = false;
  });

  it("has a binding for every action with a key test", () => {
    const missing = actions
      .filter(
        (action) =>
          typeof action.keyTest === "function" &&
          !(action.name in NOT_BINDABLE_ACTIONS) &&
          !(`action:${action.name}` in DEFAULT_BINDINGS),
      )
      .map((action) => action.name);
    expect(missing).toEqual([]);
  });

  it("has an action for every action binding", () => {
    const names = new Set<string>(actions.map((action) => action.name));
    const missing = Object.keys(DEFAULT_BINDINGS).filter(
      (id) =>
        id.startsWith("action:") &&
        // undo and redo come from `createUndoAction` and `createRedoAction`
        // (they need the history), so they are not in the registry
        !["action:undo", "action:redo"].includes(id) &&
        !names.has(id.slice(7)),
    );
    expect(missing).toEqual([]);
  });

  const getKeyTest = (id: BindingId) =>
    actions.find((a) => `action:${a.name}` === id)?.keyTest;

  const callKeyTest = (id: BindingId, event: ReturnType<typeof ev>) =>
    getKeyTest(id)?.(
      event as any,
      { selectedElementIds: { a: true } } as any,
      [],
      { scene: { getSelectedElements: () => [{}] } } as any,
    );

  const cases = (Object.keys(DEFAULT_BINDINGS) as BindingId[])
    .filter((id) => id.startsWith("action:") && getKeyTest(id) !== undefined)
    .flatMap((id) =>
      getDefaultKeys(id, isMac).map((combo) => [id, combo] as const),
    );

  it("has default combos to compare", () => {
    expect(cases.length).toBeGreaterThan(30);
  });

  it.each(cases)("%s %s passes the real key test and matches", (id, combo) => {
    const event = synthesizeEvent(combo, isMac);
    expect(callKeyTest(id, event)).toBe(true);
    expect(matchesBinding(event, id, null, isMac)).toBe(true);
    // a user combo matches by character only, so only for combos with none
    // of the physical-key codes
    const codes = DEFAULT_BINDINGS[id as "action:undo"] as {
      codes?: Record<string, readonly string[]>;
    };
    for (const code of codes.codes?.[combo] ?? []) {
      expect(matchesBinding({ ...event, code }, id, null, isMac)).toBe(true);
    }
  });

  it.each([
    ["editor:eyeDropperStroke", "I"],
    ["editor:eyeDropperStroke", "Shift+S"],
    ["editor:eyeDropperBackground", "Shift+I"],
    ["editor:strokePicker", "S"],
    ["editor:backgroundPicker", "G"],
    ["editor:fontPicker", "Shift+F"],
    ["editor:toolLock", "Q"],
    ["editor:smartZoom", "F"],
    ["editor:holdZoom", "Z"],
  ] as const)("%s has the default %s", (id, combo) => {
    expect(getDefaultKeys(id, isMac)).toContain(combo);
    expect(matchesBinding(synthesizeEvent(combo, isMac), id, null, isMac)).toBe(
      true,
    );
  });

  it("has no default combo that two bindings share", () => {
    const owners = new Map<string, string>();
    for (const id of Object.keys(DEFAULT_BINDINGS) as BindingId[]) {
      for (const combo of getDefaultKeys(id, isMac)) {
        expect(`${combo}:${owners.get(combo)}`).toBe(`${combo}:undefined`);
        owners.set(combo, id);
      }
    }
  });

  it("does not match a default combo with codes by character", () => {
    // `Mod+0` in the layout of a key that sends "0" on another physical key
    const event = ev("0", {
      code: "KeyQ",
      ctrlKey: !isMac,
      metaKey: isMac,
    });
    expect(matchesBinding(event, "action:resetZoom", null, isMac)).toBe(false);
    expect(callKeyTest("action:resetZoom", event)).toBe(false);
  });

  it("matches AZERTY Mod+0 (key à, code Digit0) as reset zoom", () => {
    const event = ev("à", {
      code: "Digit0",
      ctrlKey: !isMac,
      metaKey: isMac,
    });
    expect(callKeyTest("action:resetZoom", event)).toBe(true);
    expect(matchesBinding(event, "action:resetZoom", null, isMac)).toBe(true);
  });

  it("matches German Mod+Shift+0 (key =, code Digit0) once, as reset zoom", () => {
    const event = ev("=", {
      code: "Digit0",
      ctrlKey: !isMac,
      metaKey: isMac,
      shiftKey: true,
    });
    const matching = (Object.keys(DEFAULT_BINDINGS) as BindingId[]).filter(
      (id) => matchesBinding(event, id, null, isMac),
    );
    expect(matching).toEqual(["action:resetZoom"]);
    // the same action as the real key tests reach today
    const reached = actions
      .filter(
        (action) =>
          action.keyTest &&
          callKeyTest(`action:${action.name}` as BindingId, event),
      )
      .map((action) => action.name);
    expect(reached).toEqual(["resetZoom"]);
  });

  it("matches a user combo by character only", () => {
    const keymap = { "action:resetZoom": ["Mod+9"] };
    const nine = ev("9", {
      code: "Digit9",
      ctrlKey: !isMac,
      metaKey: isMac,
    });
    expect(matchesBinding(nine, "action:resetZoom", keymap, isMac)).toBe(true);
    // the same character on another physical key still matches
    expect(
      matchesBinding(
        { ...nine, code: "KeyQ" },
        "action:resetZoom",
        keymap,
        isMac,
      ),
    ).toBe(true);
    // the old physical key no longer does
    expect(
      matchesBinding(
        ev("à", { code: "Digit0", ctrlKey: !isMac, metaKey: isMac }),
        "action:resetZoom",
        keymap,
        isMac,
      ),
    ).toBe(false);
  });
});
