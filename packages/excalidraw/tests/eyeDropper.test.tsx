import React from "react";

import { KEYS, THEME } from "@excalidraw/common";

import { Excalidraw } from "../index";

import { Keyboard } from "./helpers/ui";
import {
  fireEvent,
  GlobalTestState,
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
  waitFor,
} from "./test-utils";

const { h } = window;

describe("eye dropper", () => {
  it("keeps the color preview within the editor container", async () => {
    await render(<Excalidraw autoFocus={true} handleKeyboardGlobally={true} />);

    Keyboard.keyPress("i");

    const preview = await waitFor(() => {
      const element =
        GlobalTestState.renderResult.container.querySelector<HTMLDivElement>(
          ".excalidraw-eye-dropper-preview",
        );
      expect(element).not.toBeNull();
      return element!;
    });

    const eyeDropperContainer =
      GlobalTestState.renderResult.container.querySelector<HTMLDivElement>(
        ".excalidraw-eye-dropper-backdrop",
      )!;
    expect(eyeDropperContainer.style.cursor).toMatch(
      /^url\(data:image\/svg\+xml/,
    );
    expect(eyeDropperContainer.style.cursor).toMatch(/\) 2 21, auto$/);

    eyeDropperContainer.getBoundingClientRect = () => ({
      left: 100,
      top: 50,
      right: 500,
      bottom: 350,
      width: 400,
      height: 300,
      x: 100,
      y: 50,
      toJSON: () => {},
    });
    Object.defineProperties(preview, {
      offsetWidth: { configurable: true, value: 48 },
      offsetHeight: { configurable: true, value: 48 },
    });

    // This position fits within the viewport, but not within the editor.
    fireEvent.pointerMove(window, { clientX: 480, clientY: 330 });

    expect(preview.style.left).toBe("325px");
    expect(preview.style.top).toBe("225px");
  });

  it("MyOC regression: applies the I eyedropper to stroke in dark mode", async () => {
    await render(
      <Excalidraw
        autoFocus={true}
        handleKeyboardGlobally={true}
        theme={THEME.DARK}
      />,
    );

    const ctx = h.app.canvas.getContext("2d")!;
    vi.spyOn(ctx, "getImageData").mockReturnValue({
      data: new Uint8ClampedArray([18, 18, 18, 255]),
    } as ImageData);

    Keyboard.keyPress(KEYS.I);

    const eyeDropperContainer = await waitFor(() => {
      const element =
        GlobalTestState.renderResult.container.querySelector<HTMLDivElement>(
          ".excalidraw-eye-dropper-backdrop",
        );
      expect(element).not.toBeNull();
      return element!;
    });

    fireEvent.pointerUp(eyeDropperContainer, {
      clientX: 50,
      clientY: 50,
      altKey: true,
    });

    expect(h.state.currentItemStrokeColor).toBe("#ffffff");
    expect(h.state.currentItemBackgroundColor).not.toBe("#ffffff");
  });

  it("MyOC regression: opens stroke eyedropper from the toolbar button", async () => {
    await render(<Excalidraw autoFocus={true} handleKeyboardGlobally={true} />);

    const ctx = h.app.canvas.getContext("2d")!;
    vi.spyOn(ctx, "getImageData").mockReturnValue({
      data: new Uint8ClampedArray([12, 34, 56, 255]),
    } as ImageData);

    fireEvent.click(
      GlobalTestState.renderResult.container.querySelector(
        '[data-testid="toolbar-eyedropper"]',
      )!,
    );

    const eyeDropperContainer = await waitFor(() => {
      const element =
        GlobalTestState.renderResult.container.querySelector<HTMLDivElement>(
          ".excalidraw-eye-dropper-backdrop",
        );
      expect(element).not.toBeNull();
      return element!;
    });

    fireEvent.pointerUp(eyeDropperContainer, {
      clientX: 50,
      clientY: 50,
      altKey: true,
    });

    expect(h.state.currentItemStrokeColor).toBe("#0c2238");
    expect(h.state.currentItemBackgroundColor).not.toBe("#0c2238");
  });

  it("MyOC regression: allows mousewheel zoom while active", async () => {
    mockBoundingClientRect();
    try {
      await render(
        <Excalidraw
          autoFocus={true}
          handleKeyboardGlobally={true}
          wheelZoomsOnDefault={true}
        />,
      );
      await waitFor(() => expect(h.state.width).toBe(200));

      Keyboard.keyPress(KEYS.I);

      const eyeDropperContainer = await waitFor(() => {
        const element =
          GlobalTestState.renderResult.container.querySelector<HTMLDivElement>(
            ".excalidraw-eye-dropper-backdrop",
          );
        expect(element).not.toBeNull();
        return element!;
      });

      const zoom = h.state.zoom.value;
      fireEvent.wheel(eyeDropperContainer, { deltaY: -100 });

      expect(h.state.zoom.value).toBeGreaterThan(zoom);
    } finally {
      restoreOriginalGetBoundingClientRect();
    }
  });

  it("contrasts the preview border with the sampled color", async () => {
    await render(<Excalidraw autoFocus={true} handleKeyboardGlobally={true} />);

    const ctx = h.app.canvas.getContext("2d")!;
    const getImageDataSpy = vi.spyOn(ctx, "getImageData").mockReturnValue({
      data: new Uint8ClampedArray([18, 18, 18, 255]),
    } as ImageData);

    Keyboard.keyPress(KEYS.I);

    const preview = await waitFor(() => {
      const element =
        GlobalTestState.renderResult.container.querySelector<HTMLDivElement>(
          ".excalidraw-eye-dropper-preview",
        );
      expect(element).not.toBeNull();
      return element!;
    });

    expect(
      preview.style.getPropertyValue("--eye-dropper-preview-border-color"),
    ).toBe("#fff");

    getImageDataSpy.mockReturnValue({
      data: new Uint8ClampedArray([237, 237, 237, 255]),
    } as ImageData);
    fireEvent.pointerMove(window, { clientX: 50, clientY: 50 });

    expect(
      preview.style.getPropertyValue("--eye-dropper-preview-border-color"),
    ).toBe("#222");
  });
});
