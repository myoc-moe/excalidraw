import { KEYS } from "@excalidraw/common";

import { eyeIcon } from "../components/icons";
import { getSelectedElements, isSomeElementSelected } from "../scene";
import { CaptureUpdateAction } from "../store";
import { ToolButton } from "../components/ToolButton";

import { getNonDeletedElements } from "..";
import { t } from "../i18n";

import { register } from "./register";

export const actionSmartZoom = register({
  name: "smartZoom",
  label: "toolBar.smartZoom",
  trackEvent: { category: "toolbar" },
  icon: eyeIcon,
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
  PanelComponent: ({ elements, appState, updateData }) => (
    <ToolButton
      type="button"
      icon={eyeIcon}
      aria-label={t("labels.smartZoom")}
      onClick={() => updateData(null)}
      size={data?.size || "medium"}
      data-testid="button-smart-zoom"
      keyBindingLabel={KEYS.F.toLocaleUpperCase()}
    />
  ),
});
