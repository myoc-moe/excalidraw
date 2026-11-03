import React from "react";
import { vi } from "vitest";

import { setDateTimeForTests } from "@excalidraw/common";
import { KEYS, reseed } from "@excalidraw/common";

import type { FileId } from "@excalidraw/element/types";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import {
  act,
  fireEvent,
  GlobalTestState,
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
  unmountComponent,
} from "./test-utils";

import type { ExcalidrawProps } from "../types";
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
        "flipViewpointHorizontal",
        "flipViewpointVertical",
        "viewMode",
        "stats",
      ]),
    );
    expect(getContextMenuItems()).not.toEqual(
      expect.arrayContaining(["copyAsPng", "copyAsSvg"]),
    );
  });

  it("MyOC regression: exposes viewpoint flips on canvas and elements in both modes", () => {
    const rectangle = API.createElement({
      type: "rectangle",
      x: 100,
      y: 100,
      width: 100,
      height: 100,
    });
    API.setElements([rectangle]);

    for (const viewModeEnabled of [false, true]) {
      API.setAppState({ viewModeEnabled });

      fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
        button: 2,
        clientX: 1,
        clientY: 1,
      });
      expect(getContextMenuItems()).toEqual(
        expect.arrayContaining([
          "flipViewpointHorizontal",
          "flipViewpointVertical",
        ]),
      );

      fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
        button: 2,
        clientX: 150,
        clientY: 150,
      });
      expect(getContextMenuItems()).toEqual(
        expect.arrayContaining([
          "flipViewpointHorizontal",
          "flipViewpointVertical",
        ]),
      );
    }
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
      "smartZoom",
      "flipViewpointHorizontal",
      "flipViewpointVertical",
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
      "smartZoom",
      "flipViewpointHorizontal",
      "flipViewpointVertical",
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
      "smartZoom",
      "flipViewpointHorizontal",
      "flipViewpointVertical",
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
        .slice(0, 11),
    ).toEqual([
      "smartZoom",
      "flipViewpointHorizontal",
      "flipViewpointVertical",
      "separator",
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

  it("MyOC regression: renders image layout actions in the image context menu", async () => {
    const imageA = API.createElement({
      type: "image",
      id: "image_layout_A",
      fileId: "file_layout_A",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    const imageB = API.createElement({
      type: "image",
      id: "image_layout_B",
      fileId: "file_layout_B",
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

    const items = getContextMenuItems();
    expect(items).toEqual(
      expect.arrayContaining(["arrangeElements", "normaliseElements"]),
    );
    expect(items.indexOf("paste")).toBeLessThan(
      items.indexOf("arrangeElements"),
    );
    expect(items.indexOf("arrangeElements")).toBeLessThan(
      items.indexOf("normaliseElements"),
    );
    expect(items.indexOf("normaliseElements")).toBeLessThan(
      items.indexOf("wrapSelectionInFrame"),
    );
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

    expect(getContextMenuItems().slice(0, 7)).toEqual([
      "smartZoom",
      "flipViewpointHorizontal",
      "flipViewpointVertical",
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

    expect(getContextMenuItems()).toEqual([
      "smartZoom",
      "flipViewpointHorizontal",
      "flipViewpointVertical",
      "copy",
      "saveImageToDevice",
    ]);
  });
});

describe("contextMenu spoiler item", () => {
  const { h } = window;
  const FA = "spoiler-file-a" as FileId;
  const FB = "spoiler-file-b" as FileId;
  const FC = "spoiler-file-c" as FileId;

  const SHOW = "Show spoiler";
  const HIDE = "Hide spoiler";

  beforeAll(() => {
    mockBoundingClientRect();
  });

  afterAll(() => {
    restoreOriginalGetBoundingClientRect();
  });

  beforeEach(() => {
    localStorage.clear();
    reseed(7);
    setDateTimeForTests("201933152653");
  });

  const setup = async (props: Partial<ExcalidrawProps> = {}) => {
    unmountComponent();
    const onSpoileredFilesChange = vi.fn();
    await render(
      <Excalidraw
        compressImageFile={async (file) => file}
        handleKeyboardGlobally={true}
        initialData={{ appState: { myocSimplifiedMode: false } }}
        onSpoileredFilesChange={onSpoileredFilesChange}
        {...props}
      />,
    );
    return { onSpoileredFilesChange };
  };

  const image = (id: string, fileId: FileId, x = 0) =>
    API.createElement({
      type: "image",
      id,
      fileId,
      x,
      y: 0,
      width: 100,
      height: 100,
    });

  const mark = (fileId: FileId, visibility: "shown" | "hidden") => {
    act(() => {
      h.app.api.markFileSpoilered(fileId, true);
      h.app.api.setSpoileredFileVisibility(fileId, visibility);
    });
  };

  const openMenu = (clientX = 50, clientY = 50) => {
    fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
      button: 2,
      clientX,
      clientY,
    });
  };

  const getSpoilerItem = () =>
    queryContextMenuItem(UI.queryContextMenu(), "toggleSpoiler");

  const expectLabel = (label: string | null) => {
    const item = getSpoilerItem();
    if (label === null) {
      expect(item).toBeNull();
    } else {
      expect(item).not.toBeNull();
      expect(item!.textContent).toBe(label);
    }
  };

  describe("single image", () => {
    it("shows 'Show spoiler' for a hidden image", async () => {
      await setup();
      const img = image("img", FA);
      API.setElements([img]);
      API.setSelectedElements([img]);
      mark(FA, "hidden");
      openMenu();
      expectLabel(SHOW);
    });

    it("shows 'Hide spoiler' for a shown image", async () => {
      await setup();
      const img = image("img", FA);
      API.setElements([img]);
      API.setSelectedElements([img]);
      mark(FA, "shown");
      openMenu();
      expectLabel(HIDE);
    });

    it("shows no item for an unmarked image", async () => {
      await setup();
      const img = image("img", FA);
      API.setElements([img]);
      API.setSelectedElements([img]);
      openMenu();
      expectLabel(null);
    });

    it("shows no item when another file is marked but this one is not", async () => {
      await setup();
      const img = image("img", FA);
      API.setElements([img]);
      API.setSelectedElements([img]);
      mark(FB, "hidden");
      openMenu();
      expectLabel(null);
    });

    it("shows no item after the mark is removed", async () => {
      await setup();
      const img = image("img", FA);
      API.setElements([img]);
      API.setSelectedElements([img]);
      mark(FA, "hidden");
      act(() => h.app.api.markFileSpoilered(FA, false));
      openMenu();
      expectLabel(null);
    });

    it("shows no item for a non-image selection while a file is marked", async () => {
      await setup();
      const rect = API.createElement({
        type: "rectangle",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      });
      API.setElements([rect]);
      API.setSelectedElements([rect]);
      mark(FA, "hidden");
      openMenu();
      expectLabel(null);
    });

    it("shows no item in the canvas menu", async () => {
      await setup();
      const img = image("img", FA);
      API.setElements([img]);
      mark(FA, "hidden");
      openMenu(500, 500);
      expect(UI.queryContextMenu()).not.toBeNull();
      expectLabel(null);
    });

    it("'Show spoiler' shows the file, and the menu closes", async () => {
      const { onSpoileredFilesChange } = await setup();
      const img = image("img", FA);
      API.setElements([img]);
      API.setSelectedElements([img]);
      mark(FA, "hidden");
      onSpoileredFilesChange.mockClear();
      openMenu();
      fireEvent.click(getSpoilerItem()!);
      expect(h.app.api.getSpoileredFiles().get(FA)).toBe("shown");
      expect(onSpoileredFilesChange).toHaveBeenCalledTimes(1);
      expect(UI.queryContextMenu()).toBeNull();
    });

    it("'Hide spoiler' hides the file", async () => {
      const { onSpoileredFilesChange } = await setup();
      const img = image("img", FA);
      API.setElements([img]);
      API.setSelectedElements([img]);
      mark(FA, "shown");
      onSpoileredFilesChange.mockClear();
      openMenu();
      fireEvent.click(getSpoilerItem()!);
      expect(h.app.api.getSpoileredFiles().get(FA)).toBe("hidden");
      expect(onSpoileredFilesChange).toHaveBeenCalledTimes(1);
    });

    it("the item flips its label after use", async () => {
      await setup();
      const img = image("img", FA);
      API.setElements([img]);
      API.setSelectedElements([img]);
      mark(FA, "hidden");
      openMenu();
      fireEvent.click(getSpoilerItem()!);
      openMenu();
      expectLabel(HIDE);
    });

    it("does not change the scene elements or the selection", async () => {
      await setup();
      const img = image("img", FA);
      API.setElements([img]);
      API.setSelectedElements([img]);
      mark(FA, "hidden");
      const versionBefore = h.elements[0].version;
      openMenu();
      fireEvent.click(getSpoilerItem()!);
      expect(h.elements[0].version).toBe(versionBefore);
      expect(h.state.selectedElementIds).toEqual({ img: true });
    });
  });

  describe("mixed selections", () => {
    const selectTwo = (
      a: "shown" | "hidden" | null,
      b: "shown" | "hidden" | null,
    ) => {
      const imgA = image("img-a", FA, 0);
      const imgB = image("img-b", FB, 200);
      API.setElements([imgA, imgB]);
      API.setSelectedElements([imgA, imgB]);
      if (a) {
        mark(FA, a);
      }
      if (b) {
        mark(FB, b);
      }
    };

    it("hidden and shown: 'Hide spoiler', and both end hidden", async () => {
      const { onSpoileredFilesChange } = await setup();
      selectTwo("hidden", "shown");
      onSpoileredFilesChange.mockClear();
      openMenu(50, 50);
      expectLabel(HIDE);
      fireEvent.click(getSpoilerItem()!);
      const files = h.app.api.getSpoileredFiles();
      expect(files.get(FA)).toBe("hidden");
      expect(files.get(FB)).toBe("hidden");
      expect(onSpoileredFilesChange).toHaveBeenCalledTimes(1);
    });

    it("hidden and hidden: 'Show spoiler', and both end shown with one callback", async () => {
      const { onSpoileredFilesChange } = await setup();
      selectTwo("hidden", "hidden");
      onSpoileredFilesChange.mockClear();
      openMenu(50, 50);
      expectLabel(SHOW);
      fireEvent.click(getSpoilerItem()!);
      const files = h.app.api.getSpoileredFiles();
      expect(files.get(FA)).toBe("shown");
      expect(files.get(FB)).toBe("shown");
      expect(onSpoileredFilesChange).toHaveBeenCalledTimes(1);
      expect(onSpoileredFilesChange.mock.lastCall![0].get(FB)).toBe("shown");
    });

    it("shown and shown: 'Hide spoiler', and both end hidden with one callback", async () => {
      const { onSpoileredFilesChange } = await setup();
      selectTwo("shown", "shown");
      onSpoileredFilesChange.mockClear();
      openMenu(50, 50);
      expectLabel(HIDE);
      fireEvent.click(getSpoilerItem()!);
      expect(h.app.api.getSpoileredFiles().get(FA)).toBe("hidden");
      expect(h.app.api.getSpoileredFiles().get(FB)).toBe("hidden");
      expect(onSpoileredFilesChange).toHaveBeenCalledTimes(1);
    });

    it("hidden and unmarked: 'Show spoiler', and the unmarked file stays unmarked", async () => {
      const { onSpoileredFilesChange } = await setup();
      selectTwo("hidden", null);
      onSpoileredFilesChange.mockClear();
      openMenu(50, 50);
      expectLabel(SHOW);
      fireEvent.click(getSpoilerItem()!);
      const files = h.app.api.getSpoileredFiles();
      expect(files.get(FA)).toBe("shown");
      expect(files.has(FB)).toBe(false);
      expect(onSpoileredFilesChange).toHaveBeenCalledTimes(1);
    });

    it("shown and unmarked: 'Hide spoiler', and the unmarked file stays unmarked", async () => {
      const { onSpoileredFilesChange } = await setup();
      selectTwo("shown", null);
      onSpoileredFilesChange.mockClear();
      openMenu(50, 50);
      expectLabel(HIDE);
      fireEvent.click(getSpoilerItem()!);
      const files = h.app.api.getSpoileredFiles();
      expect(files.get(FA)).toBe("hidden");
      expect(files.has(FB)).toBe(false);
      expect(onSpoileredFilesChange).toHaveBeenCalledTimes(1);
    });

    it("unmarked and unmarked: no item", async () => {
      await setup();
      selectTwo(null, null);
      mark(FC, "hidden");
      openMenu(50, 50);
      expectLabel(null);
    });

    it("hiding all shown files from the menu resets the default for new marks", async () => {
      await setup();
      // the default is private: read it with an element access
      /* eslint-disable dot-notation */
      selectTwo("hidden", "hidden");
      act(() => h.app.api.setAllSpoileredFilesVisibility("shown"));
      expect(h.app.spoilers["defaultVisibility"]).toBe("shown");
      openMenu(50, 50);
      expectLabel(HIDE);
      fireEvent.click(getSpoilerItem()!);
      expect(h.app.api.getSpoileredFiles().get(FA)).toBe("hidden");
      expect(h.app.api.getSpoileredFiles().get(FB)).toBe("hidden");
      // no shown file is left, so the reset rule applies through the batch
      expect(h.app.spoilers["defaultVisibility"]).toBe("hidden");
      /* eslint-enable dot-notation */
      act(() => h.app.api.markFileSpoilered(FC, true));
      expect(h.app.api.getSpoileredFiles().get(FC)).toBe("hidden");
    });

    it("a marked file that is not selected is not changed", async () => {
      await setup();
      const imgA = image("img-a", FA, 0);
      const imgB = image("img-b", FB, 200);
      API.setElements([imgA, imgB]);
      API.setSelectedElements([imgA]);
      mark(FA, "hidden");
      mark(FB, "hidden");
      openMenu(50, 50);
      fireEvent.click(getSpoilerItem()!);
      expect(h.app.api.getSpoileredFiles().get(FA)).toBe("shown");
      expect(h.app.api.getSpoileredFiles().get(FB)).toBe("hidden");
    });

    it("image and non-image: the item follows the selected marked image", async () => {
      const { onSpoileredFilesChange } = await setup();
      const img = image("img", FA, 0);
      const rect = API.createElement({
        type: "rectangle",
        id: "rect",
        x: 200,
        y: 0,
        width: 100,
        height: 100,
      });
      API.setElements([img, rect]);
      API.setSelectedElements([img, rect]);
      mark(FA, "hidden");
      onSpoileredFilesChange.mockClear();
      openMenu(50, 50);
      expectLabel(SHOW);
      fireEvent.click(getSpoilerItem()!);
      expect(h.app.api.getSpoileredFiles().get(FA)).toBe("shown");
      expect(onSpoileredFilesChange).toHaveBeenCalledTimes(1);
    });

    it("image and non-image: no item when the image is unmarked", async () => {
      await setup();
      const img = image("img", FA, 0);
      const rect = API.createElement({
        type: "rectangle",
        id: "rect",
        x: 200,
        y: 0,
        width: 100,
        height: 100,
      });
      API.setElements([img, rect]);
      API.setSelectedElements([img, rect]);
      mark(FB, "hidden");
      openMenu(50, 50);
      expectLabel(null);
    });
  });

  describe("two elements with one file id", () => {
    it("shows one item, and one action changes the one file once", async () => {
      const { onSpoileredFilesChange } = await setup();
      const imgA = image("img-a", FA, 0);
      const imgB = image("img-b", FA, 200);
      API.setElements([imgA, imgB]);
      API.setSelectedElements([imgA, imgB]);
      mark(FA, "hidden");
      onSpoileredFilesChange.mockClear();
      openMenu(50, 50);
      expect(
        UI.queryContextMenu()!.querySelectorAll(
          'li[data-testid="toggleSpoiler"]',
        ),
      ).toHaveLength(1);
      expectLabel(SHOW);
      fireEvent.click(getSpoilerItem()!);
      expect(h.app.api.getSpoileredFiles().get(FA)).toBe("shown");
      expect(onSpoileredFilesChange).toHaveBeenCalledTimes(1);
    });

    it("one selected element changes the file for the other element too", async () => {
      await setup();
      const imgA = image("img-a", FA, 0);
      const imgB = image("img-b", FA, 200);
      API.setElements([imgA, imgB]);
      API.setSelectedElements([imgA]);
      mark(FA, "shown");
      openMenu(50, 50);
      expectLabel(HIDE);
      fireEvent.click(getSpoilerItem()!);
      expect(h.app.api.getSpoileredFiles().get(FA)).toBe("hidden");
      // the other element draws the same file, so the file state is shared
      expect(h.app.api.getSpoileredFiles().size).toBe(1);
    });
  });

  describe("edit mode and view mode", () => {
    it("edit mode shows the item", async () => {
      await setup();
      const img = image("img", FA);
      API.setElements([img]);
      API.setSelectedElements([img]);
      mark(FA, "hidden");
      openMenu();
      expectLabel(SHOW);
    });

    it("view mode shows the item", async () => {
      await setup({ viewModeEnabled: true });
      const img = image("img", FA);
      API.setElements([img]);
      API.setSelectedElements([img]);
      mark(FA, "hidden");
      openMenu();
      expectLabel(SHOW);
      expect(getContextMenuItems()).toEqual([
        "smartZoom",
        "flipViewpointHorizontal",
        "flipViewpointVertical",
        "copy",
        "toggleSpoiler",
      ]);
    });

    it("view mode shows no item for an unmarked image", async () => {
      await setup({ viewModeEnabled: true });
      const img = image("img", FA);
      API.setElements([img]);
      API.setSelectedElements([img]);
      openMenu();
      expectLabel(null);
    });

    it("view mode: the item shows the file", async () => {
      const { onSpoileredFilesChange } = await setup({
        viewModeEnabled: true,
      });
      const img = image("img", FA);
      API.setElements([img]);
      API.setSelectedElements([img]);
      mark(FA, "hidden");
      onSpoileredFilesChange.mockClear();
      openMenu();
      fireEvent.click(getSpoilerItem()!);
      expect(h.app.api.getSpoileredFiles().get(FA)).toBe("shown");
      expect(onSpoileredFilesChange).toHaveBeenCalledTimes(1);
    });

    it("view mode: the item hides a shown file", async () => {
      await setup({ viewModeEnabled: true });
      const img = image("img", FA);
      API.setElements([img]);
      API.setSelectedElements([img]);
      mark(FA, "shown");
      openMenu();
      expectLabel(HIDE);
      fireEvent.click(getSpoilerItem()!);
      expect(h.app.api.getSpoileredFiles().get(FA)).toBe("hidden");
    });
  });

  describe("position and host items", () => {
    const hostItems = () => [
      {
        key: "saveImageToDevice",
        label: "Save Image",
        onSelect: vi.fn(),
      },
      {
        key: "shareImage",
        label: "Share Image",
        onSelect: vi.fn(),
      },
    ];

    const layout = () =>
      Array.from(UI.queryContextMenu()?.children ?? []).map((item) =>
        item.tagName === "HR"
          ? "separator"
          : (item as HTMLElement).dataset.testid,
      );

    it("edit mode: the item is after paste and before the host items", async () => {
      const items = hostItems();
      const imageContextMenuItems = vi.fn(() => items);
      await setup({ imageContextMenuItems });
      const img = image("img", FA);
      API.setElements([img]);
      API.setSelectedElements([img]);
      mark(FA, "hidden");
      openMenu();

      const ids = getContextMenuItems();
      expect(ids.indexOf("paste")).toBeLessThan(ids.indexOf("toggleSpoiler"));
      expect(ids.indexOf("toggleSpoiler")).toBeLessThan(
        ids.indexOf("saveImageToDevice"),
      );
      expect(ids.indexOf("saveImageToDevice")).toBeLessThan(
        ids.indexOf("shareImage"),
      );
      expect(ids.indexOf("shareImage")).toBeLessThan(
        ids.indexOf("wrapSelectionInFrame"),
      );
      expect(layout().slice(0, 12)).toEqual([
        "smartZoom",
        "flipViewpointHorizontal",
        "flipViewpointVertical",
        "separator",
        "cut",
        "copy",
        "paste",
        "separator",
        "toggleSpoiler",
        "saveImageToDevice",
        "shareImage",
        "separator",
      ]);
    });

    it("view mode: the item is after copy and before the host items", async () => {
      await setup({
        viewModeEnabled: true,
        imageContextMenuItems: () => hostItems(),
      });
      const img = image("img", FA);
      API.setElements([img]);
      API.setSelectedElements([img]);
      mark(FA, "hidden");
      openMenu();
      expect(getContextMenuItems()).toEqual([
        "smartZoom",
        "flipViewpointHorizontal",
        "flipViewpointVertical",
        "copy",
        "toggleSpoiler",
        "saveImageToDevice",
        "shareImage",
      ]);
    });

    it("the host callback still gets the selected image ids", async () => {
      const imageContextMenuItems = vi.fn(() => hostItems());
      await setup({ imageContextMenuItems });
      const imgA = image("img-a", FA, 0);
      const imgB = image("img-b", FB, 200);
      API.setElements([imgA, imgB]);
      API.setSelectedElements([imgA, imgB]);
      mark(FA, "hidden");
      openMenu(50, 50);
      expect(imageContextMenuItems).toHaveBeenLastCalledWith([
        "img-a",
        "img-b",
      ]);
    });

    it("host items still show and run when the image is unmarked", async () => {
      const items = hostItems();
      await setup({ imageContextMenuItems: () => items });
      const img = image("img", FA);
      API.setElements([img]);
      API.setSelectedElements([img]);
      openMenu();
      expectLabel(null);
      expect(getContextMenuItems()).toContain("saveImageToDevice");
      fireEvent.click(
        queryContextMenuItem(UI.queryContextMenu(), "saveImageToDevice")!,
      );
      expect(items[0].onSelect).toHaveBeenCalledTimes(1);
    });

    it("the host items run after the spoiler item is present", async () => {
      const items = hostItems();
      await setup({ imageContextMenuItems: () => items });
      const img = image("img", FA);
      API.setElements([img]);
      API.setSelectedElements([img]);
      mark(FA, "hidden");
      openMenu();
      fireEvent.click(
        queryContextMenuItem(UI.queryContextMenu(), "shareImage")!,
      );
      expect(items[1].onSelect).toHaveBeenCalledTimes(1);
      // the host item does not change the spoiler state
      expect(h.app.api.getSpoileredFiles().get(FA)).toBe("hidden");
    });

    it("the item shows when the host returns no items", async () => {
      await setup({ imageContextMenuItems: () => [] });
      const img = image("img", FA);
      API.setElements([img]);
      API.setSelectedElements([img]);
      mark(FA, "hidden");
      openMenu();
      expectLabel(SHOW);
    });

    it("the item shows with no host callback", async () => {
      await setup();
      const img = image("img", FA);
      API.setElements([img]);
      API.setSelectedElements([img]);
      mark(FA, "hidden");
      openMenu();
      expectLabel(SHOW);
      expect(getContextMenuItems()).not.toContain("saveImageToDevice");
    });

    it("the host callback is not called for a non-image selection", async () => {
      const imageContextMenuItems = vi.fn(() => hostItems());
      await setup({ imageContextMenuItems });
      const rect = API.createElement({
        type: "rectangle",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      });
      API.setElements([rect]);
      API.setSelectedElements([rect]);
      mark(FA, "hidden");
      openMenu();
      expect(imageContextMenuItems).not.toHaveBeenCalled();
      expectLabel(null);
    });
  });

  describe("right-click on an unselected image", () => {
    it("selects the image and shows the item for it", async () => {
      await setup();
      const imgA = image("img-a", FA, 0);
      const imgB = image("img-b", FB, 200);
      API.setElements([imgA, imgB]);
      API.setSelectedElements([]);
      mark(FA, "hidden");
      mark(FB, "shown");
      openMenu(50, 50);
      expect(h.state.selectedElementIds).toEqual({ "img-a": true });
      expectLabel(SHOW);
      fireEvent.click(getSpoilerItem()!);
      expect(h.app.api.getSpoileredFiles().get(FA)).toBe("shown");
      expect(h.app.api.getSpoileredFiles().get(FB)).toBe("shown");
    });

    it("uses the clicked image, not the earlier selection", async () => {
      await setup();
      const imgA = image("img-a", FA, 0);
      const imgB = image("img-b", FB, 200);
      API.setElements([imgA, imgB]);
      API.setSelectedElements([imgA]);
      mark(FA, "hidden");
      mark(FB, "shown");
      openMenu(250, 50);
      expect(h.state.selectedElementIds).toEqual({ "img-b": true });
      expectLabel(HIDE);
      fireEvent.click(getSpoilerItem()!);
      expect(h.app.api.getSpoileredFiles().get(FA)).toBe("hidden");
      expect(h.app.api.getSpoileredFiles().get(FB)).toBe("hidden");
    });

    it("shows no item when the clicked image is unmarked", async () => {
      await setup();
      const imgA = image("img-a", FA, 0);
      const imgB = image("img-b", FB, 200);
      API.setElements([imgA, imgB]);
      API.setSelectedElements([imgA]);
      mark(FA, "hidden");
      openMenu(250, 50);
      expect(h.state.selectedElementIds).toEqual({ "img-b": true });
      expectLabel(null);
    });

    it("view mode: selects the image and shows the item", async () => {
      await setup({ viewModeEnabled: true });
      const imgA = image("img-a", FA, 0);
      API.setElements([imgA]);
      API.setSelectedElements([]);
      mark(FA, "hidden");
      openMenu(50, 50);
      expectLabel(SHOW);
    });
  });
});
