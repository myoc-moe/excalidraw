import { useState, useEffect } from "react";
import clsx from "clsx";

import { KEYS, capitalizeString } from "@excalidraw/common";

import { actionToggleObjectsSnapMode } from "../actions";
import { getShortcutFromShortcutName } from "../actions/shortcuts";
import { t } from "../i18n";

import DropdownMenu from "./dropdownMenu/DropdownMenu";
import { IconButton } from "./IconButton";
import { ToolPopover } from "./ToolPopover";
import {
  EraserToolButton,
  FrameToolButton,
  FreedrawToolButton,
  FreedrawToolPopover,
  getToolLetter,
  getToolShortcut,
  HandToolButton,
  ImageToolButton,
  isToolButtonDisabled,
  MYOC_SIMPLIFIED_EXTRA_TOOL_TYPES,
  SelectionToolPopover,
  TextToolButton,
  TOOLS,
} from "./Tools";

import {
  TextIcon,
  ImageIcon,
  DotsIcon,
  frameToolIcon,
  EmbedIcon,
  laserPointerToolIcon,
  drawShapeToolIcon,
  bucketFillIcon,
  LockedIcon,
  magnetIcon,
  UnlockedIcon,
  eyeDropperIcon,
} from "./icons";

import "./ToolIcon.scss";
import "./MobileToolbar.scss";

import type { ActionManager } from "../actions/manager";
import type { AppClassProperties, UIAppState } from "../types";
import type { ToolbarToolType } from "./Tools";

type MobileToolbarProps = {
  app: AppClassProperties;
  actionManager: ActionManager;
  setAppState: React.Component<any, UIAppState>["setState"];
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

export const MobileToolbar = ({
  app,
  actionManager,
  setAppState,
}: MobileToolbarProps) => {
  const activeTool = app.state.activeTool;
  const isMyocSimplifiedMode = app.state.myocSimplifiedMode;
  const imageToolEnabled = app.props.UIOptions.tools?.image !== false;
  const [isOtherShapesMenuOpen, setIsOtherShapesMenuOpen] = useState(false);
  const [lastActiveGenericShape, setLastActiveGenericShape] = useState<
    "rectangle" | "diamond" | "ellipse"
  >("rectangle");
  const [lastActiveLinearElement, setLastActiveLinearElement] = useState<
    "arrow" | "line"
  >("arrow");

  // keep lastActiveGenericShape in sync with active tool if user switches via other UI
  useEffect(() => {
    if (
      activeTool.type === "rectangle" ||
      activeTool.type === "diamond" ||
      activeTool.type === "ellipse"
    ) {
      setLastActiveGenericShape(activeTool.type);
    }
  }, [activeTool.type]);

  // keep lastActiveLinearElement in sync with active tool if user switches via other UI
  useEffect(() => {
    if (activeTool.type === "arrow" || activeTool.type === "line") {
      setLastActiveLinearElement(activeTool.type);
    }
  }, [activeTool.type]);

  const frameToolSelected = activeTool.type === "frame";
  const drawShapeToolSelected = activeTool.type === "autoshape";
  const laserToolSelected = activeTool.type === "laser";
  const embeddableToolSelected = activeTool.type === "embeddable";
  const bucketFillToolSelected = activeTool.type === "bucketfill";

  const SHAPE_TOOLS = (["rectangle", "diamond", "ellipse"] as const).map(
    (type) => ({
      type,
      icon: TOOLS[type].icon,
      title: capitalizeString(t(`toolBar.${type}`)),
      fillable: TOOLS[type].fillable,
    }),
  );

  const LINEAR_ELEMENT_TOOLS = (["arrow", "line"] as const).map((type) => ({
    type,
    icon: TOOLS[type].icon,
    title: capitalizeString(t(`toolBar.${type}`)),
    fillable: TOOLS[type].fillable,
  }));

  const [toolbarWidth, setToolbarWidth] = useState(0);

  const WIDTH = 36;
  const GAP = 4;

  // hand, selection, freedraw, eraser, rectangle, arrow, others
  const MIN_TOOLS = 7;
  const MIN_WIDTH = MIN_TOOLS * WIDTH + (MIN_TOOLS - 1) * GAP;
  const ADDITIONAL_WIDTH = WIDTH + GAP;

  const showTextToolOutside = toolbarWidth >= MIN_WIDTH + 1 * ADDITIONAL_WIDTH;
  const showImageToolOutside =
    imageToolEnabled && toolbarWidth >= MIN_WIDTH + 2 * ADDITIONAL_WIDTH;
  const showFrameToolOutside = toolbarWidth >= MIN_WIDTH + 3 * ADDITIONAL_WIDTH;

  const extraTools: readonly typeof activeTool.type[] = (
    isMyocSimplifiedMode
      ? (["text", "image"] as const)
      : ([
          "text",
          "image",
          "frame",
          "embeddable",
          "laser",
          "bucketfill",
        ] as const)
  ).filter((tool) => {
    if (showTextToolOutside && tool === "text") {
      return false;
    }
    if ((!imageToolEnabled || showImageToolOutside) && tool === "image") {
      return false;
    }
    if (showFrameToolOutside && tool === "frame") {
      return false;
    }
    return true;
  });
  const myocSimplifiedToolSelected =
    isMyocSimplifiedMode &&
    MYOC_SIMPLIFIED_EXTRA_TOOL_TYPES.includes(
      activeTool.type as typeof MYOC_SIMPLIFIED_EXTRA_TOOL_TYPES[number],
    );
  const extraToolSelected =
    myocSimplifiedToolSelected || extraTools.includes(activeTool.type);
  const extraIcon = extraToolSelected
    ? myocSimplifiedToolSelected
      ? TOOLS[activeTool.type as ToolbarToolType].icon
      : activeTool.type === "text"
      ? TextIcon
      : activeTool.type === "image"
      ? ImageIcon
      : activeTool.type === "frame"
      ? frameToolIcon
      : activeTool.type === "embeddable"
      ? EmbedIcon
      : activeTool.type === "laser"
      ? laserPointerToolIcon
      : activeTool.type === "bucketfill"
      ? bucketFillIcon
      : DotsIcon
    : DotsIcon;

  const toolProps = { app, activeTool };

  return (
    <div
      className="mobile-toolbar"
      ref={(div) => {
        if (div) {
          setToolbarWidth(div.getBoundingClientRect().width);
        }
      }}
    >
      {/* Hand Tool */}
      <HandToolButton {...toolProps} />

      {/* Selection Tool */}
      <SelectionToolPopover {...toolProps} setAppState={setAppState} />

      {/* Free Draw */}
      {isMyocSimplifiedMode ? (
        <FreedrawToolButton {...toolProps} />
      ) : (
        <FreedrawToolPopover {...toolProps} />
      )}

      {/* Eraser */}
      <EraserToolButton {...toolProps} />

      {/* Rectangle/Diamond/Ellipse */}
      {!isMyocSimplifiedMode && (
        <ToolPopover
          app={app}
          options={SHAPE_TOOLS}
          activeTool={activeTool}
          defaultOption={lastActiveGenericShape}
          data-testid="toolbar-rectangle"
          onToolChange={(type: string) => {
            if (
              type === "rectangle" ||
              type === "diamond" ||
              type === "ellipse"
            ) {
              setLastActiveGenericShape(type);
              app.setActiveTool({ type });
            }
          }}
          displayedOption={
            SHAPE_TOOLS.find((tool) => tool.type === lastActiveGenericShape) ||
            SHAPE_TOOLS[0]
          }
        />
      )}

      {/* Arrow/Line */}
      {!isMyocSimplifiedMode && (
        <ToolPopover
          app={app}
          options={LINEAR_ELEMENT_TOOLS}
          activeTool={activeTool}
          defaultOption={lastActiveLinearElement}
          data-testid="toolbar-arrow"
          onToolChange={(type: string) => {
            if (type === "arrow" || type === "line") {
              setLastActiveLinearElement(type);
              app.setActiveTool({ type });
            }
          }}
          displayedOption={
            LINEAR_ELEMENT_TOOLS.find(
              (tool) => tool.type === lastActiveLinearElement,
            ) || LINEAR_ELEMENT_TOOLS[0]
          }
        />
      )}

      {/* Text Tool */}
      {showTextToolOutside && <TextToolButton {...toolProps} />}

      {isMyocSimplifiedMode && showImageToolOutside && (
        <StrokeEyeDropperButton app={app} />
      )}

      {/* Image */}
      {showImageToolOutside && <ImageToolButton {...toolProps} />}

      {/* Frame Tool */}
      {!isMyocSimplifiedMode && showFrameToolOutside && (
        <FrameToolButton {...toolProps} hideShortcut />
      )}

      {/* Other Shapes */}
      <DropdownMenu open={isOtherShapesMenuOpen}>
        <DropdownMenu.Trigger
          className={clsx(
            "App-toolbar__extra-tools-trigger App-toolbar__extra-tools-trigger--mobile",
            {
              "App-toolbar__extra-tools-trigger--selected":
                extraToolSelected || isOtherShapesMenuOpen,
            },
          )}
          onToggle={() => {
            setIsOtherShapesMenuOpen(!isOtherShapesMenuOpen);
            setAppState({ openMenu: null, openPopup: null });
          }}
          title={t("toolBar.extraTools")}
          style={{
            width: WIDTH,
            height: WIDTH,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {extraIcon}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content
          onClickOutside={() => setIsOtherShapesMenuOpen(false)}
          onSelect={() => setIsOtherShapesMenuOpen(false)}
          className="App-toolbar__extra-tools-dropdown"
          align="start"
        >
          {isMyocSimplifiedMode &&
            MYOC_SIMPLIFIED_EXTRA_TOOL_TYPES.map((type) => (
              <DropdownMenu.Item
                key={type}
                onSelect={() => app.setActiveTool({ type })}
                icon={TOOLS[type].icon as React.ReactElement}
                data-testid={`toolbar-${type}`}
                selected={activeTool.type === type}
                shortcut={getToolLetter(type)}
                disabled={isToolButtonDisabled(app, type)}
              >
                {t(`toolBar.${type}`)}
              </DropdownMenu.Item>
            ))}
          {!isMyocSimplifiedMode && (
            <div className="App-toolbar__dropdown-divider" />
          )}
          {!isMyocSimplifiedMode &&
            actionManager.isActionEnabled(actionToggleObjectsSnapMode) && (
              <DropdownMenu.Item
                onSelect={() =>
                  actionManager.executeAction(actionToggleObjectsSnapMode, "ui")
                }
                icon={magnetIcon}
                data-testid="toolbar-objects-snap-mode"
                selected={app.state.objectsSnapModeEnabled}
                shortcut={getShortcutFromShortcutName("objectsSnapMode")}
              >
                {t("buttons.objectsSnapMode")}
              </DropdownMenu.Item>
            )}
          {app.props.activeTool == null && (
            <>
              {isMyocSimplifiedMode && (
                <div className="App-toolbar__dropdown-divider" />
              )}
              <DropdownMenu.Item
                onSelect={() => app.toggleLock()}
                icon={app.state.activeTool.locked ? LockedIcon : UnlockedIcon}
                data-testid="toolbar-lock"
                selected={app.state.activeTool.locked}
                shortcut={KEYS.Q.toLocaleUpperCase()}
              >
                {t("toolBar.lock-short")}
              </DropdownMenu.Item>
            </>
          )}
          {!showTextToolOutside && (
            <DropdownMenu.Item
              onSelect={() => app.setActiveTool({ type: "text" })}
              icon={TextIcon}
              shortcut={KEYS.T.toLocaleUpperCase()}
              data-testid="toolbar-text"
              selected={activeTool.type === "text"}
              disabled={isToolButtonDisabled(app, "text")}
            >
              {t("toolBar.text")}
            </DropdownMenu.Item>
          )}

          {imageToolEnabled && !showImageToolOutside && (
            <DropdownMenu.Item
              onSelect={() => app.setActiveTool({ type: "image" })}
              icon={ImageIcon}
              data-testid="toolbar-image"
              selected={activeTool.type === "image"}
              disabled={isToolButtonDisabled(app, "image")}
            >
              {t("toolBar.image")}
            </DropdownMenu.Item>
          )}
          {!isMyocSimplifiedMode && !showFrameToolOutside && (
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
          )}
          {!isMyocSimplifiedMode && (
            <>
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
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu>
      {isMyocSimplifiedMode && (
        <>
          <div className="App-toolbar__divider" />
          <ObjectsSnapModeButton actionManager={actionManager} app={app} />
        </>
      )}
    </div>
  );
};
