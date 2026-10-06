import { t } from "../i18n";

import {
  useApp,
  useAppProps,
  useEditorInterface,
  useExcalidrawActionManager,
  useExcalidrawAppState,
  useExcalidrawSetAppState,
  useStylesPanelMode,
} from "./App";
import { LockButton } from "./LockButton";
import { PenModeButton } from "./PenModeButton";
import {
  ExtraToolsDropdown,
  ObjectsSnapModeButton,
  StrokeEyeDropperButton,
} from "./Toolbar";
import {
  TOOLS,
  createToolButton,
  SelectionToolButton,
  LassoToolButton,
  SelectionToolPopover,
  FreedrawToolPopover,
} from "./Tools";
import { Tooltip } from "./Tooltip";

import type { ToolbarToolType } from "./Tools";

export type ExcalidrawToolbarItemName =
  | ToolbarToolType
  | "selectionMenu"
  | "freedrawMenu"
  | "moreTools"
  | "objectsSnapMode"
  | "strokeEyedropper"
  | "penMode"
  | "lock"
  | "undo"
  | "redo";

// Create component types once so editor updates preserve button focus and state.
const toolButtons = {
  ...Object.fromEntries(
    (Object.keys(TOOLS) as ToolbarToolType[]).map((tool) => [
      tool,
      createToolButton(tool),
    ]),
  ),
  selection: SelectionToolButton,
  lasso: LassoToolButton,
} as Record<ToolbarToolType, ReturnType<typeof createToolButton>>;

/**
 * A native editor control without an island or layout wrapper. Render inside an
 * Excalidraw UI render callback (for example uiLayout.customItems[].render).
 * The host owns ordering, separators, placement, and hiding replaced built-ins.
 */
export const ExcalidrawToolbarItem = ({
  item,
  hideShortcut,
}: {
  item: ExcalidrawToolbarItemName;
  hideShortcut?: boolean;
}) => {
  const app = useApp();
  const appProps = useAppProps();
  const appState = useExcalidrawAppState();
  const setAppState = useExcalidrawSetAppState();
  const actionManager = useExcalidrawActionManager();
  const editorInterface = useEditorInterface();
  const stylesPanelMode = useStylesPanelMode();

  if (
    appState.viewModeEnabled ||
    appState.openDialog?.name === "elementLinkSelector"
  ) {
    return null;
  }

  const toolProps = {
    app,
    activeTool: appState.activeTool,
    hideShortcut: hideShortcut ?? editorInterface.formFactor === "phone",
  };

  switch (item) {
    case "undo":
    case "redo":
      return (
        <Tooltip label={t(`buttons.${item}`)}>
          {actionManager.renderAction(item)}
        </Tooltip>
      );
    case "selection":
      return stylesPanelMode === "compact" ? (
        <SelectionToolPopover {...toolProps} setAppState={setAppState} />
      ) : appState.preferredSelectionTool.type === "lasso" ? (
        <LassoToolButton {...toolProps} />
      ) : (
        <SelectionToolButton {...toolProps} />
      );
    case "selectionMenu":
      return <SelectionToolPopover {...toolProps} setAppState={setAppState} />;
    case "freedrawMenu":
      return <FreedrawToolPopover {...toolProps} />;
    case "moreTools":
      return (
        <ExtraToolsDropdown
          app={app}
          activeTool={appState.activeTool}
          setAppState={setAppState}
          UIOptions={appProps.UIOptions}
          isMyocSimplifiedMode={appState.myocSimplifiedMode}
          actionManager={actionManager}
        />
      );
    case "objectsSnapMode":
      return <ObjectsSnapModeButton app={app} actionManager={actionManager} />;
    case "strokeEyedropper":
      return <StrokeEyeDropperButton app={app} />;
    case "penMode":
      return (
        <PenModeButton
          checked={appState.penMode}
          onChange={() => app.togglePenMode(null)}
          title={t("toolBar.penMode")}
          penDetected={appState.penDetected}
        />
      );
    case "lock":
      return (
        <LockButton
          checked={appState.activeTool.locked}
          onChange={() => app.toggleLock()}
          title={t("toolBar.lock")}
          disabled={appProps.activeTool != null}
        />
      );
    case "image":
      if (appProps.UIOptions.tools?.image === false) {
        return null;
      }
  }

  const ToolButton = toolButtons[item];
  return <ToolButton {...toolProps} />;
};
