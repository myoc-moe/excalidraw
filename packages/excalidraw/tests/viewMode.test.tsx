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

  it("does not open links on right click", async () => {
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

    mouse.moveTo(elementCenterX, elementCenterY);
    expect(GlobalTestState.interactiveCanvas.style.cursor).toBe(
      CURSOR_TYPE.POINTER,
    );

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

    fireEvent.pointerDown(GlobalTestState.interactiveCanvas, {
      button: 0,
      clientX: elementCenterX,
      clientY: elementCenterY,
      pointerType: "mouse",
      pointerId: 1,
    });
    fireEvent.pointerUp(GlobalTestState.interactiveCanvas, {
      button: 0,
      clientX: elementCenterX,
      clientY: elementCenterY,
      pointerType: "mouse",
      pointerId: 1,
    });

    expect(onLinkOpenSpy).toHaveBeenCalledTimes(1);
    expect(onLinkOpenSpy.mock.calls[0][0].link).toBe("https://example.com");
  });

  it("shows link actions in the context menu", async () => {
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
    API.setAppState({ viewModeEnabled: true });

    const elementCenterX = linkedRect.x + linkedRect.width / 2;
    const elementCenterY = linkedRect.y + linkedRect.height / 2;

    mouse.rightClickAt(elementCenterX, elementCenterY);

    let contextMenuItems = Array.from(
      UI.queryContextMenu()?.querySelectorAll("li") ?? [],
    ).map((item) => item.dataset.testid);

    expect(contextMenuItems).toEqual(expect.arrayContaining(["goToLink"]));
    expect(contextMenuItems).toEqual(expect.arrayContaining(["copyLink"]));

    API.setAppState({ viewModeEnabled: false });
    API.setSelectedElements([linkedRect]);
    mouse.rightClickAt(elementCenterX, elementCenterY);

    contextMenuItems = Array.from(
      UI.queryContextMenu()?.querySelectorAll("li") ?? [],
    ).map((item) => item.dataset.testid);

    expect(contextMenuItems).toEqual(expect.arrayContaining(["goToLink"]));
    expect(contextMenuItems).toEqual(expect.arrayContaining(["copyLink"]));

    API.updateElement(linkedRect, {
      link: `${window.location.origin}/?element=${linkedRect.id}`,
    });
    API.setAppState({ viewModeEnabled: true });
    mouse.rightClickAt(elementCenterX, elementCenterY);

    contextMenuItems = Array.from(
      UI.queryContextMenu()?.querySelectorAll("li") ?? [],
    ).map((item) => item.dataset.testid);

    expect(contextMenuItems).toEqual(expect.arrayContaining(["goToLink"]));
    expect(contextMenuItems).not.toEqual(expect.arrayContaining(["copyLink"]));
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

  it("shows smart zoom in the view-mode canvas context menu", async () => {
    API.setAppState({ viewModeEnabled: true });

    fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
      button: 2,
      clientX: 1,
      clientY: 1,
    });

    expect(
      UI.queryContextMenu()?.querySelector('li[data-testid="smartZoom"]'),
    ).not.toBeNull();
  });

  it("smart zooms to a right-clicked element in view mode", async () => {
    const setViewportSpy = vi.spyOn(window.h.app.viewport, "setViewport");
    const rectangle = API.createElement({
      type: "rectangle",
      x: 20,
      y: 20,
      width: 120,
      height: 90,
    });

    API.setElements([rectangle]);
    API.setAppState({ viewModeEnabled: true });

    mouse.rightClickAt(80, 65);

    const smartZoomItem = UI.queryContextMenu()?.querySelector(
      'li[data-testid="smartZoom"]',
    );
    expect(smartZoomItem).not.toBeNull();
    expect(smartZoomItem?.querySelector("kbd")?.textContent).toBe("F");

    fireEvent.click(smartZoomItem!);

    expect(setViewportSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        target: [rectangle],
      }),
    );
    expect(window.h.state.viewModeEnabled).toBe(true);
  });
});
