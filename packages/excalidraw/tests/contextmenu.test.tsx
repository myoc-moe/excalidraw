import React from "react";

import { KEYS, reseed } from "@excalidraw/common";
import { setDateTimeForTests } from "@excalidraw/common";

import { copiedStyles } from "../actions/actionStyles";
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
  item: ActionName | ShortcutName,
) =>
  contextMenu?.querySelector(`li[data-testid="${item}"]`) as HTMLElement | null;

const clickContextMenuItem = (
  contextMenu: HTMLElement | null,
  item: ActionName | ShortcutName,
) => {
  const contextMenuItem = queryContextMenuItem(contextMenu, item);
  expect(contextMenuItem).not.toBeNull();
  fireEvent.click(contextMenuItem!);
};

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
      expect.arrayContaining<ShortcutName>([
        "paste",
        "selectAll",
        "gridMode",
        "objectsSnapMode",
        "zenMode",
        "viewMode",
        "stats",
      ]),
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
      "copyStyles",
      "pasteStyles",
      "addToLibrary",
      "sendBackward",
      "bringForward",
      "sendToBack",
      "bringToFront",
      "flipHorizontal",
      "flipVertical",
      "hyperlink",
      "copyElementLink",
      "smartZoom",
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
      "normaliseElements",
      "copyStyles",
      "pasteStyles",
      "group",
      "addToLibrary",
      "sendBackward",
      "bringForward",
      "sendToBack",
      "bringToFront",
      "flipHorizontal",
      "flipVertical",
      "smartZoom",
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
      "normaliseElements",
      "copyStyles",
      "pasteStyles",
      "ungroup",
      "addToLibrary",
      "sendBackward",
      "bringForward",
      "sendToBack",
      "bringToFront",
      "flipHorizontal",
      "flipVertical",
      "copyElementLink",
      "smartZoom",
      "duplicateSelection",
      "toggleElementLock",
      "deleteSelectedElements",
    ]);
  });

  it("selecting copy styles stores the selected element style source", () => {
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
    clickContextMenuItem(contextMenu, "copyStyles");

    const [copiedElement] = JSON.parse(copiedStyles);
    expect(copiedElement.id).toBe(rectangle.id);
    expect(copiedElement.type).toBe("rectangle");
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
});
