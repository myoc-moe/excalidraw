import { decodeAnimated } from "@discourse/gif";

import type { GIFFrame } from "@discourse/gif";

type GifWorkerRequest = ArrayBuffer;

type GifWorkerFrame = {
  width: number;
  height: number;
  delay: number;
  data: ArrayBuffer;
};

type GifWorkerResponse =
  | {
      type: "success";
      frames: GifWorkerFrame[];
      width: number;
      height: number;
    }
  | { type: "error"; message: string };

type GifWorkerScope = {
  onmessage: ((event: MessageEvent<GifWorkerRequest>) => void) | null;
  postMessage: (message: GifWorkerResponse, transfer?: Transferable[]) => void;
};

const workerScope = globalThis as unknown as GifWorkerScope;

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

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

workerScope.onmessage = async (event) => {
  let frames: GIFFrame[] = [];

  try {
    const dimensions = getGifDimensions(event.data);
    frames = await decodeAnimated(event.data);

    const decodedFrames = frames.map((frame) => {
      const imageData = frame.imageData;
      return {
        width: imageData.width,
        height: imageData.height,
        delay: frame.duration,
        data: imageData.data.buffer as ArrayBuffer,
      };
    });

    workerScope.postMessage(
      {
        type: "success",
        frames: decodedFrames,
        width: dimensions?.width ?? frames[0]?.imageData.width ?? 0,
        height: dimensions?.height ?? frames[0]?.imageData.height ?? 0,
      },
      decodedFrames.map((frame) => frame.data),
    );
  } catch (error) {
    workerScope.postMessage({
      type: "error",
      message: getErrorMessage(error),
    });
  } finally {
    frames.forEach((frame) => frame.free());
  }
};
