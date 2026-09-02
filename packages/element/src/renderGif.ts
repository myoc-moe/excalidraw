import type { StaticCanvasRenderConfig } from "@excalidraw/excalidraw/scene/types";

import type { ExcalidrawImageElement } from "./types";

type DrawImagePlaceholder = (
  element: ExcalidrawImageElement,
  context: CanvasRenderingContext2D,
  theme: StaticCanvasRenderConfig["theme"],
) => void;

export const drawGifDecodePlaceholder = (
  element: ExcalidrawImageElement,
  context: CanvasRenderingContext2D,
  theme: StaticCanvasRenderConfig["theme"],
  drawImagePlaceholder: DrawImagePlaceholder,
) => {
  drawImagePlaceholder(element, context, theme);

  const pulse = 0.55 + Math.sin(performance.now() / 350) * 0.25;
  const text = "GIF Decoding";
  const fontFamily =
    "Assistant, system-ui, BlinkMacSystemFont, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";
  const textX = element.width / 2;
  const textY = element.height / 2;

  context.save();
  context.globalAlpha *= pulse;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `600 100px ${fontFamily}`;

  const targetTextWidth = element.width * 0.6;
  const measuredWidth = context.measureText(text).width;
  const widthFitFontSize = measuredWidth
    ? (100 * targetTextWidth) / measuredWidth
    : 24;
  const fontSize = Math.max(
    12,
    Math.min(widthFitFontSize, element.height * 0.35),
  );
  context.font = `600 ${fontSize}px ${fontFamily}`;

  const finalFontSize = Number.parseFloat(
    context.font.match(/\d+(\.\d+)?px/)?.[0] ?? `${fontSize}`,
  );
  const finalMeasuredWidth = context.measureText(text).width;
  const paddingX = Math.max(12, finalFontSize * 0.55);
  const paddingY = Math.max(8, finalFontSize * 0.35);
  const pillWidth = finalMeasuredWidth + paddingX * 2;
  const pillHeight = finalFontSize + paddingY * 2;
  const pillX = textX - pillWidth / 2;
  const pillY = textY - pillHeight / 2;
  const radius = Math.min(pillHeight / 2, finalFontSize * 0.25);

  context.fillStyle = "rgba(0, 0, 0, 0.62)";
  context.beginPath();
  if (context.roundRect) {
    context.roundRect(pillX, pillY, pillWidth, pillHeight, radius);
  } else {
    context.rect(pillX, pillY, pillWidth, pillHeight);
  }
  context.fill();

  context.fillStyle = "#fff";
  context.fillText(text, textX, textY);
  context.restore();
};
