import { useState } from "react";
import clsx from "clsx";

import { KEYS, capitalizeString } from "@excalidraw/common";

import { SHAPES } from "@excalidraw/element/shapes";

import { trackEvent } from "../analytics";

import { t } from "../i18n";

import { isHandToolActive } from "../appState";

import { HandButton } from "./HandButton";
import { ToolButton } from "./ToolButton";
import DropdownMenu from "./dropdownMenu/DropdownMenu";
import { ToolPopover } from "./ToolPopover";

import {
  SelectionIcon,
  FreedrawIcon,
  EraserIcon,
  extraToolsIcon,
  TextIcon,
  ImageIcon,
  frameToolIcon,
  EmbedIcon,
  laserPointerToolIcon,
  LassoIcon,
  MagicIcon,
  LockedIcon,
  UnlockedIcon,
} from "./icons";

import "./ToolIcon.scss";
import "./MobileToolBar.scss";

import type { AppClassProperties, ToolType, UIAppState } from "../types";

const SELECTION_TOOLS = [
  {
    type: "selection",
    icon: SelectionIcon,
    title: capitalizeString(t("toolBar.selection")),
  },
  {
    type: "lasso",
    icon: LassoIcon,
    title: capitalizeString(t("toolBar.lasso")),
  },
] as const;

type MobileToolBarProps = {
  app: AppClassProperties;
  onHandToolToggle: () => void;
  setAppState: React.Component<any, UIAppState>["setState"];
};

export const MobileToolBar = ({
  app,
  onHandToolToggle,
  setAppState,
}: MobileToolBarProps) => {
  const activeTool = app.state.activeTool;
  const [isOtherShapesMenuOpen, setIsOtherShapesMenuOpen] = useState(false);

  const handleToolChange = (toolType: string, pointerType?: string) => {
    if (app.state.activeTool.type !== toolType) {
      trackEvent("toolbar", toolType, "ui");
    }

    if (toolType === "selection") {
      if (app.state.activeTool.type === "selection") {
        // Toggle selection tool behavior if needed
      } else {
        app.setActiveTool({ type: "selection" });
      }
    } else {
      app.setActiveTool({ type: toolType as ToolType });
    }
  };

  const [toolbarWidth, setToolbarWidth] = useState(0);

  const WIDTH = 36;
  const GAP = 4;

  // hand, selection, freedraw, eraser, rectangle, arrow, others
  const MIN_TOOLS = 7;
  const MIN_WIDTH = MIN_TOOLS * WIDTH + (MIN_TOOLS - 1) * GAP;
  const ADDITIONAL_WIDTH = WIDTH + GAP;

  const showTextToolOutside = toolbarWidth >= MIN_WIDTH + 1 * ADDITIONAL_WIDTH;
  const showImageToolOutside = toolbarWidth >= MIN_WIDTH + 2 * ADDITIONAL_WIDTH;
  const showFrameToolOutside = toolbarWidth >= MIN_WIDTH + 3 * ADDITIONAL_WIDTH;

  const simplifiedShapeTools = SHAPES.filter(
    (s) => s.myocSimplifiedMode === false,
  );

  const extraTools = [
    "text",
    "frame",
    "embeddable",
    "laser",
    "magicframe",
  ].filter((tool) => {
    if (showTextToolOutside && tool === "text") {
      return false;
    }
    if (showImageToolOutside && tool === "image") {
      return false;
    }
    if (showFrameToolOutside && tool === "frame") {
      return false;
    }
    return true;
  });
  const extraToolSelected = extraTools.includes(activeTool.type);
  const extraIcon = extraToolSelected
    ? activeTool.type === "text"
      ? TextIcon
      : activeTool.type === "image"
      ? ImageIcon
      : activeTool.type === "frame"
      ? frameToolIcon
      : activeTool.type === "embeddable"
      ? EmbedIcon
      : activeTool.type === "laser"
      ? laserPointerToolIcon
      : activeTool.type === "magicframe"
      ? MagicIcon
      : extraToolsIcon
    : extraToolsIcon;

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
      <HandButton
        checked={isHandToolActive(app.state)}
        onChange={onHandToolToggle}
        title={t("toolBar.hand")}
        isMobile
      />

      {/* Selection Tool */}
      <ToolPopover
        app={app}
        options={SELECTION_TOOLS}
        activeTool={activeTool}
        defaultOption={app.state.preferredSelectionTool.type}
        namePrefix="selectionType"
        title={capitalizeString(t("toolBar.selection"))}
        data-testid="toolbar-selection"
        onToolChange={(type: string) => {
          if (type === "selection" || type === "lasso") {
            app.setActiveTool({ type });
            setAppState({
              preferredSelectionTool: { type, initialized: true },
            });
          }
        }}
        displayedOption={
          SELECTION_TOOLS.find(
            (tool) => tool.type === app.state.preferredSelectionTool.type,
          ) || SELECTION_TOOLS[0]
        }
      />

      {/* Free Draw */}
      <ToolButton
        className={clsx({
          active: activeTool.type === "freedraw",
        })}
        type="radio"
        icon={FreedrawIcon}
        checked={activeTool.type === "freedraw"}
        name="editor-current-shape"
        title={`${capitalizeString(t("toolBar.freedraw"))}`}
        aria-label={capitalizeString(t("toolBar.freedraw"))}
        data-testid="toolbar-freedraw"
        onChange={() => handleToolChange("freedraw")}
      />

      {/* Text Tool */}
      {showTextToolOutside && (
        <ToolButton
          className={clsx({
            active: activeTool.type === "text",
          })}
          type="radio"
          icon={TextIcon}
          checked={activeTool.type === "text"}
          name="editor-current-shape"
          title={`${capitalizeString(t("toolBar.text"))}`}
          aria-label={capitalizeString(t("toolBar.text"))}
          data-testid="toolbar-text"
          onChange={() => handleToolChange("text")}
        />
      )}

      {/* Image */}
      {showImageToolOutside && (
        <ToolButton
          className={clsx({
            active: activeTool.type === "image",
          })}
          type="radio"
          icon={ImageIcon}
          checked={activeTool.type === "image"}
          name="editor-current-shape"
          title={`${capitalizeString(t("toolBar.image"))}`}
          aria-label={capitalizeString(t("toolBar.image"))}
          data-testid="toolbar-image"
          onChange={() => handleToolChange("image")}
        />
      )}
      {/* Eraser */}
      <ToolButton
        className={clsx({
          active: activeTool.type === "eraser",
        })}
        type="radio"
        icon={EraserIcon}
        checked={activeTool.type === "eraser"}
        name="editor-current-shape"
        title={`${capitalizeString(t("toolBar.eraser"))}`}
        aria-label={capitalizeString(t("toolBar.eraser"))}
        data-testid="toolbar-eraser"
        onChange={() => handleToolChange("eraser")}
      />

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
          {/* <DropdownMenu.Item
                      onSelect={() => app.setActiveTool({ type: "frame" })}
                      icon={frameToolIcon}
                      shortcut={KEYS.F.toLocaleUpperCase()}
                      data-testid="toolbar-frame"
                      selected={frameToolSelected}
                    >
                      {t("toolBar.frame")}
                    </DropdownMenu.Item> */}
          {/* <DropdownMenu.Item
            onSelect={() => app.setActiveTool({ type: "lasso" })}
            icon={LassoIcon}
            data-testid="toolbar-lasso"
            selected={lassoToolSelected}
          >
            {t("toolBar.lasso")}
          </DropdownMenu.Item> */}
          {simplifiedShapeTools.map(({ value, icon, key, fillable }) => {
            const label = t(`toolBar.${value}`);
            const letter =
              key && capitalizeString(typeof key === "string" ? key : key[0]);

            return (
              <DropdownMenu.Item
                key={value}
                onSelect={() => app.setActiveTool({ type: value })}
                icon={icon}
                data-testid={`toolbar-${value}`}
                selected={activeTool.type === value}
                shortcut={letter ?? undefined}
              >
                {capitalizeString(label)}
              </DropdownMenu.Item>
            );
          })}
          <div className="App-toolbar__dropdown-divider" />
          <DropdownMenu.Item
            onSelect={() => app.toggleLock()}
            icon={app.state.activeTool.locked ? LockedIcon : UnlockedIcon}
            data-testid={`toolbar-lock`}
            selected={app.state.activeTool.locked}
            shortcut={KEYS.Q}
          >
            {capitalizeString(t("toolBar.lock-short"))}
          </DropdownMenu.Item>
          {!showTextToolOutside && (
            <DropdownMenu.Item
              onSelect={() => app.setActiveTool({ type: "text" })}
              icon={TextIcon}
              shortcut={KEYS.T.toLocaleUpperCase()}
              data-testid="toolbar-text"
              selected={activeTool.type === "text"}
            >
              {t("toolBar.text")}
            </DropdownMenu.Item>
          )}

          {!showImageToolOutside && (
            <DropdownMenu.Item
              onSelect={() => app.setActiveTool({ type: "image" })}
              icon={ImageIcon}
              data-testid="toolbar-image"
              selected={activeTool.type === "image"}
            >
              {t("toolBar.image")}
            </DropdownMenu.Item>
          )}
        </DropdownMenu.Content>
      </DropdownMenu>
    </div>
  );
};
