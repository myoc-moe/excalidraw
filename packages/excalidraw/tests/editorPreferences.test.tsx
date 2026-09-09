import React from "react";

import { CaptureUpdateAction } from "@excalidraw/element";
import * as arrangeModule from "@excalidraw/element/arrange";
import * as normaliseModule from "@excalidraw/element/normalise";
import { vi } from "vitest";

import { actionArrangeElements } from "../actions/actionArrange";
import { actionNormaliseElements } from "../actions/actionNormalise";
import { actionSmartZoom } from "../actions/actionSmartZoom";
import { getDefaultAppState } from "../appState";
import {
  DEFAULT_SMART_ZOOM_PREFERENCES,
  getEffectiveEditorPreferences,
} from "../editorPreferences";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { act, fireEvent, render, waitFor } from "./test-utils";

import type { EditorPreferences } from "../types";

const { h } = window;

describe("editorPreferences", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("MyOC regression: defaults alignment stacking off", () => {
    expect(getEffectiveEditorPreferences(getDefaultAppState()).align).toEqual({
      stacking: false,
    });
  });

  it("preserves smart zoom defaults when no editorPreferences prop is provided", async () => {
    await render(<Excalidraw compressImageFile={async (file) => file} />);
    const setViewportSpy = vi.spyOn(h.app.viewport, "setViewport");
    const rectangle = API.createElement({ type: "rectangle" });

    API.updateScene({
      elements: [rectangle],
      captureUpdate: CaptureUpdateAction.NEVER,
    });

    API.executeAction(actionSmartZoom);

    expect(setViewportSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        animation: { duration: DEFAULT_SMART_ZOOM_PREFERENCES.duration },
        fit: "contain",
        offsets: undefined,
        viewportZoomFactor: DEFAULT_SMART_ZOOM_PREFERENCES.viewportZoomFactor,
      }),
    );
  });

  it("merges partial preferences with smart zoom defaults and appState fallbacks", () => {
    const defaultAppState = getDefaultAppState();
    const appState = {
      ...defaultAppState,
      arrangeConfiguration: {
        algorithm: "bin-packing-binary-tree" as const,
        gap: 12,
      },
      normaliseConfiguration: {
        mode: "first" as const,
        metric: "width" as const,
      },
      alignConfiguration: {
        stacking: true,
      },
    };

    expect(
      getEffectiveEditorPreferences(appState, {
        smartZoom: {
          animate: false,
        },
        arrange: {
          gap: 48,
        },
      }),
    ).toEqual({
      smartZoom: {
        ...DEFAULT_SMART_ZOOM_PREFERENCES,
        animate: false,
      },
      align: {
        stacking: true,
      },
      arrange: {
        algorithm: "bin-packing-binary-tree",
        gap: 48,
      },
      normalise: {
        mode: "first",
        metric: "width",
      },
    });
  });

  it("MyOC regression: toggles the shared stacking preference from the align panel", async () => {
    const onEditorPreferencesChange = vi.fn();
    await render(
      <Excalidraw
        compressImageFile={async (file) => file}
        onEditorPreferencesChange={onEditorPreferencesChange}
      />,
    );
    const rectangleA = API.createElement({
      type: "rectangle",
      id: "align-a",
      x: 0,
      y: 0,
    });
    const rectangleB = API.createElement({
      type: "rectangle",
      id: "align-b",
      x: 200,
      y: 0,
    });
    API.updateScene({
      elements: [rectangleA, rectangleB],
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    API.setSelectedElements([rectangleA, rectangleB]);

    const stackingSwitch = document.querySelector(
      'input[name="alignStacking"]',
    ) as HTMLInputElement;
    expect(stackingSwitch.checked).toBe(false);

    fireEvent.click(stackingSwitch);

    expect(onEditorPreferencesChange).toHaveBeenLastCalledWith({
      align: { stacking: true },
    });
    expect(h.state.alignConfiguration.stacking).toBe(true);
    expect(stackingSwitch.checked).toBe(true);
  });

  it("uses the latest smart zoom preferences after rerender", async () => {
    const initialPreferences: EditorPreferences = {
      smartZoom: {
        animate: false,
        duration: 90,
        fitToViewport: false,
        respectUIElements: false,
        viewportZoomFactor: 0.6,
      },
    };
    const nextPreferences: EditorPreferences = {
      smartZoom: {
        animate: true,
        duration: 320,
        fitToViewport: true,
        respectUIElements: true,
        viewportZoomFactor: 0.5,
      },
    };

    const rendered = await render(
      <Excalidraw
        compressImageFile={async (file) => file}
        editorPreferences={initialPreferences}
      />,
    );
    const setViewportSpy = vi.spyOn(h.app.viewport, "setViewport");
    const rectangle = API.createElement({ type: "rectangle" });

    API.updateScene({
      elements: [rectangle],
      captureUpdate: CaptureUpdateAction.NEVER,
    });

    API.executeAction(actionSmartZoom);

    expect(setViewportSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        animation: false,
        fit: "none",
        offsets: undefined,
        viewportZoomFactor: initialPreferences.smartZoom!.viewportZoomFactor,
      }),
    );

    act(() => {
      rendered.rerender(
        <Excalidraw
          compressImageFile={async (file) => file}
          editorPreferences={nextPreferences}
        />,
      );
    });

    await waitFor(() => {
      expect(h.app.props.editorPreferences).toEqual(nextPreferences);
    });

    API.executeAction(actionSmartZoom);

    expect(setViewportSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        animation: { duration: nextPreferences.smartZoom!.duration },
        fit: "contain",
        offsets: { ui: true },
        viewportZoomFactor: nextPreferences.smartZoom!.viewportZoomFactor,
      }),
    );
  });

  it("MyOC regression: applies smart zoom viewportZoomFactor through setViewport", async () => {
    await render(
      <Excalidraw
        compressImageFile={async (file) => file}
        editorPreferences={{
          smartZoom: {
            animate: false,
            fitToViewport: true,
            respectUIElements: true,
            viewportZoomFactor: 0.5,
          },
        }}
      />,
    );

    h.state.width = 1000;
    h.state.height = 1000;

    const rectangle = API.createElement({
      type: "rectangle",
      width: 100,
      height: 100,
      x: 0,
      y: 0,
    });

    API.updateScene({
      elements: [rectangle],
      captureUpdate: CaptureUpdateAction.NEVER,
    });

    API.executeAction(actionSmartZoom);

    expect(h.state.zoom.value).toBeCloseTo(4.76);
  });

  it("passes overridden arrange preferences into arrangeElements", async () => {
    const arrangeSpy = vi.spyOn(arrangeModule, "arrangeElements");

    await render(
      <Excalidraw
        compressImageFile={async (file) => file}
        editorPreferences={{
          arrange: {
            algorithm: "bin-packing-binary-tree",
            gap: 48,
          },
        }}
      />,
    );

    const rectangleA = API.createElement({
      type: "rectangle",
      id: "arrange-a",
      x: 0,
      y: 0,
    });
    const rectangleB = API.createElement({
      type: "rectangle",
      id: "arrange-b",
      x: 300,
      y: 100,
    });

    API.updateScene({
      elements: [rectangleA, rectangleB],
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    API.setSelectedElements([rectangleA, rectangleB]);

    API.executeAction(actionArrangeElements);

    expect(arrangeSpy).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.any(Array),
      expect.anything(),
      "bin-packing-binary-tree",
      48,
    );
  });

  it("passes overridden normalise preferences into normaliseElements", async () => {
    const normaliseSpy = vi.spyOn(normaliseModule, "normaliseElements");

    await render(
      <Excalidraw
        compressImageFile={async (file) => file}
        editorPreferences={{
          normalise: {
            mode: "first",
            metric: "width",
          },
        }}
      />,
    );

    const rectangleA = API.createElement({
      type: "rectangle",
      id: "normalise-a",
      x: 0,
      y: 0,
      width: 100,
      height: 200,
    });
    const rectangleB = API.createElement({
      type: "rectangle",
      id: "normalise-b",
      x: 250,
      y: 50,
      width: 200,
      height: 100,
    });

    API.updateScene({
      elements: [rectangleA, rectangleB],
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    API.setSelectedElements([rectangleA, rectangleB]);

    API.executeAction(actionNormaliseElements);

    expect(normaliseSpy).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.any(Array),
      expect.anything(),
      "first",
      "width",
    );
  });
});
