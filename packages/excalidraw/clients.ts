import {
  COLOR_CHARCOAL_BLACK,
  COLOR_VOICE_CALL,
  COLOR_WHITE,
  THEME,
  UserIdleState,
} from "@excalidraw/common";

import { roundRect } from "./renderer/roundRect";

import type { InteractiveCanvasRenderConfig } from "./scene/types";
import type {
  Collaborator,
  InteractiveCanvasAppState,
  SocketId,
} from "./types";

function hashToInteger(id: string) {
  let hash = 0;
  if (id.length === 0) {
    return hash;
  }
  for (let i = 0; i < id.length; i++) {
    const char = id.charCodeAt(i);
    hash = (hash << 5) - hash + char;
  }
  return hash;
}

export const getClientColor = (
  socketId: SocketId,
  collaborator: Collaborator | undefined,
) => {
  // to get more even distribution in case `id` is not uniformly distributed to
  // begin with, we hash it
  const hash = Math.abs(hashToInteger(collaborator?.id || socketId));
  // we want to get a multiple of 10 number in the range of 0-360 (in other
  // words a hue value of step size 10). There are 37 such values including 0.
  const hue = (hash % 37) * 10;
  const saturation = 100;
  const lightness = 83;

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

/**
 * returns first char, capitalized
 */
export const getNameInitial = (name?: string | null) => {
  // first char can be a surrogate pair, hence using codePointAt
  const firstCodePoint = name?.trim()?.codePointAt(0);
  return (
    firstCodePoint ? String.fromCodePoint(firstCodePoint) : "?"
  ).toUpperCase();
};

export const renderRemoteCursors = ({
  context,
  renderConfig,
  appState,
  normalizedWidth,
  normalizedHeight,
}: {
  context: CanvasRenderingContext2D;
  renderConfig: InteractiveCanvasRenderConfig;
  appState: InteractiveCanvasAppState;
  normalizedWidth: number;
  normalizedHeight: number;
}) => {
  // Colors from the host app. A collaborator with a `borderColor` gets a solid
  // cursor and name label in that color, and the name text is the host's
  // surface color. Without one, the cursor fill is the host's surface color,
  // the outline is the host's divider color (else white) and the name is the
  // host's text color. Without a host surface color the fill is the
  // collaborator's generated color.
  const readHostColor = (cssVariable: string) =>
    typeof window === "undefined"
      ? ""
      : window
          .getComputedStyle(document.documentElement)
          .getPropertyValue(cssVariable)
          .trim();
  // A color of the form `var(--name)` is read from the host, so it follows the
  // host's theme.
  const resolveHostColor = (color: string | undefined) => {
    const cssVariable = color && /^var\((--[\w-]+)\)$/.exec(color)?.[1];
    return cssVariable ? readHostColor(cssVariable) : color;
  };
  const hostSurfaceColor = readHostColor("--mui-palette-background-paper");
  const hostTextColor = hostSurfaceColor
    ? readHostColor("--mui-palette-text-primary")
    : "";
  const defaultOutlineColor =
    readHostColor("--mui-palette-divider") || COLOR_WHITE;

  // Paint remote pointers
  for (const [socketId, pointer] of renderConfig.remotePointerViewportCoords) {
    let { x, y } = pointer;

    const collaborator = appState.collaborators.get(socketId);

    x -= appState.offsetLeft;
    y -= appState.offsetTop;

    const width = 11;
    const height = 14;

    const isOutOfBounds =
      x < 0 ||
      x > normalizedWidth - width ||
      y < 0 ||
      y > normalizedHeight - height;

    x = Math.max(x, 0);
    x = Math.min(x, normalizedWidth - width);
    y = Math.max(y, 0);
    y = Math.min(y, normalizedHeight - height);

    const background =
      hostSurfaceColor || getClientColor(socketId, collaborator);
    // A collaborator with a `borderColor` gets a solid cursor and name label
    // in that color, with no outline.
    const solidColor = resolveHostColor(collaborator?.borderColor);
    const outlineColor = solidColor || defaultOutlineColor;
    // `cursorStyle` "outlined" draws the cursor and the name label as a
    // surface-colored shape with an outline in the solid color. "filled" draws
    // them in the solid color.
    const isOutlined = !!solidColor && collaborator?.cursorStyle === "outlined";
    const cursorThickness = collaborator?.cursorThickness ?? 1.5;
    const secondaryColor =
      resolveHostColor(collaborator?.cursorSecondaryColor) ||
      hostSurfaceColor ||
      COLOR_WHITE;

    context.save();
    context.globalAlpha = collaborator?.cursorOpacity ?? 1;
    context.strokeStyle = background;
    context.fillStyle = background;

    const userState = renderConfig.remotePointerUserStates.get(socketId);
    const isInactive =
      isOutOfBounds ||
      userState === UserIdleState.IDLE ||
      userState === UserIdleState.AWAY;

    if (isInactive) {
      context.globalAlpha *= 0.3;
    }

    if (renderConfig.remotePointerButton.get(socketId) === "down") {
      // Two rings: a wide faint halo and a thin ring. With a `borderColor`
      // both are that color, like the cursor.
      context.beginPath();
      context.arc(x, y, 15, 0, 2 * Math.PI, false);
      context.lineWidth = 3;
      if (solidColor) {
        const ringAlpha = context.globalAlpha;
        context.globalAlpha = ringAlpha * 0.5;
        context.strokeStyle = solidColor;
        context.stroke();
        context.globalAlpha = ringAlpha;
      } else {
        context.strokeStyle = "#ffffff88";
        context.stroke();
      }
      context.closePath();

      context.beginPath();
      context.arc(x, y, 15, 0, 2 * Math.PI, false);
      context.lineWidth = solidColor ? collaborator?.cursorThickness ?? 1.5 : 1;
      context.strokeStyle = solidColor || background;
      context.stroke();
      context.closePath();
    }

    // TODO remove the dark theme color after we stop inverting canvas colors
    const IS_SPEAKING_COLOR =
      appState.theme === THEME.DARK ? "#2f6330" : COLOR_VOICE_CALL;

    const isSpeaking = collaborator?.isSpeaking;

    if (isSpeaking) {
      // cursor outline for currently speaking user
      context.fillStyle = IS_SPEAKING_COLOR;
      context.strokeStyle = IS_SPEAKING_COLOR;
      context.lineWidth = 10;
      context.lineJoin = "round";
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + 0, y + 14);
      context.lineTo(x + 4, y + 9);
      context.lineTo(x + 11, y + 8);
      context.closePath();
      context.stroke();
      context.fill();
    }

    // Background (outline) for arrow
    if (!solidColor) {
      context.fillStyle = outlineColor;
      context.strokeStyle = outlineColor;
      context.lineWidth = 5;
      context.lineJoin = "round";
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + 0, y + 14);
      context.lineTo(x + 4, y + 9);
      context.lineTo(x + 11, y + 8);
      context.closePath();
      context.stroke();
      context.fill();
    }

    // Arrow
    context.fillStyle = isOutlined ? secondaryColor : solidColor || background;
    context.strokeStyle = solidColor || background;
    // Also the stroke width of the name label border below
    context.lineWidth = solidColor ? cursorThickness : 1.5;
    context.lineJoin = "round";
    context.beginPath();
    if (isInactive) {
      context.moveTo(x - 1, y - 1);
      context.lineTo(x - 1, y + 15);
      context.lineTo(x + 5, y + 10);
      context.lineTo(x + 12, y + 9);
      context.closePath();
      context.fill();
      if (isOutlined) {
        context.stroke();
      }
    } else {
      context.moveTo(x, y);
      context.lineTo(x + 0, y + 14);
      context.lineTo(x + 4, y + 9);
      context.lineTo(x + 11, y + 8);
      context.closePath();
      context.fill();
      context.stroke();
    }

    const username = renderConfig.remotePointerUsernames.get(socketId) || "";

    if (!isOutOfBounds && username) {
      context.font = "600 12px sans-serif"; // font has to be set before context.measureText()

      const offsetX = (isSpeaking ? x + 0 : x) + width / 2;
      const offsetY = (isSpeaking ? y + 0 : y) + height + 2;
      const paddingHorizontal = 5;
      const paddingVertical = 3;
      const measure = context.measureText(username);
      const measureHeight =
        measure.actualBoundingBoxDescent + measure.actualBoundingBoxAscent;
      const finalHeight = Math.max(measureHeight, 12);

      const boxX = offsetX - 1;
      const boxY = offsetY - 1;
      const boxWidth = measure.width + 2 + paddingHorizontal * 2 + 2;
      const boxHeight = finalHeight + 2 + paddingVertical * 2 + 2;
      if (context.roundRect) {
        context.beginPath();
        context.roundRect(boxX, boxY, boxWidth, boxHeight, 8);
        // Outlined: a secondary color name tag with a solid color text and
        // border. Filled: a solid color name tag with a secondary color text.
        context.fillStyle = isOutlined
          ? secondaryColor
          : solidColor || background;
        context.fill();
        context.strokeStyle = outlineColor;
        context.stroke();

        if (isSpeaking) {
          context.beginPath();
          context.roundRect(boxX - 2, boxY - 2, boxWidth + 4, boxHeight + 4, 8);
          context.strokeStyle = IS_SPEAKING_COLOR;
          context.stroke();
        }
      } else {
        roundRect(context, boxX, boxY, boxWidth, boxHeight, 8, outlineColor);
      }
      context.fillStyle = solidColor
        ? isOutlined
          ? solidColor
          : secondaryColor
        : hostTextColor || COLOR_CHARCOAL_BLACK;

      context.fillText(
        username,
        offsetX + paddingHorizontal + 1,
        offsetY +
          paddingVertical +
          measure.actualBoundingBoxAscent +
          Math.floor((finalHeight - measureHeight) / 2) +
          2,
      );

      // draw three vertical bars signalling someone is speaking
      if (isSpeaking) {
        context.fillStyle = IS_SPEAKING_COLOR;
        const barheight = 8;
        const margin = 8;
        const gap = 5;
        context.fillRect(
          boxX + boxWidth + margin,
          boxY + (boxHeight / 2 - barheight / 2),
          2,
          barheight,
        );
        context.fillRect(
          boxX + boxWidth + margin + gap,
          boxY + (boxHeight / 2 - (barheight * 2) / 2),
          2,
          barheight * 2,
        );
        context.fillRect(
          boxX + boxWidth + margin + gap * 2,
          boxY + (boxHeight / 2 - barheight / 2),
          2,
          barheight,
        );
      }
    }

    context.restore();
    context.closePath();
  }
};
