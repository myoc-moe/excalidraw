import { afterEach, describe, expect, it, vi } from "vitest";

import type { ExcalidrawImageElement } from "@excalidraw/element/types";

import { AppGifPlayback } from "./App.gif";

import type App from "./App";

describe("AppGifPlayback", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("keeps runtime frames independent for elements sharing a GIF file", () => {
    const playback = new AppGifPlayback({} as App);
    const first = {
      id: "first-gif-element",
      fileId: "shared-gif-file",
      gifPlayback: { frameIndex: 0, speed: 1, playing: true },
    } as ExcalidrawImageElement;
    const second = {
      id: "second-gif-element",
      fileId: "shared-gif-file",
      gifPlayback: { frameIndex: 0, speed: 1, playing: true },
    } as ExcalidrawImageElement;

    playback.setFrameIndex(first, 1);
    playback.setFrameIndex(second, 2);

    expect(playback.getFrameIndex(first)).toBe(1);
    expect(playback.getFrameIndex(second)).toBe(2);
  });

  it("MyOC regression: redraws an advanced runtime frame without triggering a document update", () => {
    let animationFrameCallback: FrameRequestCallback | undefined;
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        animationFrameCallback = callback;
        return 1;
      }),
    );
    vi.spyOn(performance, "now").mockReturnValueOnce(0).mockReturnValue(100);

    const element = {
      id: "gif-element",
      fileId: "gif-file",
      gifPlayback: { frameIndex: 0, speed: 1, playing: true },
      status: "saved",
      type: "image",
    } as ExcalidrawImageElement;
    const triggerUpdate = vi.fn();
    const triggerVisualRedraw = vi.fn();
    const app = {
      unmounted: false,
      scene: {
        getNonDeletedElements: () => [element],
        triggerUpdate,
      },
      imageCache: new Map([
        [
          element.fileId,
          {
            gif: {
              frames: [{}, {}],
              delays: [50, 50],
            },
          },
        ],
      ]),
      imagePlaceholderUpdateEmitter: { trigger: triggerVisualRedraw },
    } as unknown as App;
    const playback = new AppGifPlayback(app);
    playback.setFrameIndex(element, 0);

    playback.ensureLoop();
    animationFrameCallback?.(100);

    expect(playback.getFrameIndex(element)).toBe(1);
    expect(triggerVisualRedraw).toHaveBeenCalledOnce();
    expect(triggerUpdate).not.toHaveBeenCalled();
  });
});
