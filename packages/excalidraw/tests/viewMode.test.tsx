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

const getViewModeButtonIconPaths = () =>
  Array.from(
    document.querySelectorAll(
      '[data-testid="button-view-mode"] svg path',
    ) as NodeListOf<SVGPathElement>,
  ).map((path) => path.getAttribute("d"));

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

  it("MyOC regression: uses the pencil icon for the view-mode toggle while viewing", async () => {
    expect(
      document.querySelector('[data-testid="button-view-mode"]'),
    ).toHaveAttribute("aria-label", "View mode");
    expect(getViewModeButtonIconPaths()).toContain(
      "M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6",
    );

    API.setAppState({ viewModeEnabled: true });

    expect(
      document.querySelector('[data-testid="button-view-mode"]'),
    ).toHaveAttribute("aria-label", "Edit mode");
    expect(getViewModeButtonIconPaths()).toContain(
      "M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4",
    );
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

  it("MyOC regression: shows the held-F Smart Zoom hint and button state in view mode", () => {
    const dateNowSpy = vi.spyOn(Date, "now").mockReturnValue(0);

    try {
      API.setAppState({ viewModeEnabled: true });

      const editor = GlobalTestState.interactiveCanvas.closest(
        ".excalidraw",
      ) as HTMLElement;
      const smartZoomButton = document.querySelector<HTMLButtonElement>(
        ".smart-zoom-button button",
      );

      expect(smartZoomButton).not.toBeNull();
      expect(document.querySelector(".view-mode-hint .HintViewer")).toBeNull();

      fireEvent.keyDown(editor, { key: KEYS.F, code: "KeyF" });

      expect(smartZoomButton).toHaveClass("smart-zoom-button--key-held");
      expect(document.querySelector(".view-mode-hint .HintViewer")).not.toBe(
        null,
      );
      expect(document.querySelector(".view-mode-hint")?.textContent).toContain(
        "smart zoom",
      );

      dateNowSpy.mockReturnValue(301);
      fireEvent.keyUp(document, { key: KEYS.F, code: "KeyF" });

      expect(smartZoomButton).not.toHaveClass("smart-zoom-button--key-held");
      expect(document.querySelector(".view-mode-hint .HintViewer")).toBeNull();
    } finally {
      dateNowSpy.mockRestore();
    }
  });

  it("MyOC regression: F-click zooms the hit element and short F release zooms all elements", () => {
    const dateNowSpy = vi.spyOn(Date, "now").mockReturnValue(0);

    try {
      const setViewportSpy = vi.spyOn(window.h.app.viewport, "setViewport");
      const firstImage = API.createElement({
        type: "image",
        fileId: "f-click-image",
        x: 20,
        y: 20,
        width: 120,
        height: 90,
      });
      const secondRectangle = API.createElement({
        type: "rectangle",
        x: 200,
        y: 20,
        width: 120,
        height: 90,
      });

      API.setElements([firstImage, secondRectangle]);
      API.setSelectedElements([secondRectangle]);

      const editor = GlobalTestState.interactiveCanvas.closest(
        ".excalidraw",
      ) as HTMLElement;

      fireEvent.keyDown(editor, { key: KEYS.F, code: "KeyF" });
      expect(setViewportSpy).not.toHaveBeenCalled();

      mouse.clickAt(
        firstImage.x + firstImage.width / 2,
        firstImage.y + firstImage.height / 2,
      );

      expect(setViewportSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ target: [firstImage] }),
      );

      fireEvent.keyUp(document, { key: KEYS.F, code: "KeyF" });
      expect(setViewportSpy).toHaveBeenCalledTimes(1);

      setViewportSpy.mockClear();
      fireEvent.keyDown(editor, { key: KEYS.F, code: "KeyF" });
      dateNowSpy.mockReturnValue(299);
      fireEvent.keyUp(document, { key: KEYS.F, code: "KeyF" });

      expect(setViewportSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          target: [firstImage, secondRectangle],
        }),
      );

      setViewportSpy.mockClear();
      dateNowSpy.mockReturnValue(0);
      fireEvent.keyDown(editor, { key: KEYS.F, code: "KeyF" });
      dateNowSpy.mockReturnValue(301);
      fireEvent.keyUp(document, { key: KEYS.F, code: "KeyF" });

      expect(setViewportSpy).not.toHaveBeenCalled();
    } finally {
      dateNowSpy.mockRestore();
    }
  });

  it("MyOC regression: view-mode double-click smart zooms to the hit item", () => {
    const setViewportSpy = vi.spyOn(window.h.app.viewport, "setViewport");
    const image = API.createElement({
      type: "image",
      fileId: "double-click-image",
      x: 20,
      y: 20,
      width: 120,
      height: 90,
    });

    API.setElements([image]);
    API.setAppState({
      viewModeEnabled: true,
      selectedElementIds: {},
    });

    fireEvent.click(GlobalTestState.interactiveCanvas, {
      clientX: image.x + image.width / 2,
      clientY: image.y + image.height / 2,
    });
    setViewportSpy.mockClear();
    mouse.doubleClickAt(image.x + image.width / 2, image.y + image.height / 2);

    expect(setViewportSpy).toHaveBeenCalledTimes(1);
    expect(setViewportSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        target: [image],
      }),
    );
    expect(window.h.state.viewModeEnabled).toBe(true);
  });

  it("MyOC regression: view-mode double-click ignores empty space inside an element's bounds", () => {
    const setViewportSpy = vi.spyOn(window.h.app.viewport, "setViewport");
    const ellipse = API.createElement({
      type: "ellipse",
      x: 20,
      y: 20,
      width: 120,
      height: 90,
    });

    API.setElements([ellipse]);
    API.setAppState({
      viewModeEnabled: true,
      selectedElementIds: {},
    });

    mouse.doubleClickAt(ellipse.x + 2, ellipse.y + 2);

    expect(setViewportSpy).not.toHaveBeenCalled();
  });

  it("MyOC regression: arrow keys smart zoom through images in spatial reading order", () => {
    const setViewportSpy = vi.spyOn(window.h.app.viewport, "setViewport");
    const imageA = API.createElement({
      type: "image",
      fileId: "keyboard-smart-zoom-image-a",
      x: 20,
      y: 20,
      width: 120,
      height: 90,
      groupIds: ["keyboard-smart-zoom-group"],
    });
    const rectangle = API.createElement({
      type: "rectangle",
      x: 200,
      y: 20,
      width: 120,
      height: 90,
    });
    const imageB = API.createElement({
      type: "image",
      fileId: "keyboard-smart-zoom-image-b",
      x: 380,
      y: 20,
      width: 120,
      height: 90,
      groupIds: ["keyboard-smart-zoom-group"],
    });
    const imageC = API.createElement({
      type: "image",
      fileId: "keyboard-smart-zoom-image-c",
      x: 20,
      y: 200,
      width: 120,
      height: 90,
    });

    // Deliberately differs from canvas reading order. Grouping must not affect
    // the sequence, and non-images must be skipped.
    API.setElements([imageB, imageC, rectangle, imageA]);
    API.setAppState({ selectedElementIds: {}, selectedGroupIds: {} });
    const editor = GlobalTestState.interactiveCanvas.closest(
      ".excalidraw",
    ) as HTMLElement;

    Keyboard.keyPress(KEYS.ARROW_RIGHT, editor);
    expect(setViewportSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ target: [imageA] }),
    );

    Keyboard.keyPress(KEYS.ARROW_RIGHT, editor);
    expect(setViewportSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ target: [imageB] }),
    );

    Keyboard.keyPress(KEYS.ARROW_RIGHT, editor);
    expect(setViewportSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ target: [imageC] }),
    );

    Keyboard.keyPress(KEYS.ARROW_LEFT, editor);
    expect(setViewportSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ target: [imageB] }),
    );

    API.setSelectedElements([imageA]);
    setViewportSpy.mockClear();
    Keyboard.keyPress(KEYS.ARROW_RIGHT, editor);

    expect(setViewportSpy).not.toHaveBeenCalled();
  });

  it("MyOC regression: view-mode double-click smart zooms the hit item in a group", () => {
    const setViewportSpy = vi.spyOn(window.h.app.viewport, "setViewport");
    const imageA = API.createElement({
      type: "image",
      fileId: "double-click-group-image-a",
      x: 20,
      y: 20,
      width: 120,
      height: 90,
      groupIds: ["double-click-group"],
    });
    const imageB = API.createElement({
      type: "image",
      fileId: "double-click-group-image-b",
      x: 180,
      y: 20,
      width: 120,
      height: 90,
      groupIds: ["double-click-group"],
    });

    API.setElements([imageA, imageB]);
    API.setAppState({
      viewModeEnabled: true,
      selectedElementIds: {
        [imageA.id]: true,
        [imageB.id]: true,
      },
    });

    mouse.doubleClickAt(
      imageA.x + imageA.width / 2,
      imageA.y + imageA.height / 2,
    );

    expect(setViewportSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        target: [imageA],
      }),
    );
  });

  it("MyOC regression: double-click smart zooms the touched item instead of the selection", () => {
    const setViewportSpy = vi.spyOn(window.h.app.viewport, "setViewport");
    const selectedImage = API.createElement({
      type: "image",
      fileId: "selected-double-click-image",
      x: 20,
      y: 20,
      width: 120,
      height: 90,
      groupIds: ["unrelated-selected-group"],
    });
    const selectedGroupPeer = API.createElement({
      type: "image",
      fileId: "selected-double-click-group-peer",
      x: 20,
      y: 130,
      width: 120,
      height: 90,
      groupIds: ["unrelated-selected-group"],
    });
    const touchedImage = API.createElement({
      type: "image",
      fileId: "touched-double-click-image",
      x: 200,
      y: 20,
      width: 120,
      height: 90,
    });

    API.setElements([selectedImage, selectedGroupPeer, touchedImage]);

    API.setAppState({
      viewModeEnabled: true,
      selectedElementIds: {
        [selectedImage.id]: true,
        [selectedGroupPeer.id]: true,
      },
      selectedGroupIds: { "unrelated-selected-group": true },
    });

    setViewportSpy.mockClear();
    mouse.doubleClickAt(
      touchedImage.x + touchedImage.width / 2,
      touchedImage.y + touchedImage.height / 2,
    );

    expect(setViewportSpy).toHaveBeenCalledTimes(1);
    expect(setViewportSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        target: [touchedImage],
      }),
    );
    expect(window.h.state.viewModeEnabled).toBe(true);
  });
});
