import React from "react";
import { vi } from "vitest";

import { resolvablePromise } from "@excalidraw/common";

import { Excalidraw } from "../index";

import { Pointer } from "./helpers/ui";
import { act, render } from "./test-utils";

import type { ExcalidrawImperativeAPI } from "../types";

const waitForNextAnimationFrame = () => {
  return act(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(resolve);
        });
      }),
  );
};

describe("setActiveTool()", () => {
  const h = window.h;

  let excalidrawAPI: ExcalidrawImperativeAPI;

  const mouse = new Pointer("mouse");

  beforeEach(async () => {
    const excalidrawAPIPromise = resolvablePromise<ExcalidrawImperativeAPI>();
    await render(
      <Excalidraw
        onExcalidrawAPI={(api) => excalidrawAPIPromise.resolve(api as any)}
      />,
    );
    excalidrawAPI = await excalidrawAPIPromise;
  });

  it("should expose setActiveTool on package API", () => {
    expect(excalidrawAPI.setActiveTool).toBeDefined();
    expect(excalidrawAPI.setActiveTool).toBe(h.app.setActiveTool);
  });

  it("should set the active tool type", async () => {
    expect(h.state.activeTool.type).toBe("selection");
    act(() => {
      excalidrawAPI.setActiveTool({ type: "rectangle" });
    });
    expect(h.state.activeTool.type).toBe("rectangle");

    mouse.down(10, 10);
    mouse.up(20, 20);

    expect(h.state.activeTool.type).toBe("selection");
  });

  it("should support tool locking", async () => {
    expect(h.state.activeTool.type).toBe("selection");
    act(() => {
      excalidrawAPI.setActiveTool({ type: "rectangle", locked: true });
    });
    expect(h.state.activeTool.type).toBe("rectangle");

    mouse.down(10, 10);
    mouse.up(20, 20);

    expect(h.state.activeTool.type).toBe("rectangle");
  });

  it("should set custom tool", async () => {
    expect(h.state.activeTool.type).toBe("selection");
    act(() => {
      excalidrawAPI.setActiveTool({ type: "custom", customType: "comment" });
    });
    expect(h.state.activeTool.type).toBe("custom");
    expect(h.state.activeTool.customType).toBe("comment");
  });
});

describe("scrollToViewport()", () => {
  const h = window.h;

  let excalidrawAPI: ExcalidrawImperativeAPI;

  beforeEach(async () => {
    const excalidrawAPIPromise = resolvablePromise<ExcalidrawImperativeAPI>();
    await render(
      <Excalidraw
        onExcalidrawAPI={(api) => excalidrawAPIPromise.resolve(api as any)}
      />,
    );
    excalidrawAPI = await excalidrawAPIPromise;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should expose scrollToViewport on package API", () => {
    expect(excalidrawAPI.scrollToViewport).toBeDefined();
    expect(excalidrawAPI.scrollToViewport).toBe(h.app.scrollToViewport);
  });

  it("should move the viewport to the exact target", () => {
    act(() => {
      excalidrawAPI.scrollToViewport({
        scrollX: -120,
        scrollY: 240,
        zoom: 0.75,
      });
    });

    expect(h.state.scrollX).toBe(-120);
    expect(h.state.scrollY).toBe(240);
    expect(h.state.zoom.value).toBe(0.75);
  });

  it("should animate the viewport to the exact target", async () => {
    const requestAnimationFrameSpy = vi.spyOn(window, "requestAnimationFrame");

    act(() => {
      excalidrawAPI.scrollToViewport(
        {
          scrollX: -200,
          scrollY: 150,
          zoom: 0.5,
        },
        { animate: true },
      );
    });

    expect(requestAnimationFrameSpy).toHaveBeenCalled();
    expect(h.state.scrollX).toBe(0);
    expect(h.state.scrollY).toBe(0);
    expect(h.state.zoom.value).toBe(1);

    await waitForNextAnimationFrame();

    const prevScrollX = h.state.scrollX;
    const prevScrollY = h.state.scrollY;
    const prevZoom = h.state.zoom.value;

    expect(h.state.scrollX).not.toBe(0);
    expect(h.state.scrollY).not.toBe(0);
    expect(h.state.zoom.value).not.toBe(1);

    await waitForNextAnimationFrame();

    expect(h.state.scrollX).not.toBe(prevScrollX);
    expect(h.state.scrollY).not.toBe(prevScrollY);
    expect(h.state.zoom.value).not.toBe(prevZoom);
  });
});
