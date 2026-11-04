// MyOC: the cover of a hidden spoilered image, and the eye-closed icon and
// the "Show spoiler" button that the screen render draws over it. The draw
// and the hit test use the same geometry, so the click area is always the
// drawn button.

import { IMAGE_PLACEHOLDER_COLOR } from "@excalidraw/common";
import { pointFrom, pointRotateRads, type Radians } from "@excalidraw/math";

import type { GlobalPoint } from "@excalidraw/math";
import type { SpoilerRenderConfig } from "@excalidraw/excalidraw/scene/types";
import type { AppState } from "@excalidraw/excalidraw/types";

import { getThumbHashPlaceholder } from "./image";
import { getLineWidth } from "./textMeasurements";
import { isInitializedImageElement } from "./typeChecks";

import type {
  ExcalidrawElement,
  ExcalidrawImageElement,
  FontString,
} from "./types";

// -----------------------------------------------------------------------------
// hidden state and cover
// -----------------------------------------------------------------------------

/** The render-side spoiler predicate: true for an image whose file the render
 * config hides. False for an element with no file id. */
export const isImageSpoilerHidden = (
  element: ExcalidrawElement | null | undefined,
  spoiler: SpoilerRenderConfig | null | undefined,
): boolean =>
  !!element &&
  !!spoiler &&
  isInitializedImageElement(element) &&
  spoiler.isFileHidden(element.fileId);

export type ImageCover =
  | { type: "thumbHash"; thumbHash: string; canvas: HTMLCanvasElement }
  | { type: "color"; color: string };

/** The cover fill of an image with no image drawn: the ThumbHash blur, or
 * the grey box of the theme when the element is in error or has no usable
 * ThumbHash. A hidden spoilered image draws only this (canvas and SVG); the
 * normal placeholder draws it under its glyph. */
export const getImageCover = (
  element: ExcalidrawImageElement,
  theme: AppState["theme"],
): ImageCover => {
  if (element.status !== "error" && element.thumbHash) {
    const canvas = getThumbHashPlaceholder(element.thumbHash);
    if (canvas) {
      return { type: "thumbHash", thumbHash: element.thumbHash, canvas };
    }
  }
  return { type: "color", color: IMAGE_PLACEHOLDER_COLOR[theme] };
};

// -----------------------------------------------------------------------------
// layout and hit test
// -----------------------------------------------------------------------------

// sizes in screen px. The draw divides them by the zoom, so the overlay keeps
// one on-screen size at every zoom.
const ICON_SIZE = 22;
const ICON_MIN_SIZE = 6;
const GAP = 6;
const FONT_SIZE = 12;
const BUTTON_HEIGHT = 24;
const BUTTON_PADDING_X = 12;
/** space to keep free between the button and the element edges */
const EDGE_MARGIN = 8;

/** the font of the button label, at `fontSize` px. The measure and the draw
 * both use it. */
export const getSpoilerLabelFont = (fontSize: number) =>
  `600 ${fontSize}px system-ui, sans-serif` as FontString;

type Rect = { x: number; y: number; width: number; height: number };

export type SpoilerOverlayLayout = {
  /** the icon centre and size */
  icon: { x: number; y: number; size: number } | null;
  /** null when the element is below the minimum on-screen size */
  button: Rect | null;
};

const labelWidthCache = new Map<string, number>();

const getLabelWidth = (label: string) => {
  let width = labelWidthCache.get(label);
  if (width === undefined) {
    width = getLineWidth(label, getSpoilerLabelFont(FONT_SIZE));
    labelWidthCache.set(label, width);
  }
  return width;
};

/** The icon and the button in element space: origin at the element top-left,
 * no rotation and no flip. Centred in the element. */
export const getSpoilerOverlayLayout = (
  element: Pick<ExcalidrawImageElement, "width" | "height">,
  zoom: number,
  label: string,
): SpoilerOverlayLayout => {
  const screenWidth = Math.abs(element.width) * zoom;
  const screenHeight = Math.abs(element.height) * zoom;
  const cx = element.width / 2;
  const cy = element.height / 2;

  const buttonWidth = getLabelWidth(label) + BUTTON_PADDING_X * 2;
  const contentHeight = ICON_SIZE + GAP + BUTTON_HEIGHT;

  if (
    screenWidth >= buttonWidth + EDGE_MARGIN * 2 &&
    screenHeight >= contentHeight + EDGE_MARGIN * 2
  ) {
    const top = cy - contentHeight / 2 / zoom;
    return {
      icon: { x: cx, y: top + ICON_SIZE / 2 / zoom, size: ICON_SIZE / zoom },
      button: {
        x: cx - buttonWidth / 2 / zoom,
        y: top + (ICON_SIZE + GAP) / zoom,
        width: buttonWidth / zoom,
        height: BUTTON_HEIGHT / zoom,
      },
    };
  }

  // too small for the button: the icon only, smaller if needed
  const iconSize = Math.min(ICON_SIZE, Math.min(screenWidth, screenHeight) / 2);
  return {
    icon:
      iconSize >= ICON_MIN_SIZE
        ? { x: cx, y: cy, size: iconSize / zoom }
        : null,
    button: null,
  };
};

/** `point` is in scene space. The overlay never flips (the draw cancels the
 * element flip), so only the rotation is undone here. */
export const isPointInSpoilerButton = (
  element: ExcalidrawImageElement,
  point: { x: number; y: number },
  zoom: number,
  label: string,
) => {
  const { button } = getSpoilerOverlayLayout(element, zoom, label);
  if (!button) {
    return false;
  }
  const center = pointFrom<GlobalPoint>(
    element.x + element.width / 2,
    element.y + element.height / 2,
  );
  const [x, y] = pointRotateRads(
    pointFrom<GlobalPoint>(point.x, point.y),
    center,
    -element.angle as Radians,
  );
  const localX = x - element.x;
  const localY = y - element.y;
  return (
    localX >= button.x &&
    localX <= button.x + button.width &&
    localY >= button.y &&
    localY <= button.y + button.height
  );
};

// -----------------------------------------------------------------------------
// colours
// -----------------------------------------------------------------------------

/** The label and icon colour. The same on every cover. */
export const SPOILER_FOREGROUND = "#ffffff";

/** The overlay colours are the same on every cover, in both themes: a white
 * icon with a dark shadow, and a dark button with a white label. The hover
 * button is lighter and more opaque. */
export const getSpoilerOverlayColors = (hovered: boolean) => ({
  button: hovered ? "rgba(58, 58, 54, 0.95)" : "rgba(29, 29, 27, 0.85)",
  foreground: SPOILER_FOREGROUND,
  shadow: "rgba(0, 0, 0, 0.5)",
});

// -----------------------------------------------------------------------------
// draw
// -----------------------------------------------------------------------------

/** the eye-closed icon, as a 24 by 24 path (same as the wireframes) */
const EYE_CLOSED_PATH =
  "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z M15 12a3 3 0 1 1-6 0a3 3 0 1 1 6 0z M3 3l18 18";

/** Draws in element space (see `getSpoilerOverlayLayout`). Set `flipped` when
 * the caller applies the element flip to this context, so the overlay text
 * and icon do not mirror. */
export const drawSpoilerOverlay = (
  element: ExcalidrawImageElement,
  context: CanvasRenderingContext2D,
  opts: {
    zoom: number;
    label: string;
    hovered: boolean;
    flipped: boolean;
  },
) => {
  const { zoom, label, hovered, flipped } = opts;
  const { icon, button } = getSpoilerOverlayLayout(element, zoom, label);
  if (!icon && !button) {
    return;
  }
  const colors = getSpoilerOverlayColors(hovered);

  context.save();
  if (flipped) {
    context.translate(element.width / 2, element.height / 2);
    context.scale(element.scale[0], element.scale[1]);
    context.translate(-element.width / 2, -element.height / 2);
  }

  if (icon) {
    context.save();
    context.translate(icon.x - icon.size / 2, icon.y - icon.size / 2);
    context.scale(icon.size / 24, icon.size / 24);
    context.strokeStyle = colors.foreground;
    context.lineWidth = 2;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.shadowColor = colors.shadow;
    context.shadowBlur = 2;
    context.stroke(new Path2D(EYE_CLOSED_PATH));
    context.restore();
  }

  if (button) {
    context.beginPath();
    if (context.roundRect) {
      context.roundRect(
        button.x,
        button.y,
        button.width,
        button.height,
        button.height / 2,
      );
    } else {
      context.rect(button.x, button.y, button.width, button.height);
    }
    context.fillStyle = colors.button;
    context.fill();

    context.fillStyle = colors.foreground;
    context.font = getSpoilerLabelFont(FONT_SIZE / zoom);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(
      label,
      button.x + button.width / 2,
      button.y + button.height / 2,
    );
  }

  context.restore();
};
