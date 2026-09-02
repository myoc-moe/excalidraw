import clsx from "clsx";
import React from "react";

import { MIME_TYPES, sceneCoordsToViewportCoords } from "@excalidraw/common";
import {
  getCommonBounds,
  isInitializedImageElement,
  ShapeCache,
} from "@excalidraw/element";

import type {
  ExcalidrawImageElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { useExcalidrawAppState } from "./App";
import { CirclePauseIcon, frames, nextFrame, prevFrame } from "./icons";

import "./GifPlaybackControls.scss";

import type { AppClassProperties, AppState, BinaryFiles } from "../types";

const gifPlayIcon = (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M8 5v14l11 -7z" />
  </svg>
);

const gifPauseIcon = (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M8 5v14" />
    <path d="M16 5v14" />
  </svg>
);

const GIF_FRAME_GALLERY_ITEM_WIDTH = 76;
const GIF_FRAME_GALLERY_ITEM_GAP = 4;
const GIF_FRAME_GALLERY_ITEM_PITCH =
  GIF_FRAME_GALLERY_ITEM_WIDTH + GIF_FRAME_GALLERY_ITEM_GAP;
const GIF_FRAME_GALLERY_OVERSCAN = 8;
const GIF_POPUP_GAP = 8;

type GifPlaybackControlsProps = {
  app: AppClassProperties;
  files: BinaryFiles;
  setAppState: React.Component<any, AppState>["setState"];
};

type GifPopupPosition = {
  left: number;
  top: number;
};

const getClampedCenteredPopupLeft = (
  anchorCenterX: number,
  popupWidth: number,
) => {
  const halfPopupWidth = popupWidth / 2;
  return Math.min(
    Math.max(anchorCenterX, halfPopupWidth + GIF_POPUP_GAP),
    window.innerWidth - halfPopupWidth - GIF_POPUP_GAP,
  );
};

const getGifControlPosition = (
  element: NonDeletedExcalidrawElement,
  appState: AppState,
) => {
  const [, , x2, y2] = getCommonBounds([element]);
  const bottomRight = sceneCoordsToViewportCoords(
    { sceneX: x2, sceneY: y2 },
    appState,
  );

  return {
    left: Math.min(
      Math.max(bottomRight.x - appState.offsetLeft, 8),
      appState.width - 8,
    ),
    top: Math.min(
      Math.max(bottomRight.y - appState.offsetTop, 8),
      appState.height - 8,
    ),
  };
};

export const GifPlaybackControls = ({
  app,
  files,
  setAppState,
}: GifPlaybackControlsProps) => {
  const liveAppState = useExcalidrawAppState();
  const [, rerenderGifControls] = React.useReducer(
    (version: number) => version + 1,
    0,
  );
  const [gifGalleryScrollLeft, setGifGalleryScrollLeft] = React.useState(0);
  const speedButtonRef = React.useRef<HTMLButtonElement>(null);
  const framesButtonRef = React.useRef<HTMLButtonElement>(null);
  const speedPickerRef = React.useRef<HTMLDivElement>(null);
  const frameGalleryRef = React.useRef<HTMLDivElement>(null);
  const [gifPopupPosition, setGifPopupPosition] =
    React.useState<GifPopupPosition | null>(null);

  React.useLayoutEffect(() => {
    const popup = liveAppState.openPopup;
    if (popup !== "gifSpeedPicker" && popup !== "gifFrameGallery") {
      if (gifPopupPosition !== null) {
        setGifPopupPosition(null);
      }
      return;
    }

    const anchor =
      popup === "gifSpeedPicker"
        ? speedButtonRef.current
        : framesButtonRef.current;
    const popupElement =
      popup === "gifSpeedPicker"
        ? speedPickerRef.current
        : frameGalleryRef.current;

    if (!anchor || !popupElement) {
      return;
    }

    const anchorRect = anchor.getBoundingClientRect();
    const popupRect = popupElement.getBoundingClientRect();
    const left = getClampedCenteredPopupLeft(
      anchorRect.left + anchorRect.width / 2,
      popupRect.width,
    );
    const top =
      popup === "gifSpeedPicker"
        ? Math.max(
            GIF_POPUP_GAP,
            anchorRect.top - popupRect.height - GIF_POPUP_GAP,
          )
        : Math.min(
            window.innerHeight - popupRect.height - GIF_POPUP_GAP,
            anchorRect.bottom + GIF_POPUP_GAP,
          );
    const nextPosition = {
      left,
      top: Math.max(GIF_POPUP_GAP, top),
    };

    setGifPopupPosition((currentPosition) =>
      currentPosition?.left === nextPosition.left &&
      currentPosition.top === nextPosition.top
        ? currentPosition
        : nextPosition,
    );
  }, [
    gifGalleryScrollLeft,
    gifPopupPosition,
    liveAppState.openPopup,
    liveAppState.scrollX,
    liveAppState.scrollY,
    liveAppState.zoom.value,
  ]);

  const updateGifPlayback = (
    element: NonDeletedExcalidrawElement,
    gifPlayback: NonNullable<ExcalidrawImageElement["gifPlayback"]>,
  ) => {
    ShapeCache.delete(element);
    app.scene.mutateElement(element as ExcalidrawImageElement, {
      gifPlayback,
    });
    app.scheduleCapture();
    setAppState({});
    rerenderGifControls();
    if (gifPlayback.playing) {
      app.ensureGifPlaybackLoop();
    }
  };

  const deferredGifBadges = app.scene
    .getNonDeletedElements()
    .filter(
      (element) =>
        isInitializedImageElement(element) &&
        !liveAppState.selectedElementIds[element.id] &&
        files[element.fileId]?.mimeType === MIME_TYPES.gif &&
        app.imageCache.get(element.fileId)?.gifDecodeStatus === "deferred",
    )
    .map((element) => {
      const position = getGifControlPosition(element, liveAppState);
      return (
        <span
          key={element.id}
          className="gif-playback-controls gif-playback-controls__deferred-badge"
          role="img"
          aria-label="GIF paused"
          style={position}
        >
          {CirclePauseIcon}
        </span>
      );
    });

  const selectedElements = app.scene.getSelectedElements(liveAppState);
  const selectedElementControls = () => {
    if (selectedElements.length !== 1) {
      return null;
    }

    const selectedElement = selectedElements[0];
    if (
      !isInitializedImageElement(selectedElement) ||
      files[selectedElement.fileId]?.mimeType !== MIME_TYPES.gif
    ) {
      return null;
    }

    const cacheEntry = app.imageCache.get(selectedElement.fileId);
    const gif = cacheEntry?.gif;
    const [x1, , x2, y2] = getCommonBounds([selectedElement]);
    const leftTop = sceneCoordsToViewportCoords(
      { sceneX: x1, sceneY: y2 },
      liveAppState,
    );
    const rightTop = sceneCoordsToViewportCoords(
      { sceneX: x2, sceneY: y2 },
      liveAppState,
    );
    const width = rightTop.x - leftTop.x;
    const left = leftTop.x - liveAppState.offsetLeft + width / 2;
    const top = Math.max(
      12,
      Math.min(
        liveAppState.height - 86,
        leftTop.y - liveAppState.offsetTop + 16,
      ),
    );

    if (cacheEntry?.gifDecodeStatus === "deferred") {
      const position = getGifControlPosition(selectedElement, liveAppState);

      return (
        <div
          className="gif-playback-controls gif-playback-controls--deferred"
          style={position}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="gif-playback-controls__load-large"
            title="Load Large GIF"
            onClick={() => {
              app.loadDeferredGif(selectedElement.fileId);
            }}
          >
            Load Large GIF
          </button>
        </div>
      );
    }

    if (cacheEntry?.gifDecodeStatus === "pending") {
      return null;
    }

    const frameCount = gif?.frames.length ?? 0;
    if (!gif || frameCount < 2) {
      return null;
    }

    const playback = selectedElement.gifPlayback ?? {
      frameIndex: 0,
      speed: 1,
      playing: false,
    };
    const viewportAppState = app.state;
    const runtimeFrameIndex =
      app.getGifPlaybackFrameIndex(selectedElement) ?? playback.frameIndex;
    const frameIndex = Math.min(Math.max(runtimeFrameIndex, 0), frameCount - 1);
    const galleryTop = Math.min(viewportAppState.height - 120, top + 48);
    const speedPickerTop = Math.max(12, top - 52);

    const commitFrame = (nextFrameIndex: number) => {
      const normalizedFrameIndex = (nextFrameIndex + frameCount) % frameCount;
      app.setGifPlaybackFrameIndex(selectedElement, normalizedFrameIndex);
      updateGifPlayback(selectedElement, {
        ...playback,
        frameIndex: normalizedFrameIndex,
        playing: false,
      });
    };
    const wheelFrame = (event: React.WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      commitFrame(frameIndex + (event.deltaY < 0 ? 1 : -1));
    };

    const setPlaying = (playing: boolean) => {
      app.setGifPlaybackFrameIndex(selectedElement, frameIndex);
      updateGifPlayback(selectedElement, {
        ...playback,
        frameIndex,
        playing,
      });
    };

    const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 4];
    const getSpeedIndex = (speed: number) => {
      const exactIndex = speeds.indexOf(speed);
      if (exactIndex !== -1) {
        return exactIndex;
      }
      return speeds.reduce(
        (nearestIndex, candidate, index) =>
          Math.abs(candidate - speed) < Math.abs(speeds[nearestIndex] - speed)
            ? index
            : nearestIndex,
        0,
      );
    };
    const setSpeed = (speed: number) => {
      updateGifPlayback(selectedElement, {
        ...playback,
        speed,
      });
    };
    const stepSpeed = (direction: 1 | -1) => {
      const currentIndex = getSpeedIndex(playback.speed);
      setSpeed(
        speeds[
          Math.min(Math.max(currentIndex + direction, 0), speeds.length - 1)
        ],
      );
    };
    const speedLabel = Number.isInteger(playback.speed)
      ? `${playback.speed}`
      : `${playback.speed}`;
    const galleryScrollWidth =
      frameCount * GIF_FRAME_GALLERY_ITEM_PITCH - GIF_FRAME_GALLERY_ITEM_GAP;
    const galleryViewportWidth = Math.min(
      Math.max(viewportAppState.width * 0.9, 1),
      galleryScrollWidth,
    );
    const galleryMaxScrollLeft = Math.max(
      galleryScrollWidth - galleryViewportWidth,
      0,
    );
    const clampedGifGalleryScrollLeft = Math.min(
      gifGalleryScrollLeft,
      galleryMaxScrollLeft,
    );
    const firstVisibleFrameIndex = Math.max(
      Math.floor(clampedGifGalleryScrollLeft / GIF_FRAME_GALLERY_ITEM_PITCH) -
        GIF_FRAME_GALLERY_OVERSCAN,
      0,
    );
    const visibleFrameCount =
      Math.ceil(galleryViewportWidth / GIF_FRAME_GALLERY_ITEM_PITCH) +
      GIF_FRAME_GALLERY_OVERSCAN * 2;
    const lastVisibleFrameIndex = Math.min(
      firstVisibleFrameIndex + visibleFrameCount,
      frameCount,
    );
    const visibleFrames = gif.frames.slice(
      firstVisibleFrameIndex,
      lastVisibleFrameIndex,
    );

    return (
      <div
        className="gif-playback-controls"
        style={{ left, top }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {liveAppState.openPopup === "gifSpeedPicker" && (
          <div
            className="gif-speed-picker"
            ref={speedPickerRef}
            style={gifPopupPosition ?? { left, top: speedPickerTop }}
          >
            {speeds.map((speed) => {
              const label = Number.isInteger(speed) ? `${speed}` : `${speed}`;
              return (
                <button
                  type="button"
                  key={speed}
                  className={clsx("gif-speed-picker__speed", {
                    "gif-speed-picker__speed--selected":
                      speed === playback.speed,
                  })}
                  onClick={() => setSpeed(speed)}
                  title={`${label}x`}
                >
                  x{label}
                </button>
              );
            })}
          </div>
        )}
        <div className="gif-playback-controls__bar">
          <button
            type="button"
            className="gif-playback-controls__button gif-playback-controls__button--speed"
            ref={speedButtonRef}
            onClick={() =>
              setAppState({
                openPopup:
                  liveAppState.openPopup === "gifSpeedPicker"
                    ? null
                    : "gifSpeedPicker",
              })
            }
            onWheel={(event) => {
              event.preventDefault();
              event.stopPropagation();
              stepSpeed(event.deltaY < 0 ? 1 : -1);
            }}
            title="Speed"
          >
            x{speedLabel}
          </button>
          <button
            type="button"
            className="gif-playback-controls__button"
            onClick={() => commitFrame(frameIndex - 1)}
            onWheel={wheelFrame}
            title="Previous frame"
          >
            {prevFrame}
          </button>
          <button
            type="button"
            className="gif-playback-controls__button"
            onClick={() => setPlaying(!playback.playing)}
            onWheel={wheelFrame}
            title={playback.playing ? "Pause" : "Play"}
          >
            {playback.playing ? gifPauseIcon : gifPlayIcon}
          </button>
          <button
            type="button"
            className="gif-playback-controls__button"
            onClick={() => commitFrame(frameIndex + 1)}
            onWheel={wheelFrame}
            title="Next frame"
          >
            {nextFrame}
          </button>
          <button
            type="button"
            className="gif-playback-controls__button gif-playback-controls__button--frames"
            ref={framesButtonRef}
            onClick={() => {
              if (liveAppState.openPopup !== "gifFrameGallery") {
                setGifGalleryScrollLeft(
                  Math.max(
                    frameIndex * GIF_FRAME_GALLERY_ITEM_PITCH -
                      galleryViewportWidth / 2,
                    0,
                  ),
                );
              }
              setAppState({
                openPopup:
                  liveAppState.openPopup === "gifFrameGallery"
                    ? null
                    : "gifFrameGallery",
              });
            }}
            onWheel={wheelFrame}
            title="Frames"
          >
            {frames}
          </button>
        </div>
        {liveAppState.openPopup === "gifFrameGallery" && (
          <div
            className="gif-frame-gallery"
            style={{
              ...(gifPopupPosition ?? { left, top: galleryTop }),
              width: galleryViewportWidth,
            }}
            ref={(node) => {
              frameGalleryRef.current = node;
              if (node && node.scrollLeft !== clampedGifGalleryScrollLeft) {
                node.scrollLeft = clampedGifGalleryScrollLeft;
              }
            }}
            onScroll={(event) => {
              setGifGalleryScrollLeft(event.currentTarget.scrollLeft);
            }}
            onWheelCapture={(event) => {
              event.preventDefault();
              event.stopPropagation();
              event.currentTarget.scrollLeft += event.deltaY;
              setGifGalleryScrollLeft(event.currentTarget.scrollLeft);
            }}
          >
            <div
              className="gif-frame-gallery__spacer"
              style={{ width: galleryScrollWidth }}
            >
              {visibleFrames.map((frame, offset) => {
                const index = firstVisibleFrameIndex + offset;
                return (
                  <button
                    type="button"
                    key={index}
                    className={clsx("gif-frame-gallery__frame", {
                      "gif-frame-gallery__frame--selected":
                        index === frameIndex,
                    })}
                    style={{
                      left: index * GIF_FRAME_GALLERY_ITEM_PITCH,
                    }}
                    onClick={() => commitFrame(index)}
                    title={`Frame ${index + 1}`}
                  >
                    <canvas
                      width={frame.width}
                      height={frame.height}
                      ref={(node) => {
                        node?.getContext("2d")?.drawImage(frame, 0, 0);
                      }}
                    />
                    <span>{index + 1}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {deferredGifBadges}
      {selectedElementControls()}
    </>
  );
};
