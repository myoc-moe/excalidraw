import React from "react";
import { vi } from "vitest";

import { KEYS } from "@excalidraw/common";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import { fireEvent, render, waitFor } from "./test-utils";

describe("shortcuts", () => {
  it.skip("Clear canvas shortcut should display confirm dialog", async () => {
    await render(
      <Excalidraw
        initialData={{ elements: [API.createElement({ type: "rectangle" })] }}
        handleKeyboardGlobally
      />,
    );

    expect(window.h.elements.length).toBe(1);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyDown(KEYS.DELETE);
    });
    const confirmDialog = document.querySelector(".confirm-dialog")!;
    expect(confirmDialog).not.toBe(null);

    fireEvent.click(confirmDialog.querySelector('[aria-label="Confirm"]')!);

    await waitFor(() => {
      expect(window.h.elements[0].isDeleted).toBe(true);
    });
  });
});

// Shortcuts must work for any keyboard layout and input method. Latin
// layouts match by `event.key`; non-Latin layouts and input methods (macOS
// Zhuyin, Russian, "Process" from an IME) match by the physical key.
describe("shortcuts with non-Latin layouts and input methods", () => {
  const h = window.h;

  type Layout = {
    name: string;
    // `event.key` for a physical key, without and with Shift
    key: (code: string, shift?: boolean) => string;
    // the physical key that gives "?" with Shift (default: Slash)
    questionMarkCode?: string;
  };

  const usKey = (code: string, shift = false) => {
    const map: Record<string, [string, string]> = {
      Slash: ["/", "?"],
      Digit2: ["2", "@"],
    };
    if (code.startsWith("Key")) {
      const letter = code.slice(3);
      return shift ? letter : letter.toLowerCase();
    }
    return map[code]?.[shift ? 1 : 0] ?? code;
  };

  const zhuyinKey = (code: string, shift = false) => {
    const map: Record<string, string> = {
      KeyR: "ㄐ",
      KeyT: "ㄔ",
      KeyQ: "ㄆ",
      KeyA: "ㄇ",
      KeyD: "ㄎ",
      KeyZ: "ㄈ",
      KeyE: "ㄍ",
      Slash: shift ? "？" : "ㄥ",
    };
    return map[code] ?? code;
  };

  const russianKey = (code: string, shift = false) => {
    const map: Record<string, string> = {
      KeyR: "к",
      KeyT: "е",
      KeyQ: "й",
      KeyA: "ф",
      KeyD: "в",
      KeyZ: "я",
      KeyE: "у",
      // the Russian layout has "?" on Shift+7
      Digit7: shift ? "?" : "7",
      Slash: shift ? "," : ".",
    };
    return map[code] ?? code;
  };

  const LAYOUTS: Layout[] = [
    { name: "US (regression)", key: usKey },
    { name: "macOS Zhuyin", key: zhuyinKey },
    { name: "Russian", key: russianKey, questionMarkCode: "Digit7" },
    {
      name: "input method Process",
      key: () => "Process",
    },
  ];

  const press = (
    layout: Layout,
    code: string,
    mods: { ctrlKey?: boolean; shiftKey?: boolean } = {},
  ) => {
    const init = {
      key:
        code === "Delete" ? layout.key(code) : layout.key(code, mods.shiftKey),
      code,
      ctrlKey: !!mods.ctrlKey,
      shiftKey: !!mods.shiftKey,
    };
    fireEvent.keyDown(document, init);
    fireEvent.keyUp(document, init);
  };

  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally />);
  });

  for (const layout of LAYOUTS) {
    describe(layout.name, () => {
      it("R selects the rectangle tool and T the text tool", () => {
        press(layout, "KeyR");
        expect(h.state.activeTool.type).toBe("rectangle");
        press(layout, "KeyT");
        expect(h.state.activeTool.type).toBe("text");
      });

      it("E selects the eraser tool", () => {
        press(layout, "KeyE");
        expect(h.state.activeTool.type).toBe("eraser");
      });

      it("Q locks the tool", () => {
        press(layout, "KeyQ");
        expect(h.state.activeTool.locked).toBe(true);
      });

      it("Shift+? opens the help dialog", () => {
        press(layout, layout.questionMarkCode ?? "Slash", { shiftKey: true });
        expect(h.state.openDialog?.name).toBe("help");
      });

      it("Ctrl+A selects all, Ctrl+D duplicates, Ctrl+Z undoes", () => {
        API.setElements([
          API.createElement({ type: "rectangle", x: 0, y: 0 }),
          API.createElement({ type: "ellipse", x: 100, y: 0 }),
        ]);
        press(layout, "KeyA", { ctrlKey: true });
        expect(Object.keys(h.state.selectedElementIds)).toHaveLength(2);

        press(layout, "KeyD", { ctrlKey: true });
        expect(h.elements.filter((el) => !el.isDeleted)).toHaveLength(4);

        press(layout, "KeyZ", { ctrlKey: true });
        expect(h.elements.filter((el) => !el.isDeleted)).toHaveLength(2);
      });
    });
  }

  it("Delete deletes the selection when an input method reports Process", () => {
    const rect = API.createElement({ type: "rectangle" });
    API.setElements([rect]);
    API.setAppState({ selectedElementIds: { [rect.id]: true } });
    fireEvent.keyDown(document, { key: "Process", code: "Delete" });
    expect(h.elements[0].isDeleted).toBe(true);
  });

  it("keeps Latin symbols outside ASCII (regression)", () => {
    // AZERTY: Shift on the "!" key gives "§"; it must not act as "?"
    fireEvent.keyDown(document, {
      key: "§",
      code: "Slash",
      shiftKey: true,
    });
    expect(h.state.openDialog).toBe(null);
  });

  it("ignores Escape while an input method composes in an input", () => {
    const handleKeyDown = vi.spyOn(h.app.actionManager, "handleKeyDown");
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    // the IME ends the composition with Escape: not a shortcut
    fireEvent.keyDown(input, {
      key: "Process",
      code: "Escape",
      isComposing: true,
    });
    expect(handleKeyDown).not.toHaveBeenCalled();

    // without a composition, Escape in an input still reaches the actions
    fireEvent.keyDown(input, { key: "Escape", code: "Escape" });
    expect(handleKeyDown).toHaveBeenCalled();

    input.remove();
    handleKeyDown.mockRestore();
  });

  it("keeps AZERTY letters on their own keys (regression)", () => {
    // AZERTY: the "a" key is on KeyQ, and the "q" key is on KeyA
    fireEvent.keyDown(document, { key: "a", code: "KeyQ" });
    expect(h.state.activeTool.type).toBe("arrow");
    expect(h.state.activeTool.locked).toBe(false);
  });

  it("keeps CapsLock letters working (regression)", () => {
    fireEvent.keyDown(document, { key: "R", code: "KeyR" });
    expect(h.state.activeTool.type).toBe("rectangle");
  });

  it("ignores keys while an input method composes text", () => {
    fireEvent.keyDown(document, {
      key: "Process",
      code: "KeyR",
      isComposing: true,
    });
    expect(h.state.activeTool.type).toBe("selection");
  });
});

describe("shortcuts with non-Latin layouts, keyboard on the container", () => {
  it("selects a tool from a React key event (macOS Zhuyin)", async () => {
    const { container } = await render(<Excalidraw />);
    const editor = container.querySelector(".excalidraw") as HTMLElement;
    fireEvent.keyDown(editor, { key: "ㄐ", code: "KeyR" });
    expect(window.h.state.activeTool.type).toBe("rectangle");
  });
});
