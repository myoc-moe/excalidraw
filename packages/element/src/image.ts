// -----------------------------------------------------------------------------
// ExcalidrawImageElement & related helpers
// -----------------------------------------------------------------------------

import { MIME_TYPES, SVG_NS } from "@excalidraw/common";
import { rgbaToThumbHash, thumbHashToRGBA } from "thumbhash";

import type {
  AppClassProperties,
  DataURL,
  BinaryFiles,
} from "@excalidraw/excalidraw/types";

import { isInitializedImageElement } from "./typeChecks";

import type {
  ExcalidrawElement,
  FileId,
  InitializedExcalidrawImageElement,
} from "./types";

const THUMB_HASH_MAX_DIMENSION = 100;
const thumbHashCanvasCache = new Map<string, HTMLCanvasElement>();
const invalidThumbHashes = new Set<string>();

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
};

const base64ToBytes = (base64: string) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

export const generateThumbHash = (image: HTMLImageElement) => {
  const naturalWidth = image.naturalWidth || image.width;
  const naturalHeight = image.naturalHeight || image.height;
  if (!naturalWidth || !naturalHeight) {
    return null;
  }

  const scale = Math.min(
    1,
    THUMB_HASH_MAX_DIMENSION / Math.max(naturalWidth, naturalHeight),
  );
  const width = Math.max(1, Math.round(naturalWidth * scale));
  const height = Math.max(1, Math.round(naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  context.drawImage(image, 0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height);
  return bytesToBase64(rgbaToThumbHash(width, height, imageData.data));
};

export const getThumbHashPlaceholder = (thumbHash: string) => {
  if (invalidThumbHashes.has(thumbHash)) {
    return null;
  }
  const cached = thumbHashCanvasCache.get(thumbHash);
  if (cached) {
    return cached;
  }

  try {
    const { w, h, rgba } = thumbHashToRGBA(base64ToBytes(thumbHash));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const context = canvas.getContext("2d");
    if (!context) {
      return null;
    }
    const imageData = context.createImageData(w, h);
    imageData.data.set(rgba);
    context.putImageData(imageData, 0, 0);
    thumbHashCanvasCache.set(thumbHash, canvas);
    return canvas;
  } catch (error) {
    invalidThumbHashes.add(thumbHash);
    console.warn("Invalid ThumbHash", error);
    return null;
  }
};

export const loadHTMLImageElement = (dataURL: DataURL) => {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      resolve(image);
    };
    image.onerror = (error) => {
      reject(error);
    };
    image.src = dataURL;
  });
};

/** NOTE: updates cache even if already populated with given image. Thus,
 * you should filter out the images upstream if you want to optimize this. */
export const updateImageCache = async ({
  fileIds,
  files,
  imageCache,
}: {
  fileIds: FileId[];
  files: BinaryFiles;
  imageCache: AppClassProperties["imageCache"];
}) => {
  const updatedFiles = new Map<FileId, true>();
  const erroredFiles = new Map<FileId, true>();

  await Promise.all(
    fileIds.reduce((promises, fileId) => {
      const fileData = files[fileId as string];
      if (fileData && !updatedFiles.has(fileId)) {
        updatedFiles.set(fileId, true);
        return promises.concat(
          (async () => {
            try {
              if (fileData.mimeType === MIME_TYPES.binary) {
                throw new Error("Only images can be added to ImageCache");
              }

              const previousCacheEntry = imageCache.get(fileId);
              const imagePromise = loadHTMLImageElement(fileData.dataURL);
              const data = {
                image: imagePromise,
                mimeType: fileData.mimeType,
              } as const;
              // store the promise immediately to indicate there's an in-progress
              // initialization
              imageCache.set(fileId, data);

              const image = await imagePromise;

              if (previousCacheEntry?.isPlaceholder) {
                imageCache.set(fileId, {
                  ...data,
                  image,
                  placeholderImage: await previousCacheEntry.image,
                  transitionStart: performance.now(),
                });
              } else {
                imageCache.set(fileId, { ...data, image });
              }
            } catch (error: any) {
              erroredFiles.set(fileId, true);
            }
          })(),
        );
      }
      return promises;
    }, [] as Promise<any>[]),
  );

  return {
    imageCache,
    /** includes errored files because they cache was updated nonetheless */
    updatedFiles,
    /** files that failed when creating HTMLImageElement */
    erroredFiles,
  };
};

export const getInitializedImageElements = (
  elements: readonly ExcalidrawElement[],
) =>
  elements.filter((element) =>
    isInitializedImageElement(element),
  ) as InitializedExcalidrawImageElement[];

export const isHTMLSVGElement = (node: Node | null): node is SVGElement => {
  // lower-casing due to XML/HTML convention differences
  // https://johnresig.com/blog/nodename-case-sensitivity
  return node?.nodeName.toLowerCase() === "svg";
};

export const normalizeSVG = (SVGString: string) => {
  const doc = new DOMParser().parseFromString(SVGString, MIME_TYPES.svg);
  const svg = doc.querySelector("svg");
  const errorNode = doc.querySelector("parsererror");
  if (errorNode || !isHTMLSVGElement(svg)) {
    throw new Error("Invalid SVG");
  } else {
    if (!svg.hasAttribute("xmlns")) {
      svg.setAttribute("xmlns", SVG_NS);
    }

    let width = svg.getAttribute("width");
    let height = svg.getAttribute("height");

    // Do not use % or auto values for width/height
    // to avoid scaling issues when rendering at different sizes/zoom levels
    if (width?.includes("%") || width === "auto") {
      width = null;
    }
    if (height?.includes("%") || height === "auto") {
      height = null;
    }

    const viewBox = svg.getAttribute("viewBox");

    if (!width || !height) {
      width = width || "50";
      height = height || "50";

      if (viewBox) {
        const match = viewBox.match(
          /\d+ +\d+ +(\d+(?:\.\d+)?) +(\d+(?:\.\d+)?)/,
        );
        if (match) {
          [, width, height] = match;
        }
      }

      svg.setAttribute("width", width);
      svg.setAttribute("height", height);
    }

    // Make sure viewBox is set
    if (!viewBox) {
      svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    }

    return svg.outerHTML;
  }
};
