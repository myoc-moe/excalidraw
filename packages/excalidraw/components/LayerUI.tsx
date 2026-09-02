import clsx from "clsx";
import React from "react";

import {
  CLASSES,
  MIME_TYPES,
  TOOL_TYPE,
  arrayToMap,
  isShallowEqual,
  sceneCoordsToViewportCoords,
} from "@excalidraw/common";

import {
  getCommonBounds,
  isInitializedImageElement,
  mutateElement,
  ShapeCache,
} from "@excalidraw/element";

import { showSelectedShapeActions } from "@excalidraw/element";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";
import type { ExcalidrawImageElement } from "@excalidraw/element/types";

import { actionToggleStats } from "../actions";
import { TunnelsContext, useInitializeTunnels } from "../context/tunnels";
import { UIAppStateContext } from "../context/ui-appState";
import { useAtom } from "../editor-jotai";

import { t } from "../i18n";
import { getScrollToContentState } from "../scene";

import { SelectedShapeActions, CompactShapeActions } from "./Actions";
import { LoadingMessage } from "./LoadingMessage";
import { MobileMenu } from "./MobileMenu";
import { PasteChartDialog } from "./PasteChartDialog";
import { Section } from "./Section";
import Stack from "./Stack";
import { UserList } from "./UserList";
import { PenModeButton } from "./PenModeButton";
import Footer from "./footer/Footer";
import MainMenu from "./main-menu/MainMenu";
import {
  useAppProps,
  useEditorInterface,
  useExcalidrawAppState,
  useStylesPanelMode,
} from "./App";
import { OverwriteConfirmDialog } from "./OverwriteConfirm/OverwriteConfirm";
import { Stats } from "./Stats";
import ElementLinkDialog from "./ElementLinkDialog";
import { ErrorDialog } from "./ErrorDialog";
import { EyeDropper, activeEyeDropperAtom } from "./EyeDropper";
import { FixedSideContainer } from "./FixedSideContainer";
import { HelpDialog } from "./HelpDialog";
import { ImageExportDialog } from "./ImageExportDialog";
import { Island } from "./Island";
import { DefaultSidebar } from "./DefaultSidebar";
import { JSONExportDialog } from "./JSONExportDialog";
import { LaserPointerButton } from "./LaserPointerButton";
import { Toast } from "./Toast";
import { Toolbar } from "./Toolbar";
import {
  ViewportStatusBadge,
  ViewportStatusBorder,
} from "./ViewportStatusFrame/ViewportStatusFrame";

import "./LayerUI.scss";
import "./Toolbar.scss";

import type { ActionManager } from "../actions/manager";

import type { Language } from "../i18n";
import type {
  AppProps,
  AppState,
  ExcalidrawProps,
  BinaryFiles,
  UIAppState,
  AppClassProperties,
} from "../types";

interface LayerUIProps {
  actionManager: ActionManager;
  appState: UIAppState;
  files: BinaryFiles;
  canvas: HTMLCanvasElement;
  setAppState: React.Component<any, AppState>["setState"];
  elements: readonly NonDeletedExcalidrawElement[];
  onLockToggle: () => void;
  onPenModeToggle: AppClassProperties["togglePenMode"];
  showExitZenModeBtn: boolean;
  langCode: Language["code"];
  renderTopLeftUI?: ExcalidrawProps["renderTopLeftUI"];
  renderTopRightUI?: ExcalidrawProps["renderTopRightUI"];
  renderCustomStats?: ExcalidrawProps["renderCustomStats"];
  UIOptions: AppProps["UIOptions"];
  onExportImage: AppClassProperties["onExportImage"];
  renderWelcomeScreen: boolean;
  children?: React.ReactNode;
  app: AppClassProperties;
  defaultUIEnabled: boolean;
  zoomUIEnabled: boolean;
  scrollBackToContentUIEnabled: boolean;
  isCollaborating: boolean;
  generateLinkForSelection?: AppProps["generateLinkForSelection"];
  currentUserControls?: ExcalidrawProps["currentUserControls"];
}

const DefaultMainMenu: React.FC<{
  UIOptions: AppProps["UIOptions"];
}> = ({ UIOptions }) => {
  return (
    <MainMenu __fallback>
      <MainMenu.DefaultItems.LoadScene />
      <MainMenu.DefaultItems.SaveToActiveFile />
      {/* FIXME we should to test for this inside the item itself */}
      {UIOptions.canvasActions.export && <MainMenu.DefaultItems.Export />}
      {/* FIXME we should to test for this inside the item itself */}
      {UIOptions.canvasActions.saveAsImage && (
        <MainMenu.DefaultItems.SaveAsImage />
      )}
      <MainMenu.DefaultItems.SearchMenu />
      <MainMenu.DefaultItems.Help />
      <MainMenu.Separator />
      <MainMenu.Group title="Excalidraw links">
        <MainMenu.DefaultItems.Socials />
      </MainMenu.Group>
      <MainMenu.Separator />
      <MainMenu.DefaultItems.ToggleTheme allowSystemTheme={false} />
      <MainMenu.DefaultItems.ChangeCanvasBackground />
    </MainMenu>
  );
};

const DefaultOverwriteConfirmDialog = () => {
  return (
    <OverwriteConfirmDialog __fallback>
      <OverwriteConfirmDialog.Actions.SaveToDisk />
      <OverwriteConfirmDialog.Actions.ExportToImage />
    </OverwriteConfirmDialog>
  );
};

const gifPreviousFrameIcon = (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M7 5v14" />
    <path d="M19 6l-9 6l9 6z" />
  </svg>
);

const gifNextFrameIcon = (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M17 5v14" />
    <path d="M5 6l9 6l-9 6z" />
  </svg>
);

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

const gifFramesIcon = (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M4 7a2 2 0 0 1 2 -2h9a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-9a2 2 0 0 1 -2 -2z" />
    <path d="M8 15l2.5 -3l2 2l1.5 -1.5l3 3.5" />
    <path d="M19 7v10" />
    <path d="M21 8v8" />
  </svg>
);

const GIF_FRAME_GALLERY_ITEM_WIDTH = 76;
const GIF_FRAME_GALLERY_ITEM_GAP = 4;
const GIF_FRAME_GALLERY_ITEM_PITCH =
  GIF_FRAME_GALLERY_ITEM_WIDTH + GIF_FRAME_GALLERY_ITEM_GAP;
const GIF_FRAME_GALLERY_OVERSCAN = 8;

const LayerUI = ({
  actionManager,
  appState,
  files,
  setAppState,
  elements,
  canvas,
  onLockToggle,
  onPenModeToggle,
  showExitZenModeBtn,
  renderTopLeftUI,
  renderTopRightUI,
  renderCustomStats,
  UIOptions,
  onExportImage,
  renderWelcomeScreen,
  children,
  app,
  defaultUIEnabled,
  zoomUIEnabled,
  scrollBackToContentUIEnabled,
  isCollaborating,
  generateLinkForSelection,
  currentUserControls,
}: LayerUIProps) => {
  const liveAppState = useExcalidrawAppState();
  const editorInterface = useEditorInterface();
  const appProps = useAppProps();
  const stylesPanelMode = useStylesPanelMode();
  const isCompactStylesPanel = stylesPanelMode === "compact";
  const tunnels = useInitializeTunnels();
  const [, rerenderGifControls] = React.useReducer(
    (version: number) => version + 1,
    0,
  );
  const [gifGalleryScrollLeft, setGifGalleryScrollLeft] = React.useState(0);

  const spacing = isCompactStylesPanel
    ? {
        menuTopGap: 4,
        toolbarColGap: 4,
        toolbarRowGap: 1,
        toolbarInnerRowGap: 0.5,
        islandPadding: 1,
        collabMarginLeft: 8,
      }
    : {
        menuTopGap: 6,
        toolbarColGap: 4,
        toolbarRowGap: 1,
        toolbarInnerRowGap: 1,
        islandPadding: 1,
        collabMarginLeft: 8,
      };

  const TunnelsJotaiProvider = tunnels.tunnelsJotai.Provider;

  const [eyeDropperState, setEyeDropperState] = useAtom(activeEyeDropperAtom);

  const renderJSONExportDialog = () => {
    if (!UIOptions.canvasActions.export) {
      return null;
    }

    return (
      <JSONExportDialog
        elements={elements}
        appState={appState}
        files={files}
        actionManager={actionManager}
        exportOpts={UIOptions.canvasActions.export}
        canvas={canvas}
        setAppState={setAppState}
      />
    );
  };

  const renderImageExportDialog = () => {
    if (
      !UIOptions.canvasActions.saveAsImage ||
      appState.openDialog?.name !== "imageExport"
    ) {
      return null;
    }

    return (
      <ImageExportDialog
        elements={elements}
        appState={appState}
        files={files}
        actionManager={actionManager}
        onExportImage={onExportImage}
        onCloseRequest={() => setAppState({ openDialog: null })}
        name={app.getName()}
      />
    );
  };

  const renderCanvasActions = () => (
    <div style={{ position: "relative" }}>
      <div className="excalidraw-ui-top-left">
        {renderTopLeftUI?.(false, appState)}
        <tunnels.MainMenuTunnel.Out />
        <tunnels.DefaultSidebarTriggerTunnel.Out />
      </div>
      {renderWelcomeScreen && <tunnels.WelcomeScreenMenuHintTunnel.Out />}
    </div>
  );

  const renderSelectedShapeActions = () => {
    return (
      <Section
        heading="selectedShapeActions"
        className={clsx("selected-shape-actions zen-mode-transition", {
          "transition-left": appState.zenModeEnabled,
        })}
      >
        {isCompactStylesPanel ? (
          <Island
            className={clsx("compact-shape-actions-island")}
            padding={0}
            data-viewport-ui="side"
            data-viewport-ui-name="stylesPanel"
            style={{
              // we want to make sure this doesn't overflow so subtracting the
              // approximate height of hamburgerMenu + footer
              maxHeight: `${appState.height - 166}px`,
            }}
          >
            <CompactShapeActions
              appState={appState}
              elementsMap={app.scene.getNonDeletedElementsMap()}
              renderAction={actionManager.renderAction}
              app={app}
              setAppState={setAppState}
            />
          </Island>
        ) : (
          <Island
            className={CLASSES.SHAPE_ACTIONS_MENU}
            padding={2}
            style={{
              // we want to make sure this doesn't overflow so subtracting the
              // approximate height of hamburgerMenu + footer
              maxHeight: `${appState.height - 166}px`,
            }}
            data-viewport-ui="side"
            data-viewport-ui-name="stylesPanel"
          >
            <SelectedShapeActions
              appState={appState}
              elementsMap={app.scene.getNonDeletedElementsMap()}
              renderAction={actionManager.renderAction}
              app={app}
            />
          </Island>
        )}
      </Section>
    );
  };

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

  const renderGifPlaybackControls = () => {
    const selectedElements = app.scene.getSelectedElements(liveAppState);
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
    const frameCount = gif?.frames.length ?? 0;
    if (!gif || frameCount < 2) {
      return null;
    }

    const playback = selectedElement.gifPlayback ?? {
      frameIndex: 0,
      speed: 1,
      playing: false,
    };
    const runtimeFrameIndex = playback.playing
      ? gif.runtimeFrameIndex
      : playback.frameIndex;
    const frameIndex = Math.min(Math.max(runtimeFrameIndex, 0), frameCount - 1);
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
    const galleryTop = Math.min(liveAppState.height - 120, top + 48);
    const speedPickerTop = Math.max(12, top - 52);

    const commitFrame = (nextFrameIndex: number) => {
      const normalizedFrameIndex = (nextFrameIndex + frameCount) % frameCount;
      gif.runtimeFrameIndex = normalizedFrameIndex;
      gif.lastFrameTime = performance.now();
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
      gif.runtimeFrameIndex = frameIndex;
      gif.lastFrameTime = performance.now();
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
      Math.max(liveAppState.width * 0.9, 1),
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
          <div className="gif-speed-picker" style={{ top: speedPickerTop }}>
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
            {gifPreviousFrameIcon}
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
            {gifNextFrameIcon}
          </button>
          <button
            type="button"
            className="gif-playback-controls__button"
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
            {gifFramesIcon}
          </button>
        </div>
        {liveAppState.openPopup === "gifFrameGallery" && (
          <div
            className="gif-frame-gallery"
            style={{ top: galleryTop, width: galleryViewportWidth }}
            ref={(node) => {
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

  const renderFixedSideContainer = () => {
    const shouldRenderSelectedShapeActions =
      defaultUIEnabled && showSelectedShapeActions(appState, elements);

    const shouldShowStats =
      defaultUIEnabled &&
      appState.stats.open &&
      !appState.zenModeEnabled &&
      !appState.viewModeEnabled &&
      appState.openDialog?.name !== "elementLinkSelector";

    return (
      <FixedSideContainer side="top">
        <div className="App-menu App-menu_top">
          <Stack.Col
            gap={spacing.menuTopGap}
            className={clsx("App-menu_top__left")}
          >
            {renderCanvasActions()}
            {defaultUIEnabled && (
              <div
                className={clsx("selected-shape-actions-container", {
                  "selected-shape-actions-container--compact":
                    isCompactStylesPanel,
                })}
              >
                {shouldRenderSelectedShapeActions &&
                  renderSelectedShapeActions()}
              </div>
            )}
            {/* in compact UI the pen mode button lives outside the toolbar, as
                a separate floating button below the compact actions menu
                (same as we render it on mobile); shown alongside the compact
                actions island, i.e. when a drawing tool or elements are
                selected */}
            {defaultUIEnabled &&
              isCompactStylesPanel &&
              !appState.viewModeEnabled &&
              shouldRenderSelectedShapeActions && (
                <PenModeButton
                  checked={appState.penMode}
                  onChange={() => onPenModeToggle(null)}
                  title={t("toolBar.penMode")}
                  isMobile
                  penDetected={appState.penDetected}
                />
              )}
          </Stack.Col>
          {defaultUIEnabled &&
            !appState.viewModeEnabled &&
            appState.openDialog?.name !== "elementLinkSelector" && (
              <Section heading="shapes" className="shapes-section">
                {(heading: React.ReactNode) => (
                  <div style={{ position: "relative" }}>
                    {renderWelcomeScreen && (
                      <tunnels.WelcomeScreenToolbarHintTunnel.Out />
                    )}
                    <Stack.Col gap={spacing.toolbarColGap} align="start">
                      <Stack.Row
                        gap={spacing.toolbarRowGap}
                        className={clsx("App-toolbar-container", {
                          "zen-mode": appState.zenModeEnabled,
                        })}
                      >
                        <Toolbar
                          app={app}
                          appState={appState}
                          setAppState={setAppState}
                          UIOptions={UIOptions}
                          actionManager={actionManager}
                          onPenModeToggle={onPenModeToggle}
                          onLockToggle={onLockToggle}
                          heading={heading}
                        />
                        {isCollaborating && (
                          <Island
                            style={{
                              marginLeft: spacing.collabMarginLeft,
                              alignSelf: "center",
                              height: "fit-content",
                            }}
                          >
                            <LaserPointerButton
                              title={t("toolBar.laser")}
                              checked={
                                appState.activeTool.type === TOOL_TYPE.laser
                              }
                              onChange={() =>
                                app.setActiveTool({ type: TOOL_TYPE.laser })
                              }
                              isMobile
                            />
                          </Island>
                        )}
                      </Stack.Row>
                    </Stack.Col>
                  </div>
                )}
              </Section>
            )}
          <div
            className={clsx(
              "layer-ui__wrapper__top-right zen-mode-transition",
              {
                "transition-right": appState.zenModeEnabled,
                "layer-ui__wrapper__top-right--compact": isCompactStylesPanel,
              },
            )}
          >
            {defaultUIEnabled && appState.collaborators.size > 0 && (
              <UserList
                collaborators={appState.collaborators}
                userToFollow={appProps.userToFollow?.socketId || null}
                currentUserControls={currentUserControls}
              />
            )}
            {renderTopRightUI?.(
              editorInterface.formFactor === "phone",
              appState,
            )}
            {shouldShowStats && (
              <Stats
                app={app}
                onClose={() => {
                  actionManager.executeAction(actionToggleStats);
                }}
                renderCustomStats={renderCustomStats}
              />
            )}
          </div>
        </div>
      </FixedSideContainer>
    );
  };

  const renderSidebars = () => <DefaultSidebar />;
  const isSidebarDockedAndFits = false;

  const layerUIJSX = (
    <>
      {/* ------------------------- tunneled UI ---------------------------- */}
      {/* make sure we render host app components first so that we can detect
          them first on initial render to optimize layout shift */}
      {children}
      {/* Fallback entry points are the default UI. Host components above keep
          rendering into the outlets below even when defaults are disabled. */}
      {defaultUIEnabled && (
        <>
          <DefaultMainMenu UIOptions={UIOptions} />
        </>
      )}
      {/* Keep supporting surfaces available to host-supplied UI, including
          MainMenu.DefaultItems. */}
      <DefaultOverwriteConfirmDialog />
      {/* ------------------------------------------------------------------ */}

      {defaultUIEnabled && appState.isLoading && <LoadingMessage delay={250} />}
      {defaultUIEnabled && appState.errorMessage && (
        <ErrorDialog onClose={() => setAppState({ errorMessage: null })}>
          {appState.errorMessage}
        </ErrorDialog>
      )}
      {defaultUIEnabled &&
        eyeDropperState &&
        editorInterface.formFactor !== "phone" && (
          <EyeDropper
            colorPickerType={eyeDropperState.colorPickerType}
            onCancel={() => {
              setEyeDropperState(null);
            }}
            onChange={(
              colorPickerType,
              color,
              selectedElements,
              { altKey },
            ) => {
              if (
                colorPickerType !== "elementBackground" &&
                colorPickerType !== "elementStroke"
              ) {
                return;
              }

              if (selectedElements.length) {
                for (const element of selectedElements) {
                  mutateElement(element, arrayToMap(elements), {
                    [altKey && eyeDropperState.swapPreviewOnAlt
                      ? colorPickerType === "elementBackground"
                        ? "strokeColor"
                        : "backgroundColor"
                      : colorPickerType === "elementBackground"
                      ? "backgroundColor"
                      : "strokeColor"]: color,
                  });
                  ShapeCache.delete(element);
                }
                app.scene.triggerUpdate();
              } else if (colorPickerType === "elementBackground") {
                setAppState({
                  currentItemBackgroundColor: color,
                });
              } else {
                setAppState({ currentItemStrokeColor: color });
              }
            }}
            onSelect={(color, event) => {
              setEyeDropperState((state) => {
                return state?.keepOpenOnAlt && event.altKey ? state : null;
              });
              eyeDropperState?.onSelect?.(color, event);
            }}
          />
        )}
      {appState.openDialog?.name === "help" && (
        <HelpDialog
          onClose={() => {
            setAppState({ openDialog: null });
          }}
        />
      )}
      {defaultUIEnabled && appState.openDialog?.name === "elementLinkSelector" && (
        <ElementLinkDialog
          sourceElementId={appState.openDialog.sourceElementId}
          onClose={() => {
            setAppState({
              openDialog: null,
            });
          }}
          scene={app.scene}
          appState={appState}
          generateLinkForSelection={generateLinkForSelection}
        />
      )}
      <tunnels.OverwriteConfirmDialogTunnel.Out />
      {renderImageExportDialog()}
      {renderJSONExportDialog()}
      {defaultUIEnabled && appState.openDialog?.name === "charts" && (
        <PasteChartDialog
          data={appState.openDialog.data}
          rawText={appState.openDialog.rawText}
          onClose={() =>
            setAppState({
              openDialog: null,
            })
          }
        />
      )}
      {defaultUIEnabled && renderGifPlaybackControls()}
      {editorInterface.formFactor === "phone" && (
        <MobileMenu
          app={app}
          appState={appState}
          elements={elements}
          actionManager={actionManager}
          renderJSONExportDialog={renderJSONExportDialog}
          renderImageExportDialog={renderImageExportDialog}
          setAppState={setAppState}
          onPenModeToggle={onPenModeToggle}
          renderTopLeftUI={renderTopLeftUI}
          renderTopRightUI={renderTopRightUI}
          renderSidebars={renderSidebars}
          renderWelcomeScreen={renderWelcomeScreen}
          defaultUIEnabled={defaultUIEnabled}
          scrollBackToContentUIEnabled={scrollBackToContentUIEnabled}
        />
      )}
      {editorInterface.formFactor !== "phone" && (
        <>
          {appProps.viewportStatusFrame?.border && (
            <ViewportStatusBorder
              border={appProps.viewportStatusFrame.border}
              style={
                isSidebarDockedAndFits
                  ? {
                      // flush against the sidebar's own visible edge, not
                      // just the --right-sidebar-width column it reserves
                      // (which includes the sidebar's own outer margin)
                      right: `calc(var(--right-sidebar-width) - var(--space-factor) * 2)`,
                    }
                  : undefined
              }
            />
          )}
          <div
            className="layer-ui__wrapper"
            style={
              isSidebarDockedAndFits
                ? { width: `calc(100% - var(--right-sidebar-width))` }
                : {}
            }
          >
            {renderWelcomeScreen && <tunnels.WelcomeScreenCenterTunnel.Out />}
            {renderFixedSideContainer()}
            <Footer
              appState={appState}
              actionManager={actionManager}
              showExitZenModeBtn={showExitZenModeBtn}
              renderWelcomeScreen={renderWelcomeScreen}
              defaultUIEnabled={defaultUIEnabled}
              zoomUIEnabled={zoomUIEnabled}
            />
            {(appState.toast ||
              (scrollBackToContentUIEnabled && appState.scrolledOutside) ||
              appProps.viewportStatusFrame?.label) && (
              <div className="floating-status-stack">
                {appState.toast && (
                  <Toast
                    message={appState.toast.message}
                    onClose={() => setAppState({ toast: null })}
                    duration={appState.toast.duration}
                    closable={appState.toast.closable}
                  />
                )}
                {!appState.toast &&
                  scrollBackToContentUIEnabled &&
                  appState.scrolledOutside && (
                    <button
                      type="button"
                      className="scroll-back-to-content"
                      onClick={() => {
                        setAppState((appState) => ({
                          ...getScrollToContentState(elements, appState),
                        }));
                      }}
                    >
                      {t("buttons.scrollBackToContent")}
                    </button>
                  )}
                {appProps.viewportStatusFrame?.label && (
                  <ViewportStatusBadge
                    label={appProps.viewportStatusFrame.label}
                    border={appProps.viewportStatusFrame.border}
                  />
                )}
              </div>
            )}
          </div>
        </>
      )}
      {renderSidebars()}
    </>
  );

  return (
    <UIAppStateContext.Provider value={appState}>
      <TunnelsJotaiProvider>
        <TunnelsContext.Provider value={tunnels}>
          {layerUIJSX}
        </TunnelsContext.Provider>
      </TunnelsJotaiProvider>
    </UIAppStateContext.Provider>
  );
};

const stripIrrelevantAppStateProps = (appState: AppState): UIAppState => {
  const {
    cursorButton,
    scrollX,
    scrollY,
    zoom,
    shouldCacheIgnoreZoom,
    snapLines,
    originSnapOffset,
    suggestedBinding,
    frameToHighlight,
    elementsToHighlight,
    ...ret
  } = appState;
  return ret;
};

const areEqual = (prevProps: LayerUIProps, nextProps: LayerUIProps) => {
  // short-circuit early
  if (prevProps.children !== nextProps.children) {
    return false;
  }

  const { canvas: _pC, appState: prevAppState, ...prev } = prevProps;
  const { canvas: _nC, appState: nextAppState, ...next } = nextProps;

  return (
    isShallowEqual(
      // asserting AppState because we're being passed the whole AppState
      // but resolve to only the UI-relevant props
      stripIrrelevantAppStateProps(prevAppState as AppState),
      stripIrrelevantAppStateProps(nextAppState as AppState),
      {
        selectedElementIds: isShallowEqual,
        selectedGroupIds: isShallowEqual,
      },
    ) && isShallowEqual(prev, next)
  );
};

export default React.memo(LayerUI, areEqual);
