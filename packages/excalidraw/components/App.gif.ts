import {
  createGifPlaybackMetadata,
  hasPlayableGif,
  isInitializedImageElement,
  newElementWith,
  ShapeCache,
} from "@excalidraw/element";
import { MIME_TYPES } from "@excalidraw/common";

import type App from "./App";
import type {
  ExcalidrawImageElement,
  FileId,
  InitializedExcalidrawImageElement,
  NonDeleted,
} from "@excalidraw/element/types";

export class AppGifPlayback {
  private playbackRaf: number | null = null;

  constructor(private app: App) {}

  stop = () => {
    if (this.playbackRaf !== null) {
      cancelAnimationFrame(this.playbackRaf);
      this.playbackRaf = null;
    }
  };

  ensureLoop = () => {
    if (this.playbackRaf !== null || this.app.unmounted) {
      return;
    }

    if (
      !hasPlayableGif(
        this.app.scene.getNonDeletedElements(),
        this.app.imageCache,
      )
    ) {
      return;
    }

    this.playbackRaf = requestAnimationFrame(this.tick);
  };

  createPlaceholderDecodeState = (
    placeholderImageElement: ExcalidrawImageElement,
    imageFile: File,
  ) => {
    if (imageFile.type !== MIME_TYPES.gif) {
      return null;
    }

    const placeholderGifFileId = placeholderImageElement.id as FileId;
    this.app.imageCache.set(placeholderGifFileId, {
      image: new Promise<HTMLImageElement>(() => {}),
      mimeType: MIME_TYPES.gif,
      gifDecodeInProgress: true,
    });

    const gifPlaceholder = newElementWith(placeholderImageElement, {
      fileId: placeholderGifFileId,
      gifPlayback: createGifPlaybackMetadata({ playing: true }),
    });
    this.app.scene.replaceAllElements(
      this.app.scene
        .getElementsIncludingDeleted()
        .map((element) =>
          element.id === gifPlaceholder.id ? gifPlaceholder : element,
        ),
    );
    this.app.imagePlaceholderUpdateEmitter.trigger();

    return placeholderGifFileId;
  };

  ensureElementPlaybackMetadata = (
    element: NonDeleted<InitializedExcalidrawImageElement>,
    opts: { playing?: boolean } = {},
  ): NonDeleted<InitializedExcalidrawImageElement> => {
    const shouldUseExisting =
      element.gifPlayback &&
      (opts.playing === undefined ||
        element.gifPlayback.playing === opts.playing);

    return shouldUseExisting
      ? element
      : newElementWith(element, {
          gifPlayback: element.gifPlayback
            ? {
                ...element.gifPlayback,
                playing: opts.playing ?? element.gifPlayback.playing,
              }
            : createGifPlaybackMetadata(opts),
        });
  };

  removePlaceholderDecodeState = (placeholderGifFileId: FileId | null) => {
    if (placeholderGifFileId) {
      this.app.imageCache.delete(placeholderGifFileId);
    }
  };

  private tick = () => {
    this.playbackRaf = null;

    if (this.app.unmounted) {
      return;
    }

    const now = performance.now();
    let didAdvanceFrame = false;
    let shouldContinue = false;

    for (const element of this.app.scene.getNonDeletedElements()) {
      if (
        !isInitializedImageElement(element) ||
        !element.gifPlayback?.playing
      ) {
        continue;
      }

      const gif = this.app.imageCache.get(element.fileId)?.gif;
      if (!gif || gif.frames.length < 2) {
        continue;
      }

      shouldContinue = true;

      const speed = Math.max(element.gifPlayback.speed || 1, 0.1);
      const currentFrameIndex =
        gif.runtimeFrameIndex ?? element.gifPlayback.frameIndex ?? 0;
      const delay = gif.delays[currentFrameIndex] ?? 100;

      if (now - gif.lastFrameTime >= delay / speed) {
        gif.runtimeFrameIndex = (currentFrameIndex + 1) % gif.frames.length;
        gif.lastFrameTime = now;
        ShapeCache.delete(element);
        didAdvanceFrame = true;
      }
    }

    if (didAdvanceFrame) {
      this.app.scene.triggerUpdate();
    }

    if (shouldContinue) {
      this.playbackRaf = requestAnimationFrame(this.tick);
    }
  };
}
