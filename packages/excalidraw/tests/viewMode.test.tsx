import React from "react";
import { vi } from "vitest";

import { CURSOR_TYPE, KEYS } from "@excalidraw/common";

import { Excalidraw } from "../index";
import { actionToggleViewMode } from "../actions/actionToggleViewMode";

import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import {
  fireEvent,
  render,
  GlobalTestState,
  mockBoundingClientRect,
  restoreOriginalGetBoundingClientRect,
  unmountComponent,
  act,
} from "./test-utils";

import type { ExcalidrawProps } from "../types";

const mouse = new Pointer("mouse");
const touch = new Pointer("touch");
const pen = new Pointer("pen");
const pointerTypes = [mouse, touch, pen];

describe("view mode", () => {
  beforeAll(() => {
    mockBoundingClientRect();
  });

  afterAll(() => {
    restoreOriginalGetBoundingClientRect();
  });

  beforeEach(async () => {
    await render(<Excalidraw compressImageFile={async (file) => file} />);
  });

  it("after switching to view mode  Ecursor type should be pointer", async () => {
    API.setAppState({ viewModeEnabled: true });
    expect(GlobalTestState.interactiveCanvas.style.cursor).toBe(
      CURSOR_TYPE.GRAB,
    );
  });

  it("after switching to view mode, moving, clicking, and pressing space key  Ecursor type should be pointer", async () => {
    API.setAppState({ viewModeEnabled: true });

    pointerTypes.forEach((pointerType) => {
      const pointer = pointerType;
      pointer.reset();
      pointer.move(100, 100);
      pointer.click();
      Keyboard.keyPress(KEYS.SPACE);
      expect(GlobalTestState.interactiveCanvas.style.cursor).toBe(
        CURSOR_TYPE.GRAB,
      );
    });
  });

  it("cursor should stay as grabbing type when hovering over canvas elements", async () => {
    // create a rectangle, then hover over it  Ecursor should be
    // move type for mouse and grab for touch & pen
    // then switch to view-mode and cursor should be grabbing type
    UI.createElement("rectangle", { size: 100 });

    pointerTypes.forEach((pointerType) => {
      const pointer = pointerType;

      pointer.moveTo(50, 50);
      // eslint-disable-next-line dot-notation
      if (pointerType["pointerType"] === "mouse") {
        expect(GlobalTestState.interactiveCanvas.style.cursor).toBe(
          CURSOR_TYPE.MOVE,
        );
      } else {
        expect(GlobalTestState.interactiveCanvas.style.cursor).toBe(
          CURSOR_TYPE.GRAB,
        );
      }

      API.setAppState({ viewModeEnabled: true });
      expect(GlobalTestState.interactiveCanvas.style.cursor).toBe(
        CURSOR_TYPE.GRAB,
      );
    });
  });

  it.skip("does not open links on right click and opens them from the context menu", async () => {
    unmountComponent();

    const onLinkOpenSpy = vi.fn();
    const onLinkOpen: NonNullable<ExcalidrawProps["onLinkOpen"]> = (
      ...args
    ) => {
      onLinkOpenSpy(...args);
      args[1].preventDefault();
    };

    await render(
      <Excalidraw
        compressImageFile={async (file) => file}
        onLinkOpen={onLinkOpen}
        viewModeEnabled={true}
      />,
    );

    const linkedRect = API.createElement({
      type: "rectangle",
      x: 20,
      y: 20,
      width: 120,
      height: 90,
    });
    API.setElements([linkedRect]);
    API.updateElement(linkedRect, {
      link: "https://example.com",
    });

    const elementCenterX = linkedRect.x + linkedRect.width / 2;
    const elementCenterY = linkedRect.y + linkedRect.height / 2;

    fireEvent.pointerDown(GlobalTestState.interactiveCanvas, {
      button: 2,
      clientX: elementCenterX,
      clientY: elementCenterY,
      pointerType: "mouse",
      pointerId: 1,
    });
    fireEvent.pointerUp(GlobalTestState.interactiveCanvas, {
      button: 2,
      clientX: elementCenterX,
      clientY: elementCenterY,
      pointerType: "mouse",
      pointerId: 1,
    });

    expect(onLinkOpenSpy).not.toHaveBeenCalled();

    API.setSelectedElements([linkedRect]);
    mouse.rightClickAt(elementCenterX, elementCenterY);

    const openLinkItem = UI.queryContextMenu()?.querySelector(
      'li[data-testid="openLink"]',
    );
    expect(openLinkItem).not.toBeNull();

    fireEvent.click(openLinkItem!);
    expect(onLinkOpenSpy).toHaveBeenCalledTimes(1);
    expect(onLinkOpenSpy.mock.calls[0][0].link).toBe("https://example.com");
  });

  it("viewModeOnly hides toggles and prevents leaving view mode", async () => {
    unmountComponent();

    await render(
      <Excalidraw
        compressImageFile={async (file) => file}
        viewModeOnly={true}
      />,
    );

    expect(window.h.state.viewModeOnly).toBe(true);
    expect(window.h.state.viewModeEnabled).toBe(true);
    expect(document.querySelector('[data-testid="button-view-mode"]')).toBe(
      null,
    );

    fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
      button: 2,
      clientX: 1,
      clientY: 1,
    });
    expect(
      UI.queryContextMenu()?.querySelector('li[data-testid="viewMode"]'),
    ).toBeNull();

    API.executeAction(actionToggleViewMode);
    expect(window.h.state.viewModeEnabled).toBe(true);

    act(() => {
      window.h.app.setAppState({ viewModeEnabled: false });
    });
    expect(window.h.state.viewModeEnabled).toBe(true);
  });
});
