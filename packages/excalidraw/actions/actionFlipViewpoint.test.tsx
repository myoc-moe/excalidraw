import React from "react";

import { sceneCoordsToViewportCoords } from "@excalidraw/common";

import { Excalidraw } from "../index";
import { matchesBinding } from "../keymap";
import { API } from "../tests/helpers/api";
import { Pointer, UI } from "../tests/helpers/ui";
import { act, render } from "../tests/test-utils";

import {
  actionFlipViewpointHorizontal,
  actionFlipViewpointVertical,
} from "./actionFlipViewpoint";

const { h } = window;

const keyEvent = (overrides: Partial<KeyboardEvent>) =>
  ({
    code: "KeyR",
    key: "r",
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    ...overrides,
  } as KeyboardEvent);

describe("MyOC regression: viewpoint flip actions", () => {
  beforeEach(async () => {
    await render(<Excalidraw compressImageFile={async (file) => file} />);
  });

  it("toggles independent app-state axes without changing elements or history", () => {
    const rectangle = API.createElement({ type: "rectangle", x: 20, y: 30 });
    API.setElements([rectangle]);
    const beforeElement = h.elements[0];
    const undoStackSize = API.getUndoStack().length;

    API.executeAction(actionFlipViewpointHorizontal);
    expect(h.state.viewpointFlip).toEqual({
      horizontal: true,
      vertical: false,
    });

    API.executeAction(actionFlipViewpointVertical);
    expect(h.state.viewpointFlip).toEqual({
      horizontal: true,
      vertical: true,
    });
    expect(h.elements[0]).toBe(beforeElement);
    expect(API.getUndoStack()).toHaveLength(undoStackSize);
  });

  it("owns Shift+R and Alt+Shift+R without colliding with view mode", () => {
    expect(
      actionFlipViewpointHorizontal.keyTest?.(keyEvent({ shiftKey: true })),
    ).toBe(true);
    expect(
      actionFlipViewpointVertical.keyTest?.(
        keyEvent({ shiftKey: true, altKey: true }),
      ),
    ).toBe(true);
    expect(
      matchesBinding(
        keyEvent({ shiftKey: true, altKey: true }),
        "action:viewMode",
      ),
    ).toBe(false);
    expect(
      matchesBinding(
        keyEvent({ code: "KeyA", key: "a", shiftKey: true }),
        "action:arrangeElements",
      ),
    ).toBe(true);
    expect(
      matchesBinding(keyEvent({ shiftKey: true }), "action:arrangeElements"),
    ).toBe(false);
  });

  it("can be read and updated through the public app-state API", async () => {
    const changed = h.app.onStateChange("viewpointFlip");
    await act(async () => {
      h.app.updateScene({
        appState: {
          viewpointFlip: { horizontal: false, vertical: true },
        },
      });
    });

    await expect(changed).resolves.toEqual({
      horizontal: false,
      vertical: true,
    });
    expect(h.state.viewpointFlip.vertical).toBe(true);
  });

  it("maps pointer creation back into canonical scene coordinates", () => {
    API.setAppState({
      viewpointFlip: { horizontal: true, vertical: false },
    });
    UI.clickTool("rectangle");
    const start = sceneCoordsToViewportCoords(
      { sceneX: 20, sceneY: 30 },
      h.state,
    );
    const end = sceneCoordsToViewportCoords(
      { sceneX: 80, sceneY: 70 },
      h.state,
    );
    const mouse = new Pointer("mouse");

    mouse.downAt(start.x, start.y);
    mouse.moveTo(end.x, end.y);
    mouse.upAt(end.x, end.y);

    expect(h.elements[0]).toMatchObject({
      type: "rectangle",
      x: 20,
      y: 30,
      width: 60,
      height: 40,
    });
  });
});
