import { KEYS } from "@excalidraw/common";

import { CaptureUpdateAction } from "@excalidraw/excalidraw";

import { arrowsToEyeIcon } from "../components/icons";
import { getSelectedElements } from "../scene";
import { ToolButton } from "../components/ToolButton";

import { t } from "../i18n";

import { register } from "./register";

export const actionSmartZoom = register({
  name: "smartZoom",
  label: "toolBar.smartZoom",
  trackEvent: { category: "toolbar" },
  icon: arrowsToEyeIcon,
  viewMode: true,
  perform: (elements, appState, _, app) => {
    const settings = {
      fitToViewport: true,
      animate: true,
      duration: 200,
      viewportZoomFactor: 0.8,
    };
    const selectedElements = getSelectedElements(elements, appState);
    if (selectedElements.length < 1) {
      // Zoom app state to all elements
      app.scrollToContent(elements, settings);
    } else {
      // Zoom app state to all selected ele,ents
      app.scrollToContent(selectedElements, settings);
    }

    return {
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
  keyTest: (event) =>
    !event[KEYS.CTRL_OR_CMD] &&
    !event.shiftKey &&
    !event.altKey &&
    event.key.toLocaleLowerCase() === KEYS.F,
  PanelComponent: ({ data, updateData }) => (
    <ToolButton
      type="button"
      icon={arrowsToEyeIcon}
      aria-label={t("labels.smartZoom")}
      onClick={() => updateData(null)}
      size={data?.size || "medium"}
      data-testid="button-smart-zoom"
      keyBindingLabel={KEYS.F.toLocaleUpperCase()}
    />
  ),
});
