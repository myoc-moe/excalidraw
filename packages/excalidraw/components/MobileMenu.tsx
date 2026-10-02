import React from "react";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { useTunnels } from "../context/tunnels";
import { t } from "../i18n";
import { getScrollToContentState } from "../scene";

import { MobileShapeActions } from "./Actions";
import { MobileToolbar } from "./MobileToolbar";

import { Island } from "./Island";

import { PenModeButton } from "./PenModeButton";
import { ViewportStatusBadge } from "./ViewportStatusFrame/ViewportStatusFrame";
import {
  UIRegionLayout,
  getUIFormFactorLayout,
  type UIRegionLayoutItem,
} from "./UIRegionLayout";

import type { ActionManager } from "../actions/manager";
import type {
  AppClassProperties,
  AppState,
  ExcalidrawProps,
  UIAppState,
} from "../types";
import type { JSX } from "react";

const MOBILE_TOOLBAR_MAX_WIDTH = 450;

type MobileMenuProps = {
  appState: UIAppState;
  actionManager: ActionManager;
  renderJSONExportDialog: () => React.ReactNode;
  renderImageExportDialog: () => React.ReactNode;
  setAppState: React.Component<any, AppState>["setState"];
  elements: readonly NonDeletedExcalidrawElement[];
  onPenModeToggle: AppClassProperties["togglePenMode"];

  renderTopRightUI?: (
    isMobile: boolean,
    appState: UIAppState,
  ) => JSX.Element | null;
  renderTopLeftUI?: (
    isMobile: boolean,
    appState: UIAppState,
  ) => JSX.Element | null;
  renderSidebars: () => JSX.Element | null;
  renderWelcomeScreen: boolean;
  defaultUIEnabled: boolean;
  scrollBackToContentUIEnabled: boolean;
  app: AppClassProperties;
  uiLayout?: ExcalidrawProps["uiLayout"];
};

export const MobileMenu = ({
  appState,
  elements,
  actionManager,
  setAppState,
  renderTopLeftUI,
  renderTopRightUI,
  renderSidebars,
  renderWelcomeScreen,
  defaultUIEnabled,
  scrollBackToContentUIEnabled,
  app,
  onPenModeToggle,
  uiLayout,
}: MobileMenuProps) => {
  const {
    WelcomeScreenCenterTunnel,
    MainMenuTunnel,
    DefaultSidebarTriggerTunnel,
  } = useTunnels();
  const shouldRenderScrollBackToContent =
    scrollBackToContentUIEnabled && appState.scrolledOutside;
  const shouldRenderMobileCanvasActions = defaultUIEnabled;
  const shouldRenderDefaultBottomBar =
    defaultUIEnabled &&
    (!appState.viewModeEnabled || shouldRenderMobileCanvasActions);
  const scrollBackToContentButton =
    shouldRenderScrollBackToContent &&
    !appState.openMenu &&
    !appState.openSidebar ? (
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
    ) : null;

  const viewportStatusLabel = app.props.viewportStatusFrame?.label;
  const viewportStatusBadge = viewportStatusLabel ? (
    <ViewportStatusBadge
      label={viewportStatusLabel}
      border={app.props.viewportStatusFrame?.border}
    />
  ) : null;

  const editorInterface = app.editorInterface;
  const formFactorLayout = getUIFormFactorLayout(uiLayout, editorInterface);
  const topRightHostUI = renderTopRightUI?.(true, appState);
  const hasTopRightHostUI =
    topRightHostUI !== null && topRightHostUI !== undefined;
  const hasUndoOverride = formFactorLayout?.items?.undo !== undefined;
  const hasRedoOverride = formFactorLayout?.items?.redo !== undefined;
  const isElementLinkDialog =
    appState.openDialog?.name === "elementLinkSelector";

  const layoutItems: UIRegionLayoutItem[] = [
    {
      id: "hostTopLeftUI" as const,
      defaultRegion: "topLeft" as const,
      defaultOrder: -10,
      content: !isElementLinkDialog && renderTopLeftUI?.(true, appState),
    },
    {
      id: "mainMenu" as const,
      defaultRegion: "topLeft" as const,
      content: !isElementLinkDialog ? <MainMenuTunnel.Out /> : null,
    },
    {
      id: "hostTopRightUI" as const,
      defaultRegion: "topRight" as const,
      defaultOrder: -10,
      content: !isElementLinkDialog ? topRightHostUI : null,
    },
    {
      id: "penMode" as const,
      defaultRegion: "topRight" as const,
      content:
        !isElementLinkDialog &&
        !hasTopRightHostUI &&
        !appState.viewModeEnabled &&
        defaultUIEnabled ? (
          <PenModeButton
            checked={appState.penMode}
            onChange={() => onPenModeToggle(null)}
            title={t("toolBar.penMode")}
            isMobile
            penDetected={appState.penDetected}
          />
        ) : null,
    },
    {
      id: "sidebarTrigger" as const,
      defaultRegion: "topRight" as const,
      content:
        !isElementLinkDialog &&
        !hasTopRightHostUI &&
        !appState.viewModeEnabled ? (
          <DefaultSidebarTriggerTunnel.Out />
        ) : null,
    },
    {
      id: "viewMode" as const,
      defaultRegion: "bottomLeft" as const,
      defaultOrder: 0,
      islandGroup: {
        id: "mobileCanvasActions",
        className: "mobile-canvas-actions",
        padding: 0,
        gap: 6,
      },
      content:
        shouldRenderMobileCanvasActions && !appState.viewModeOnly ? (
          <div className="view-mode-button">
            {actionManager.renderAction("viewMode")}
          </div>
        ) : null,
    },
    {
      id: "smartZoom" as const,
      defaultRegion: "bottomLeft" as const,
      defaultOrder: 1,
      islandGroup: {
        id: "mobileCanvasActions",
        className: "mobile-canvas-actions",
        padding: 0,
        gap: 6,
      },
      content: shouldRenderMobileCanvasActions ? (
        <div className="smart-zoom-button">
          {actionManager.renderAction("smartZoom")}
        </div>
      ) : null,
    },
    {
      id: "stylesPanel" as const,
      defaultRegion: "bottomLeft" as const,
      defaultOrder: 2,
      content:
        defaultUIEnabled && !appState.viewModeEnabled ? (
          <MobileShapeActions
            appState={appState}
            elementsMap={app.scene.getNonDeletedElementsMap()}
            renderAction={actionManager.renderAction}
            app={app}
            setAppState={setAppState}
            showUndo={!hasUndoOverride}
            showRedo={!hasRedoOverride}
          />
        ) : null,
    },
    {
      id: "undo" as const,
      defaultRegion: "bottomLeft" as const,
      content:
        hasUndoOverride &&
        formFactorLayout?.items?.undo?.visible !== false &&
        defaultUIEnabled &&
        !appState.viewModeEnabled ? (
          <div className="undo-button-container">
            {actionManager.renderAction("undo")}
          </div>
        ) : null,
    },
    {
      id: "redo" as const,
      defaultRegion: "bottomLeft" as const,
      content:
        hasRedoOverride &&
        formFactorLayout?.items?.redo?.visible !== false &&
        defaultUIEnabled &&
        !appState.viewModeEnabled ? (
          <div className="redo-button-container">
            {actionManager.renderAction("redo")}
          </div>
        ) : null,
    },
    {
      id: "toolbar" as const,
      defaultRegion: "bottomLeft" as const,
      defaultOrder: 10,
      content:
        defaultUIEnabled &&
        !appState.viewModeEnabled &&
        !isElementLinkDialog ? (
          <Island
            className="App-toolbar"
            padding={1}
            style={{
              justifyContent: "flex-start",
              maxWidth: MOBILE_TOOLBAR_MAX_WIDTH,
              width: "fit-content",
            }}
          >
            <MobileToolbar
              app={app}
              actionManager={actionManager}
              setAppState={setAppState}
            />
          </Island>
        ) : null,
    },
  ];

  return (
    <>
      {renderSidebars()}
      {/* welcome screen, bottom bar, and top bar all have the same z-index */}
      {/* ordered in this reverse order so that top bar is on top */}
      <div className="App-welcome-screen">
        {renderWelcomeScreen && <WelcomeScreenCenterTunnel.Out />}
      </div>

      {(shouldRenderDefaultBottomBar ||
        formFactorLayout !== undefined ||
        renderTopLeftUI ||
        renderTopRightUI) && (
        <UIRegionLayout
          items={layoutItems}
          layout={formFactorLayout}
          app={app}
          appState={appState}
          editorInterface={editorInterface}
          className="ui-layout--mobile"
          legacyBottomLeft={
            shouldRenderDefaultBottomBar && scrollBackToContentButton ? (
              <div className="floating-status-stack">
                {scrollBackToContentButton}
              </div>
            ) : null
          }
        />
      )}

      {!shouldRenderDefaultBottomBar && scrollBackToContentButton && (
        <div className="floating-status-stack">{scrollBackToContentButton}</div>
      )}

      {viewportStatusBadge && (
        <div className="viewport-status-frame__badge-row">
          {viewportStatusBadge}
        </div>
      )}
    </>
  );
};
