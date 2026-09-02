import type { ExcalidrawGifPlayback } from "@excalidraw/element/types";

type RestorableGifPlayback = Partial<ExcalidrawGifPlayback> | null | undefined;

export const restoreGifPlayback = (
  gifPlayback: RestorableGifPlayback,
): ExcalidrawGifPlayback | null => {
  if (
    gifPlayback &&
    typeof gifPlayback.frameIndex === "number" &&
    typeof gifPlayback.speed === "number" &&
    typeof gifPlayback.playing === "boolean"
  ) {
    return {
      frameIndex: Math.max(0, Math.floor(gifPlayback.frameIndex)),
      speed: gifPlayback.speed > 0 ? gifPlayback.speed : 1,
      playing: gifPlayback.playing,
    };
  }

  return null;
};
