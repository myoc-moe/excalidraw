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
import { act, render, waitFor } from "./test-utils";

import type { EditorPreferences } from "../types";

const { h } = window;

describe("editorPreferences", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("preserves smart zoom defaults when no editorPreferences prop is provided", async () => {
    await render(<Excalidraw />);
    const scrollSpy = vi.spyOn(h.app, "scrollToContent");
    const rectangle = API.createElement({ type: "rectangle" });

    API.updateScene({
      elements: [rectangle],
      captureUpdate: CaptureUpdateAction.NEVER,
    });

    API.executeAction(actionSmartZoom);

    expect(scrollSpy).toHaveBeenLastCalledWith(
      expect.any(Array),
      expect.objectContaining(DEFAULT_SMART_ZOOM_PREFERENCES),
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

  it("uses the latest smart zoom preferences after rerender", async () => {
    const initialPreferences: EditorPreferences = {
      smartZoom: {
        animate: false,
        duration: 90,
        fitToViewport: false,
        viewportZoomFactor: 0.6,
      },
    };
    const nextPreferences: EditorPreferences = {
      smartZoom: {
        animate: true,
        duration: 320,
        fitToViewport: true,
        viewportZoomFactor: 0.5,
      },
    };

    const rendered = await render(
      <Excalidraw editorPreferences={initialPreferences} />,
    );
    const scrollSpy = vi.spyOn(h.app, "scrollToContent");
    const rectangle = API.createElement({ type: "rectangle" });

    API.updateScene({
      elements: [rectangle],
      captureUpdate: CaptureUpdateAction.NEVER,
    });

    API.executeAction(actionSmartZoom);

    expect(scrollSpy).toHaveBeenLastCalledWith(
      expect.any(Array),
      expect.objectContaining(initialPreferences.smartZoom!),
    );

    act(() => {
      rendered.rerender(<Excalidraw editorPreferences={nextPreferences} />);
    });

    await waitFor(() => {
      expect(h.app.props.editorPreferences).toEqual(nextPreferences);
    });

    API.executeAction(actionSmartZoom);

    expect(scrollSpy).toHaveBeenLastCalledWith(
      expect.any(Array),
      expect.objectContaining(nextPreferences.smartZoom!),
    );
  });

  it("passes overridden arrange preferences into arrangeElements", async () => {
    const arrangeSpy = vi.spyOn(arrangeModule, "arrangeElements");

    await render(
      <Excalidraw
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
