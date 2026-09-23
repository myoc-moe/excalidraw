import { decodeAnimated } from "@discourse/gif";

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
const GIF_WORKER_FILENAME = "gif.worker.js";

export type GifDecodeStatus = "pending" | "success" | "error" | "deferred";

const logGifDecodeMode = (
  mode: "main-thread" | "worker",
  context?: Record<string, unknown>,
) => {
  // eslint-disable-next-line no-console
  console.debug("[excalidraw][gif-decode]", {
    mode,
    ...context,
  });
};

type DecodedGifFrame = {
  width: number;
  height: number;
  delay: number;
  data: ArrayBuffer;
};

type DecodedGif = {
  frames: DecodedGifFrame[];
  width: number;
  height: number;
};

type GifWorkerResponse =
  | ({ type: "success" } & DecodedGif)
  | { type: "error"; message: string };

// The element package build emits gif.worker.js alongside index.js. Apps can
// still provide a bundler-resolved worker URL when their setup needs one.
let gifWorkerUrl: string | undefined = new URL(
  GIF_WORKER_FILENAME,
  import.meta.url,
).toString();

export const configureGifWorkerUrl = (workerUrl: string | undefined) => {
  gifWorkerUrl = workerUrl;
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

const getGifDimensions = (buffer: ArrayBuffer) => {
  if (buffer.byteLength < 10) {
    return null;
  }
  const data = new DataView(buffer);
  return {
    width: data.getUint16(6, true),
    height: data.getUint16(8, true),
  };
};

const decodeGifOnMainThread = async (
  buffer: ArrayBuffer,
): Promise<DecodedGif> => {
  const dimensions = getGifDimensions(buffer);
  const gifFrames = await decodeAnimated(buffer);

  try {
    return {
      width: dimensions?.width ?? gifFrames[0]?.imageData.width ?? 0,
      height: dimensions?.height ?? gifFrames[0]?.imageData.height ?? 0,
      frames: gifFrames.map((frame) => {
        const imageData = frame.imageData;
        return {
          width: imageData.width,
          height: imageData.height,
          delay: frame.duration,
          data: imageData.data.buffer as ArrayBuffer,
        };
      }),
    };
  } finally {
    gifFrames.forEach((frame) => frame.free());
  }
};

const decodeGifInWorker = (buffer: ArrayBuffer) =>
  new Promise<DecodedGif>((resolve, reject) => {
    const worker = new Worker(gifWorkerUrl!, { type: "module" });
    let settled = false;

    const finish = () => {
      if (!settled) {
        settled = true;
        worker.terminate();
      }
    };

    worker.onmessage = (event: MessageEvent<GifWorkerResponse>) => {
      finish();
      if (event.data.type === "error") {
        reject(new Error(event.data.message));
      } else {
        resolve({
          frames: event.data.frames,
          width: event.data.width,
          height: event.data.height,
        });
      }
    };

    worker.onerror = (event) => {
      finish();
      reject(new Error(event.message || "GIF worker failed"));
    };
    worker.onmessageerror = () => {
      finish();
      reject(new Error("GIF worker returned an unreadable response"));
    };

    try {
      worker.postMessage(buffer, [buffer]);
    } catch (error) {
      finish();
      reject(error);
    }
  });

export const decodeGifFrames = async (dataURL: DataURL) => {
  const buffer = dataURLToArrayBuffer(dataURL);
  const useWorker = Boolean(gifWorkerUrl && typeof Worker !== "undefined");
  logGifDecodeMode(useWorker ? "worker" : "main-thread", {
    byteLength: buffer.byteLength,
    workerUrl: gifWorkerUrl,
  });

  const decodedGif = useWorker
    ? await decodeGifInWorker(buffer)
    : await decodeGifOnMainThread(buffer);

  const frames = decodedGif.frames.map((frame) => {
    const canvas = document.createElement("canvas");
    canvas.width = frame.width;
    canvas.height = frame.height;
    const context = canvas.getContext("2d");

    if (context) {
      const imageData = context.createImageData(frame.width, frame.height);
      imageData.data.set(new Uint8ClampedArray(frame.data));
      context.putImageData(imageData, 0, 0);
    }

    return canvas;
  });

  return {
    frames,
    delays: decodedGif.frames.map((frame) => Math.max(frame.delay, 16)),
    width: decodedGif.width,
    height: decodedGif.height,
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
