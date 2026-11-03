// MyOC: the cover of a hidden spoilered image, and the eye-closed icon and
// the "Show spoiler" button that the screen render draws over it. The draw
// and the hit test use the same geometry, so the click area is always the
// drawn button.

import { IMAGE_PLACEHOLDER_COLOR } from "@excalidraw/common";
import { pointFrom, pointRotateRads, type Radians } from "@excalidraw/math";
import { thumbHashToAverageRGBA } from "thumbhash";

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

/** the label and icon colours, one for a dark and one for a light cover */
export const SPOILER_FOREGROUND_LIGHT = "#ffffff";
export const SPOILER_FOREGROUND_DARK = "#1d1d1b";

/** the channels (0..1) of a `#rrggbb` colour */
const hexToChannels = (hex: string) =>
  [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255);

/** the grey box of the cover (no ThumbHash), as channels */
const PLACEHOLDER_CHANNELS = {
  light: hexToChannels(IMAGE_PLACEHOLDER_COLOR.light),
  dark: hexToChannels(IMAGE_PLACEHOLDER_COLOR.dark),
} as const;

const averageColorCache = new Map<string, [number, number, number] | null>();

const getThumbHashAverageColor = (thumbHash: string) => {
  if (averageColorCache.has(thumbHash)) {
    return averageColorCache.get(thumbHash)!;
  }
  let color: [number, number, number] | null = null;
  try {
    const binary = atob(thumbHash);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) {
      bytes[index] = binary.charCodeAt(index);
    }
    const { r, g, b } = thumbHashToAverageRGBA(bytes);
    if ([r, g, b].every(Number.isFinite)) {
      color = [r, g, b];
    }
  } catch {
    color = null;
  }
  averageColorCache.set(thumbHash, color);
  return color;
};

const toLinear = (channel: number) =>
  channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

/** WCAG relative luminance of an sRGB colour with channels in 0..1 */
const getLuminance = ([r, g, b]: readonly number[]) =>
  0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

const getContrast = (a: number, b: number) =>
  (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

const DARK_FOREGROUND_LUMINANCE = getLuminance(
  hexToChannels(SPOILER_FOREGROUND_DARK),
);

/**
 * The colours come from the colour under the overlay: the ThumbHash average
 * colour, or the grey placeholder of the theme when there is no usable
 * ThumbHash. The label and icon colour is the one (white or dark) with the
 * better contrast against that colour. The button is that colour mixed with
 * black (white label) or with white (dark label), so the label contrasts with
 * the button too. The hover colour keeps more of the cover colour.
 */
export const getSpoilerOverlayColors = (
  thumbHash: string | null,
  hovered: boolean,
  theme: "light" | "dark" = "light",
) => {
  const base =
    (thumbHash ? getThumbHashAverageColor(thumbHash) : null) ??
    PLACEHOLDER_CHANNELS[theme];
  const channels = base.map((channel) => Math.min(1, Math.max(0, channel)));
  const luminance = getLuminance(channels);
  const isLightCover =
    getContrast(luminance, DARK_FOREGROUND_LUMINANCE) >
    getContrast(luminance, 1);

  // keep this much of the cover colour, the rest is black or white
  const keep = hovered ? 0.45 : 0.3;
  const mixWith = isLightCover ? 1 : 0;
  const [r, g, b] = channels.map((channel) =>
    Math.round((channel * keep + mixWith * (1 - keep)) * 255),
  );
  return {
    button: `rgba(${r}, ${g}, ${b}, ${hovered ? 0.95 : 0.85})`,
    foreground: isLightCover
      ? SPOILER_FOREGROUND_DARK
      : SPOILER_FOREGROUND_LIGHT,
    shadow: isLightCover ? "rgba(255, 255, 255, 0.5)" : "rgba(0, 0, 0, 0.5)",
  };
};

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
    theme: "light" | "dark";
  },
) => {
  const { zoom, label, hovered, flipped, theme } = opts;
  const { icon, button } = getSpoilerOverlayLayout(element, zoom, label);
  if (!icon && !button) {
    return;
  }
  // the colours follow the cover under the overlay
  const cover = getImageCover(element, theme);
  const colors = getSpoilerOverlayColors(
    cover.type === "thumbHash" ? cover.thumbHash : null,
    hovered,
    theme,
  );

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
