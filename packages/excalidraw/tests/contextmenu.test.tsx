import React from "react";
import { vi } from "vitest";

import { setDateTimeForTests } from "@excalidraw/common";
import { KEYS, reseed } from "@excalidraw/common";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import {
  fireEvent,
  GlobalTestState,
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
  unmountComponent,
} from "./test-utils";

import type { ShortcutName } from "../actions/shortcuts";
import type { ActionName } from "../actions/types";

const mouse = new Pointer("mouse");

const queryContextMenuItem = (
  contextMenu: HTMLElement | null,
  item: ActionName | ShortcutName | string,
) =>
  contextMenu?.querySelector(`li[data-testid="${item}"]`) as HTMLElement | null;

const getContextMenuItems = () =>
  Array.from(UI.queryContextMenu()?.querySelectorAll("li") ?? []).map(
    (item) => item.dataset.testid!,
  );

unmountComponent();

describe("contextMenu element", () => {
  beforeEach(async () => {
    localStorage.clear();
    reseed(7);
    setDateTimeForTests("201933152653");

    await render(
      <Excalidraw
        compressImageFile={async (file) => file}
        handleKeyboardGlobally={true}
        initialData={{ appState: { myocSimplifiedMode: false } }}
      />,
    );
  });

  beforeAll(() => {
    mockBoundingClientRect();
  });

  afterAll(() => {
    restoreOriginalGetBoundingClientRect();
  });

  afterEach(() => {
    mouse.reset();
    mouse.down(0, 0);
  });

  it("shows context menu for canvas", () => {
    fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
      button: 2,
      clientX: 1,
      clientY: 1,
    });

    expect(getContextMenuItems()).toEqual(
      expect.arrayContaining([
        "paste",
        "selectAll",
        "gridMode",
        "objectsSnapMode",
        "arrowBinding",
        "midpointSnapping",
        "viewMode",
        "stats",
      ]),
    );
    expect(getContextMenuItems()).not.toEqual(
      expect.arrayContaining(["copyAsPng", "copyAsSvg"]),
    );
  });

  it("shows context menu for a selected element", () => {
    const rectangle = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    API.setElements([rectangle]);
    API.setSelectedElements([rectangle]);

    fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
      button: 2,
      clientX: 50,
      clientY: 50,
    });

    expect(getContextMenuItems()).toEqual([
      "cut",
      "copy",
      "paste",
      "wrapSelectionInFrame",
      "sendBackward",
      "bringForward",
      "sendToBack",
      "bringToFront",
      "flipHorizontal",
      "flipVertical",
      "hyperlink",
      "copyElementLink",
      "duplicateSelection",
      "toggleElementLock",
      "deleteSelectedElements",
    ]);
  });

  it("shows group action in context menu for multiple selected elements", () => {
    const rectangle1 = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    const rectangle2 = API.createElement({
      type: "rectangle",
      x: 110,
      y: 0,
      width: 100,
      height: 100,
    });
    API.setElements([rectangle1, rectangle2]);
    API.setSelectedElements([rectangle1, rectangle2]);

    fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
      button: 2,
      clientX: 50,
      clientY: 50,
    });

    expect(getContextMenuItems()).toEqual([
      "cut",
      "copy",
      "paste",
      "wrapSelectionInFrame",
      "group",
      "sendBackward",
      "bringForward",
      "sendToBack",
      "bringToFront",
      "flipHorizontal",
      "flipVertical",
      "duplicateSelection",
      "toggleElementLock",
      "deleteSelectedElements",
    ]);
  });

  it("shows ungroup action in context menu for grouped elements", () => {
    const rectangle1 = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    const rectangle2 = API.createElement({
      type: "rectangle",
      x: 110,
      y: 0,
      width: 100,
      height: 100,
    });
    API.setElements([rectangle1, rectangle2]);
    API.setSelectedElements([rectangle1, rectangle2]);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.G);
    });

    fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
      button: 2,
      clientX: 50,
      clientY: 50,
    });

    expect(getContextMenuItems()).toEqual([
      "cut",
      "copy",
      "paste",
      "wrapSelectionInFrame",
      "ungroup",
      "sendBackward",
      "bringForward",
      "sendToBack",
      "bringToFront",
      "flipHorizontal",
      "flipVertical",
      "copyElementLink",
      "duplicateSelection",
      "toggleElementLock",
      "deleteSelectedElements",
    ]);
  });

  it("does not show copy styles in the context menu", () => {
    const rectangle = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      backgroundColor: "red",
    });
    API.setElements([rectangle]);
    API.setSelectedElements([rectangle]);

    fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
      button: 2,
      clientX: 50,
      clientY: 50,
    });

    const contextMenu = UI.queryContextMenu();
    expect(queryContextMenuItem(contextMenu, "copyStyles")).toBeNull();
    expect(queryContextMenuItem(contextMenu, "pasteStyles")).toBeNull();
    expect(queryContextMenuItem(contextMenu, "copyAsPng")).toBeNull();
    expect(queryContextMenuItem(contextMenu, "copyAsSvg")).toBeNull();
  });

  it("right-clicking on a group selects whole group", () => {
    const rectangle1 = API.createElement({
      type: "rectangle",
      width: 100,
      backgroundColor: "red",
      fillStyle: "solid",
      groupIds: ["g1"],
    });
    const rectangle2 = API.createElement({
      type: "rectangle",
      width: 100,
      backgroundColor: "red",
      fillStyle: "solid",
      groupIds: ["g1"],
    });
    API.setElements([rectangle1, rectangle2]);

    mouse.rightClickAt(50, 50);

    expect(API.getSelectedElements()).toEqual([
      expect.objectContaining({ id: rectangle1.id }),
      expect.objectContaining({ id: rectangle2.id }),
    ]);
  });

  it("renders host image context menu items after paste and before wrap in frame", async () => {
    unmountComponent();

    const onSave = vi.fn();
    const imageContextMenuItems = vi.fn((imageIds: readonly string[]) => [
      {
        key: "saveImageToDevice",
        label: `Save ${imageIds.length}`,
        onSelect: onSave,
      },
      {
        key: "shareImage",
        label: "Share Image",
        onSelect: vi.fn(),
      },
    ]);

    await render(
      <Excalidraw
        compressImageFile={async (file) => file}
        handleKeyboardGlobally={true}
        initialData={{ appState: { myocSimplifiedMode: false } }}
        imageContextMenuItems={imageContextMenuItems}
      />,
    );

    const image = API.createElement({
      type: "image",
      id: "image_1",
      fileId: "file_1",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    API.setElements([image]);
    API.setSelectedElements([image]);

    fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
      button: 2,
      clientX: 50,
      clientY: 50,
    });

    expect(imageContextMenuItems).toHaveBeenLastCalledWith([image.id]);

    const items = getContextMenuItems();
    expect(items.indexOf("cut")).toBeLessThan(
      items.indexOf("saveImageToDevice"),
    );
    expect(items.indexOf("copy")).toBeLessThan(
      items.indexOf("saveImageToDevice"),
    );
    expect(items.indexOf("paste")).toBeLessThan(
      items.indexOf("saveImageToDevice"),
    );
    expect(items.indexOf("shareImage")).toBeLessThan(
      items.indexOf("wrapSelectionInFrame"),
    );
    expect(
      Array.from(UI.queryContextMenu()?.children ?? [])
        .map((item) =>
          item.tagName === "HR"
            ? "separator"
            : (item as HTMLElement).dataset.testid,
        )
        .slice(0, 7),
    ).toEqual([
      "cut",
      "copy",
      "paste",
      "separator",
      "saveImageToDevice",
      "shareImage",
      "separator",
    ]);

    fireEvent.click(
      queryContextMenuItem(UI.queryContextMenu(), "saveImageToDevice")!,
    );
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("passes all selected image ids to the host callback", async () => {
    unmountComponent();

    const imageContextMenuItems = vi.fn(() => []);

    await render(
      <Excalidraw
        compressImageFile={async (file) => file}
        handleKeyboardGlobally={true}
        initialData={{ appState: { myocSimplifiedMode: false } }}
        imageContextMenuItems={imageContextMenuItems}
      />,
    );

    const imageA = API.createElement({
      type: "image",
      id: "image_A",
      fileId: "file_A",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    const imageB = API.createElement({
      type: "image",
      id: "image_B",
      fileId: "file_B",
      x: 110,
      y: 0,
      width: 100,
      height: 100,
    });

    API.setElements([imageA, imageB]);
    API.setSelectedElements([imageA, imageB]);

    fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
      button: 2,
      clientX: 50,
      clientY: 50,
    });

    expect(imageContextMenuItems).toHaveBeenLastCalledWith([
      imageA.id,
      imageB.id,
    ]);
  });

  it("passes the clicked grouped image id to the host callback", async () => {
    unmountComponent();

    const imageContextMenuItems = vi.fn(() => [
      {
        key: "saveImageToDevice",
        label: "Save Image",
        onSelect: vi.fn(),
      },
    ]);

    await render(
      <Excalidraw
        compressImageFile={async (file) => file}
        handleKeyboardGlobally={true}
        initialData={{ appState: { myocSimplifiedMode: false } }}
        imageContextMenuItems={imageContextMenuItems}
      />,
    );

    const imageA = API.createElement({
      type: "image",
      id: "image_group_A",
      fileId: "file_group_A",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      groupIds: ["g1"],
    });
    const imageB = API.createElement({
      type: "image",
      id: "image_group_B",
      fileId: "file_group_B",
      x: 110,
      y: 0,
      width: 100,
      height: 100,
      groupIds: ["g1"],
    });
    const rectangle = API.createElement({
      type: "rectangle",
      x: 220,
      y: 0,
      width: 100,
      height: 100,
      groupIds: ["g1"],
    });
    API.setElements([imageA, imageB, rectangle]);

    fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
      button: 2,
      clientX: 160,
      clientY: 50,
    });

    expect(imageContextMenuItems).toHaveBeenLastCalledWith([imageB.id]);
    expect(
      queryContextMenuItem(UI.queryContextMenu(), "saveImageToDevice"),
    ).not.toBeNull();
  });

  it("does not call the host image context menu callback for non-image selections", async () => {
    unmountComponent();

    const imageContextMenuItems = vi.fn(() => [
      {
        key: "saveImageToDevice",
        label: "Save Image",
        onSelect: vi.fn(),
      },
    ]);

    await render(
      <Excalidraw
        compressImageFile={async (file) => file}
        handleKeyboardGlobally={true}
        initialData={{ appState: { myocSimplifiedMode: false } }}
        imageContextMenuItems={imageContextMenuItems}
      />,
    );

    const rectangle = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    API.setElements([rectangle]);
    API.setSelectedElements([rectangle]);

    fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
      button: 2,
      clientX: 50,
      clientY: 50,
    });

    expect(imageContextMenuItems).not.toHaveBeenCalled();
    expect(
      queryContextMenuItem(UI.queryContextMenu(), "saveImageToDevice"),
    ).toBeNull();
  });

  it("does not insert an extra image section when the host returns no items", async () => {
    unmountComponent();

    await render(
      <Excalidraw
        compressImageFile={async (file) => file}
        handleKeyboardGlobally={true}
        initialData={{ appState: { myocSimplifiedMode: false } }}
        imageContextMenuItems={() => []}
      />,
    );

    const image = API.createElement({
      type: "image",
      id: "image_2",
      fileId: "file_2",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    API.setElements([image]);
    API.setSelectedElements([image]);

    fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
      button: 2,
      clientX: 50,
      clientY: 50,
    });

    expect(getContextMenuItems().slice(0, 4)).toEqual([
      "cut",
      "copy",
      "paste",
      "wrapSelectionInFrame",
    ]);
  });

  it("renders host image context menu items in view mode", async () => {
    unmountComponent();

    await render(
      <Excalidraw
        compressImageFile={async (file) => file}
        handleKeyboardGlobally={true}
        initialData={{ appState: { myocSimplifiedMode: false } }}
        viewModeEnabled={true}
        imageContextMenuItems={() => [
          {
            key: "saveImageToDevice",
            label: "Save Image",
            onSelect: vi.fn(),
          },
        ]}
      />,
    );

    const image = API.createElement({
      type: "image",
      id: "image_view",
      fileId: "file_view",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    API.setElements([image]);
    API.setSelectedElements([image]);

    fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
      button: 2,
      clientX: 50,
      clientY: 50,
    });

    expect(getContextMenuItems()).toEqual(["copy", "saveImageToDevice"]);
  });
});
