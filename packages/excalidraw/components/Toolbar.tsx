import clsx from "clsx";
import { useState } from "react";

import { KEYS } from "@excalidraw/common";

import { actionToggleObjectsSnapMode } from "../actions";
import { getShortcutFromShortcutName } from "../actions/shortcuts";
import { t } from "../i18n";

import { useEditorInterface, useStylesPanelMode } from "./App";
import { HintViewer } from "./HintViewer";
import { Island } from "./Island";
import { LockButton } from "./LockButton";
import { PenModeButton } from "./PenModeButton";
import Stack from "./Stack";
import DropdownMenu from "./dropdownMenu/DropdownMenu";
import { IconButton } from "./IconButton";
import {
  drawShapeToolIcon,
  EmbedIcon,
  frameToolIcon,
  LassoIcon,
  laserPointerToolIcon,
  bucketFillIcon,
  DotsIcon,
  eyeDropperIcon,
  LockedIcon,
  magnetIcon,
  UnlockedIcon,
} from "./icons";
import {
  ArrowToolButton,
  DiamondToolButton,
  EllipseToolButton,
  EraserToolButton,
  FreedrawToolPopover,
  FreedrawToolButton,
  getToolShortcut,
  HandToolButton,
  ImageToolButton,
  isToolButtonDisabled,
  LassoToolButton,
  LineToolButton,
  MYOC_SIMPLIFIED_EXTRA_TOOL_TYPES,
  RectangleToolButton,
  SelectionToolButton,
  SelectionToolPopover,
  TextToolButton,
  TOOLS,
} from "./Tools";

import type {
  AppClassProperties,
  AppProps,
  AppState,
  UIAppState,
} from "../types";
import type { ActionManager } from "../actions/manager";
import type { ToolbarToolType } from "./Tools";

const isToolHiddenByOptions = (
  type: ToolbarToolType,
  UIOptions: AppProps["UIOptions"],
) => type === "image" && UIOptions.tools?.image === false;

const ExtraToolsDropdownItem = ({
  app,
  activeTool,
  type,
  shortcut,
}: {
  app: AppClassProperties;
  activeTool: UIAppState["activeTool"];
  type: ToolbarToolType;
  shortcut?: string;
}) => (
  <DropdownMenu.Item
    onSelect={() => app.setActiveTool({ type })}
    icon={TOOLS[type].icon as React.ReactElement}
    data-testid={`toolbar-${type}`}
    selected={activeTool.type === type}
    shortcut={shortcut ?? getToolShortcut(type)}
    disabled={isToolButtonDisabled(app, type)}
  >
    {t(`toolBar.${type}`)}
  </DropdownMenu.Item>
);

const LockActiveToolDropdownItem = ({ app }: { app: AppClassProperties }) => (
  <DropdownMenu.Item
    onSelect={() => app.toggleLock()}
    icon={app.state.activeTool.locked ? LockedIcon : UnlockedIcon}
    data-testid="toolbar-lock"
    selected={app.state.activeTool.locked}
    shortcut={KEYS.Q.toLocaleUpperCase()}
  >
    {t("toolBar.lock-short")}
  </DropdownMenu.Item>
);

const ObjectsSnapModeDropdownItem = ({
  actionManager,
  app,
}: {
  actionManager: ActionManager;
  app: AppClassProperties;
}) => {
  if (!actionManager.isActionEnabled(actionToggleObjectsSnapMode)) {
    return null;
  }

  const shortcut = getShortcutFromShortcutName("objectsSnapMode");

  return (
    <DropdownMenu.Item
      onSelect={() =>
        actionManager.executeAction(actionToggleObjectsSnapMode, "ui")
      }
      icon={magnetIcon}
      data-testid="toolbar-objects-snap-mode"
      selected={app.state.objectsSnapModeEnabled}
      shortcut={shortcut}
    >
      {t("buttons.objectsSnapMode")}
    </DropdownMenu.Item>
  );
};

const ObjectsSnapModeButton = ({
  actionManager,
  app,
}: {
  actionManager: ActionManager;
  app: AppClassProperties;
}) => {
  if (!actionManager.isActionEnabled(actionToggleObjectsSnapMode)) {
    return null;
  }

  const label = t("buttons.objectsSnapMode");
  const shortcut = getShortcutFromShortcutName("objectsSnapMode");

  return (
    <IconButton
      type="toggle"
      icon={magnetIcon}
      checked={app.state.objectsSnapModeEnabled}
      title={`${label} - ${shortcut}`}
      aria-label={label}
      aria-keyshortcuts={shortcut}
      data-testid="toolbar-objects-snap-mode"
      onSelect={() =>
        actionManager.executeAction(actionToggleObjectsSnapMode, "ui")
      }
    />
  );
};

const StrokeEyeDropperButton = ({ app }: { app: AppClassProperties }) => (
  <IconButton
    type="button"
    icon={eyeDropperIcon}
    title={`${t("labels.eyeDropper")} - ${KEYS.I.toLocaleUpperCase()}`}
    aria-label={t("labels.eyeDropper")}
    aria-keyshortcuts={KEYS.I.toLocaleUpperCase()}
    keyBindingLabel={KEYS.I.toLocaleUpperCase()}
    data-testid="toolbar-eyedropper"
    onClick={() =>
      app.openEyeDropper({ type: "stroke", swapPreviewOnAlt: false })
    }
  />
);

const ExtraToolsDropdown = ({
  app,
  activeTool,
  setAppState,
  UIOptions,
  isMyocSimplifiedMode,
  actionManager,
}: {
  app: AppClassProperties;
  activeTool: UIAppState["activeTool"];
  setAppState: React.Component<any, AppState>["setState"];
  UIOptions: AppProps["UIOptions"];
  isMyocSimplifiedMode: boolean;
  actionManager: ActionManager;
}) => {
  const [isExtraToolsMenuOpen, setIsExtraToolsMenuOpen] = useState(false);
  const isFullStylesPanel = useStylesPanelMode() === "full";
  const frameToolSelected = activeTool.type === "frame";
  const drawShapeToolSelected = activeTool.type === "autoshape";
  const laserToolSelected = activeTool.type === "laser";
  const bucketFillToolSelected = activeTool.type === "bucketfill";
  const lassoToolSelected =
    isFullStylesPanel &&
    activeTool.type === "lasso" &&
    app.state.preferredSelectionTool.type !== "lasso";
  const embeddableToolSelected = activeTool.type === "embeddable";
  const myocSimplifiedToolSelected =
    isMyocSimplifiedMode &&
    MYOC_SIMPLIFIED_EXTRA_TOOL_TYPES.includes(
      activeTool.type as typeof MYOC_SIMPLIFIED_EXTRA_TOOL_TYPES[number],
    );

  return (
    <DropdownMenu open={isExtraToolsMenuOpen}>
      <DropdownMenu.Trigger
        className={clsx("App-toolbar__extra-tools-trigger", {
          "App-toolbar__extra-tools-trigger--selected":
            myocSimplifiedToolSelected ||
            frameToolSelected ||
            embeddableToolSelected ||
            (!isMyocSimplifiedMode &&
              isFullStylesPanel &&
              drawShapeToolSelected) ||
            lassoToolSelected ||
            bucketFillToolSelected ||
            // in collab we're already highlighting the laser button
            // outside toolbar, so let's not highlight extra-tools button
            // on top of it
            (laserToolSelected && !app.props.isCollaborating),
        })}
        onToggle={() => {
          setIsExtraToolsMenuOpen(!isExtraToolsMenuOpen);
          setAppState({ openMenu: null, openPopup: null });
        }}
        title={t("toolBar.extraTools")}
      >
        {myocSimplifiedToolSelected
          ? TOOLS[activeTool.type as ToolbarToolType].icon
          : frameToolSelected
          ? frameToolIcon
          : embeddableToolSelected
          ? EmbedIcon
          : !isMyocSimplifiedMode && isFullStylesPanel && drawShapeToolSelected
          ? drawShapeToolIcon
          : laserToolSelected && !app.props.isCollaborating
          ? laserPointerToolIcon
          : lassoToolSelected
          ? LassoIcon
          : bucketFillToolSelected
          ? bucketFillIcon
          : DotsIcon}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content
        onClickOutside={() => setIsExtraToolsMenuOpen(false)}
        onSelect={() => setIsExtraToolsMenuOpen(false)}
        className="App-toolbar__extra-tools-dropdown"
      >
        {isMyocSimplifiedMode ? (
          <>
            {isFullStylesPanel && (
              <DropdownMenu.Item
                onSelect={() => app.setActiveTool({ type: "lasso" })}
                icon={LassoIcon}
                data-testid="toolbar-lasso"
                selected={lassoToolSelected}
                disabled={isToolButtonDisabled(app, "lasso")}
              >
                {t("toolBar.lasso")}
              </DropdownMenu.Item>
            )}
            {MYOC_SIMPLIFIED_EXTRA_TOOL_TYPES.filter(
              (type) => !isToolHiddenByOptions(type, UIOptions),
            ).map((type) => (
              <ExtraToolsDropdownItem
                key={type}
                app={app}
                activeTool={activeTool}
                type={type}
              />
            ))}
            {app.props.activeTool == null && (
              <>
                <div className="App-toolbar__dropdown-divider" />
                <LockActiveToolDropdownItem app={app} />
              </>
            )}
          </>
        ) : (
          <>
            <DropdownMenu.Item
              onSelect={() => app.setActiveTool({ type: "frame" })}
              icon={frameToolIcon}
              shortcut={KEYS.F.toLocaleUpperCase()}
              data-testid="toolbar-frame"
              selected={frameToolSelected}
              disabled={isToolButtonDisabled(app, "frame")}
            >
              {t("toolBar.frame")}
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={() => app.setActiveTool({ type: "embeddable" })}
              icon={EmbedIcon}
              data-testid="toolbar-embeddable"
              selected={embeddableToolSelected}
              disabled={isToolButtonDisabled(app, "embeddable")}
            >
              {t("toolBar.embeddable")}
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={() => app.setActiveTool({ type: "autoshape" })}
              icon={drawShapeToolIcon}
              shortcut={getToolShortcut("autoshape")}
              data-testid="toolbar-autoshape"
              selected={drawShapeToolSelected}
              disabled={isToolButtonDisabled(app, "autoshape")}
            >
              {t("toolBar.autoshape")}
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={() => app.setActiveTool({ type: "laser" })}
              icon={laserPointerToolIcon}
              data-testid="toolbar-laser"
              selected={laserToolSelected}
              shortcut={KEYS.K.toLocaleUpperCase()}
              disabled={isToolButtonDisabled(app, "laser")}
            >
              {t("toolBar.laser")}
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={() => app.setActiveTool({ type: "bucketfill" })}
              icon={bucketFillIcon}
              data-testid="toolbar-bucketfill"
              selected={bucketFillToolSelected}
              disabled={isToolButtonDisabled(app, "bucketfill")}
            >
              {t("toolBar.bucketfill")}
            </DropdownMenu.Item>
            {isFullStylesPanel && (
              <DropdownMenu.Item
                onSelect={() => app.setActiveTool({ type: "lasso" })}
                icon={LassoIcon}
                data-testid="toolbar-lasso"
                selected={lassoToolSelected}
                disabled={isToolButtonDisabled(app, "lasso")}
              >
                {t("toolBar.lasso")}
              </DropdownMenu.Item>
            )}
            <div className="App-toolbar__dropdown-divider" />
            <ObjectsSnapModeDropdownItem
              actionManager={actionManager}
              app={app}
            />
            {app.props.activeTool == null && (
              <LockActiveToolDropdownItem app={app} />
            )}
          </>
        )}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
};

/** the main (desktop/tablet) toolbar island */
export const Toolbar = ({
  app,
  appState,
  setAppState,
  UIOptions,
  actionManager,
  onPenModeToggle,
  onLockToggle,
  heading,
}: {
  app: AppClassProperties;
  appState: UIAppState;
  setAppState: React.Component<any, AppState>["setState"];
  UIOptions: AppProps["UIOptions"];
  actionManager: ActionManager;
  onPenModeToggle: AppClassProperties["togglePenMode"];
  onLockToggle: () => void;
  heading: React.ReactNode;
}) => {
  const editorInterface = useEditorInterface();
  const isCompactStylesPanel = useStylesPanelMode() === "compact";

  const activeTool = appState.activeTool;
  const toolProps = { app, activeTool };
  const isMyocSimplifiedMode = appState.myocSimplifiedMode;

  const selectionTool = isCompactStylesPanel ? (
    <SelectionToolPopover {...toolProps} setAppState={setAppState} />
  ) : appState.preferredSelectionTool.type === "lasso" ? (
    <LassoToolButton {...toolProps} />
  ) : (
    <SelectionToolButton {...toolProps} />
  );

  return (
    <Island
      padding={1}
      className={clsx("App-toolbar", {
        "zen-mode": appState.zenModeEnabled,
        "App-toolbar--compact": isCompactStylesPanel,
      })}
      data-viewport-ui="top"
    >
      <HintViewer
        appState={appState}
        isMobile={editorInterface.formFactor === "phone"}
        editorInterface={editorInterface}
        app={app}
      />
      {heading}
      <Stack.Row gap={isCompactStylesPanel ? 0.5 : 1}>
        {/* in compact UI the pen mode button is rendered as a separate
            floating button below the compact actions menu */}
        {!isCompactStylesPanel && (
          <PenModeButton
            checked={appState.penMode}
            onChange={() => onPenModeToggle(null)}
            title={t("toolBar.penMode")}
            penDetected={appState.penDetected}
          />
        )}
        {app.props.activeTool == null && !isMyocSimplifiedMode && (
          <>
            <LockButton
              checked={appState.activeTool.locked}
              onChange={onLockToggle}
              title={t("toolBar.lock")}
              // the active tool — including its lock state — is host-controlled
              disabled={app.props.activeTool != null}
            />

            <div className="App-toolbar__divider" />
          </>
        )}

        <HandToolButton {...toolProps} />
        {selectionTool}
        {isMyocSimplifiedMode ? (
          <>
            <FreedrawToolButton {...toolProps} />
            <TextToolButton {...toolProps} />
            <StrokeEyeDropperButton app={app} />
            {UIOptions.tools?.image !== false && (
              <ImageToolButton {...toolProps} />
            )}
            <EraserToolButton {...toolProps} />
          </>
        ) : (
          <>
            <RectangleToolButton {...toolProps} />
            <DiamondToolButton {...toolProps} />
            <EllipseToolButton {...toolProps} />
            <ArrowToolButton {...toolProps} />
            <LineToolButton {...toolProps} />
            {isCompactStylesPanel ? (
              <FreedrawToolPopover {...toolProps} />
            ) : (
              <FreedrawToolButton {...toolProps} />
            )}
            <TextToolButton {...toolProps} />
            {UIOptions.tools?.image !== false && (
              <ImageToolButton {...toolProps} />
            )}
            <EraserToolButton {...toolProps} />
          </>
        )}

        <div className="App-toolbar__divider" />

        <ExtraToolsDropdown
          app={app}
          activeTool={activeTool}
          setAppState={setAppState}
          UIOptions={UIOptions}
          isMyocSimplifiedMode={isMyocSimplifiedMode}
          actionManager={actionManager}
        />
        {isMyocSimplifiedMode && (
          <>
            <div className="App-toolbar__divider" />
            <ObjectsSnapModeButton actionManager={actionManager} app={app} />
          </>
        )}
      </Stack.Row>
    </Island>
  );
};
