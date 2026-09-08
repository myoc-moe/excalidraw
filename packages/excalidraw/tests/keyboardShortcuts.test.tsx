import React from "react";

import { Excalidraw } from "../index";

import { act, fireEvent, GlobalTestState, render } from "./test-utils";

describe("MyOC regression: host-controlled keyboard shortcuts", () => {
  it("overrides a tool shortcut and removes its default binding", async () => {
    await render(
      <Excalidraw
        autoFocus
        handleKeyboardGlobally
        keyboardShortcuts={{ "tool:freedraw": [{ key: "d" }] }}
      />,
    );

    fireEvent.keyDown(document, { key: "d", code: "KeyD" });
    expect(window.h.state.activeTool.type).toBe("freedraw");

    act(() => window.h.app.setActiveTool({ type: "selection" }));
    fireEvent.keyDown(document, { key: "p", code: "KeyP" });
    expect(window.h.state.activeTool.type).toBe("selection");

    const button = GlobalTestState.renderResult.container.querySelector(
      '[data-testid="toolbar-freedraw"]',
    );
    expect(button).toHaveAttribute("aria-keyshortcuts", "D");
  });

  it("supports action overrides and explicit disabling", async () => {
    await render(
      <Excalidraw
        autoFocus
        handleKeyboardGlobally
        keyboardShortcuts={{
          objectsSnapMode: [{ key: "m", alt: true }],
          toolLock: [],
        }}
      />,
    );

    expect(window.h.state.objectsSnapModeEnabled).toBe(false);
    fireEvent.keyDown(document, { key: "s", code: "KeyS", altKey: true });
    expect(window.h.state.objectsSnapModeEnabled).toBe(false);
    fireEvent.keyDown(document, { key: "m", code: "KeyM", altKey: true });
    expect(window.h.state.objectsSnapModeEnabled).toBe(true);

    fireEvent.keyDown(document, { key: "q", code: "KeyQ" });
    expect(window.h.state.activeTool.locked).toBe(false);
  });

  it("reacts to controlled prop updates and accepts multiple bindings", async () => {
    const result = await render(
      <Excalidraw
        autoFocus
        handleKeyboardGlobally
        keyboardShortcuts={{
          "tool:freedraw": [{ key: "j" }, { key: "k", shift: true }],
        }}
      />,
    );

    fireEvent.keyDown(document, { key: "K", code: "KeyK", shiftKey: true });
    expect(window.h.state.activeTool.type).toBe("freedraw");

    act(() => window.h.app.setActiveTool({ type: "selection" }));
    result.rerender(
      <Excalidraw
        autoFocus
        handleKeyboardGlobally
        keyboardShortcuts={{ "tool:freedraw": [{ key: "u" }] }}
      />,
    );
    fireEvent.keyDown(document, { key: "j", code: "KeyJ" });
    expect(window.h.state.activeTool.type).toBe("selection");
    fireEvent.keyDown(document, { key: "u", code: "KeyU" });
    expect(window.h.state.activeTool.type).toBe("freedraw");
  });

  it("leaves parent-owned number keys unclaimed by default", async () => {
    await render(<Excalidraw autoFocus handleKeyboardGlobally />);

    for (const key of ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"]) {
      const event = new KeyboardEvent("keydown", {
        key,
        code: `Digit${key}`,
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    }
  });
});
