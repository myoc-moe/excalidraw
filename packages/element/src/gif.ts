import { decode, decodeFrames } from "modern-gif";
import gifWorkerUrl from "modern-gif/worker?url";

import type { DataURL } from "@excalidraw/excalidraw/types";

import type {
  ExcalidrawGifCache,
  ExcalidrawGifPlayback,
  ExcalidrawImageElement,
  FileId,
  NonDeletedExcalidrawElement,
} from "./types";
import { isInitializedImageElement } from "./typeChecks";

const MAX_CONCURRENT_GIF_DECODES = 5;

type GifImageCache = Map<
  FileId,
  {
    gifDecodeInProgress?: boolean;
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

export const decodeGifFrames = async (dataURL: DataURL) => {
  const buffer = dataURLToArrayBuffer(dataURL);
  const gif = decode(buffer);
  const decodedFrames = await decodeFrames(buffer, {
    gif,
    workerUrl: gifWorkerUrl,
  });

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

const getDataURLByteLength = (dataURL: DataURL) => {
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
) => {
  const gifFrameIndex = element.gifPlayback?.playing
    ? cacheEntry?.gif?.runtimeFrameIndex ?? element.gifPlayback.frameIndex
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
    return cacheEntry?.gifDecodeInProgress && !cacheEntry.gif?.frames.length;
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
