import { describe, expect, it } from "vitest";

import type { ExcalidrawImageElement } from "@excalidraw/element/types";

import { AppGifPlayback } from "./App.gif";

import type App from "./App";

describe("AppGifPlayback", () => {
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
});
