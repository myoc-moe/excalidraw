import { decode, decodeFrames } from "modern-gif";

import type { DataURL } from "@excalidraw/excalidraw/types";

import { isInitializedImageElement } from "./typeChecks";

import type {
  ExcalidrawGifCache,
  ExcalidrawGifPlayback,
  ExcalidrawImageElement,
  FileId,
  NonDeletedExcalidrawElement,
} from "./types";

const MAX_CONCURRENT_GIF_DECODES = 5;

export type GifDecodeStatus = "pending" | "success" | "error" | "deferred";

const logGifDecodeMode = (
  mode: "main-thread" | "worker",
  context?: Record<string, unknown>,
) => {
  console.debug("[excalidraw][gif-decode]", {
    mode,
    ...context,
  });
};

// Kept as a compatibility hook for apps that already configure a GIF worker.
// Decoding stays on the main thread because modern-gif's worker emits noisy
// parser warnings that cannot be filtered from this package.
export const configureGifWorkerUrl = (workerUrl: string | undefined) => {
  if (workerUrl) {
    logGifDecodeMode("main-thread", {
      reason: "configured worker URL ignored",
      workerUrl,
    });
  }
};

type GifImageCache = Map<
  FileId,
  {
    gifDecodeStatus?: GifDecodeStatus;
    gif?: ExcalidrawGifCache;
  }
>;

type ImageCacheEntry = NonNullable<ReturnType<GifImageCache["get"]>>;

const dataURLToArrayBuffer = (dataURL: DataURL) => {
  const dataIndexStart = dataURL.indexOf(",");
  const byteString = atob(dataURL.slice(dataIndexStart + 1));
  const buffer = new ArrayBuffer(byteString.length);
  const bytes = new Uint8Array(buffer);

  for (let index = 0; index < byteString.length; index++) {
    bytes[index] = byteString.charCodeAt(index);
  }

  return buffer;
};

const isKnownModernGifWarning = (message: unknown) =>
  typeof message === "string" && message.startsWith("Unknown block: 0x");

const suppressKnownModernGifWarnings = async <T>(
  task: () => T | Promise<T>,
) => {
  const originalWarn = console.warn;

  console.warn = (...args: Parameters<typeof console.warn>) => {
    if (isKnownModernGifWarning(args[0])) {
      return;
    }
    originalWarn(...args);
  };

  try {
    return await task();
  } finally {
    console.warn = originalWarn;
  }
};

export const decodeGifFrames = async (dataURL: DataURL) => {
  const buffer = dataURLToArrayBuffer(dataURL);
  logGifDecodeMode("main-thread", {
    byteLength: buffer.byteLength,
  });
  const { gif, decodedFrames } = await suppressKnownModernGifWarnings(
    async () => {
      const gif = decode(buffer);
      return {
        gif,
        decodedFrames: await decodeFrames(buffer, { gif }),
      };
    },
  );

  const frames = decodedFrames.map((frame) => {
    const canvas = document.createElement("canvas");
    canvas.width = frame.width;
    canvas.height = frame.height;
    const context = canvas.getContext("2d");

    if (context) {
      const imageData = context.createImageData(frame.width, frame.height);
      imageData.data.set(frame.data);
      context.putImageData(imageData, 0, 0);
    }

    return canvas;
  });

  return {
    frames,
    delays: decodedFrames.map((frame) => Math.max(frame.delay, 16)),
    width: gif.width,
    height: gif.height,
  };
};

type GifDecodeResult = Awaited<ReturnType<typeof decodeGifFrames>>;

type QueuedGifDecode = {
  dataURL: DataURL;
  priority: number;
  sequence: number;
  resolve: (result: GifDecodeResult) => void;
  reject: (error: unknown) => void;
};

let activeGifDecodeCount = 0;
let gifDecodeSequence = 0;
let gifDecodeSchedulePending = false;
const gifDecodeQueue: QueuedGifDecode[] = [];

export const getDataURLByteLength = (dataURL: DataURL) => {
  const dataIndexStart = dataURL.indexOf(",");
  const encoded = dataURL.slice(dataIndexStart + 1);
  const padding =
    (encoded.endsWith("==") && 2) || (encoded.endsWith("=") && 1) || 0;

  return Math.floor((encoded.length * 3) / 4) - padding;
};

const runGifDecodeTask = (task: QueuedGifDecode) => {
  activeGifDecodeCount++;

  decodeGifFrames(task.dataURL)
    .then(task.resolve, task.reject)
    .finally(() => {
      activeGifDecodeCount--;
      queueGifDecodeScheduler();
    });
};

const scheduleNextGifDecode = () => {
  gifDecodeSchedulePending = false;

  while (
    activeGifDecodeCount < MAX_CONCURRENT_GIF_DECODES &&
    gifDecodeQueue.length
  ) {
    runGifDecodeTask(gifDecodeQueue.shift()!);
  }
};

const queueGifDecodeScheduler = () => {
  if (gifDecodeSchedulePending) {
    return;
  }

  gifDecodeSchedulePending = true;
  queueMicrotask(scheduleNextGifDecode);
};

export const decodeGifFramesQueued = (dataURL: DataURL) => {
  return new Promise<GifDecodeResult>((resolve, reject) => {
    const task = {
      dataURL,
      priority: getDataURLByteLength(dataURL),
      sequence: gifDecodeSequence++,
      resolve,
      reject,
    };

    const insertionIndex = gifDecodeQueue.findIndex(
      (queuedTask) =>
        queuedTask.priority > task.priority ||
        (queuedTask.priority === task.priority &&
          queuedTask.sequence > task.sequence),
    );

    if (insertionIndex === -1) {
      gifDecodeQueue.push(task);
    } else {
      gifDecodeQueue.splice(insertionIndex, 0, task);
    }

    queueGifDecodeScheduler();
  });
};

export const createGifPlaybackMetadata = (
  opts: { playing?: boolean } = {},
): ExcalidrawGifPlayback => ({
  frameIndex: 0,
  speed: 1,
  playing: opts.playing ?? false,
});

export const getGifRenderFrame = (
  element: ExcalidrawImageElement,
  cacheEntry: ImageCacheEntry | null | undefined,
  runtimeFrameIndex?: number,
) => {
  const gifFrameIndex = element.gifPlayback?.playing
    ? runtimeFrameIndex ?? element.gifPlayback.frameIndex
    : element.gifPlayback?.frameIndex ?? 0;

  return cacheEntry?.gif?.frames[gifFrameIndex];
};

export const hasActiveGifDecode = (
  visibleElements: readonly NonDeletedExcalidrawElement[],
  imageCache: GifImageCache,
) =>
  visibleElements.some((element) => {
    if (!isInitializedImageElement(element)) {
      return false;
    }
    const cacheEntry = imageCache.get(element.fileId);
    return (
      cacheEntry?.gifDecodeStatus === "pending" &&
      !cacheEntry.gif?.frames.length
    );
  });

export const hasPlayableGif = (
  visibleElements: readonly NonDeletedExcalidrawElement[],
  imageCache: GifImageCache,
) =>
  visibleElements.some(
    (element) =>
      isInitializedImageElement(element) &&
      element.gifPlayback?.playing &&
      imageCache.get(element.fileId)?.gif?.frames.length,
  );
