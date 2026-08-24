import { KEYS } from "@excalidraw/common";

import { CaptureUpdateAction } from "@excalidraw/element/store";

import { arrowsToEyeIcon } from "../components/icons";
import { getSelectedElements } from "../scene";
import { IconButton } from "../components/IconButton";
import { getEffectiveEditorPreferences } from "../editorPreferences";

import { t } from "../i18n";

import { register } from "./register";

export const actionSmartZoom = register({
  name: "smartZoom",
  label: "toolBar.smartZoom",
  trackEvent: { category: "toolbar" },
  icon: arrowsToEyeIcon,
  viewMode: true,
  perform: (elements, appState, _, app) => {
    const settings = getEffectiveEditorPreferences(
      appState,
      app.props.editorPreferences,
    ).smartZoom;
    const selectedElements = getSelectedElements(elements, appState);
    app.viewport.setViewport({
      target: selectedElements.length ? selectedElements : elements,
      fit: settings.fitToViewport ? "contain" : "none",
      animation: settings.animate ? { duration: settings.duration } : false,
      offsets: settings.respectUIElements ? { ui: true } : undefined,
      viewportZoomFactor: settings.viewportZoomFactor,
    });

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
    <IconButton
      type="button"
      icon={arrowsToEyeIcon}
      aria-label={t("labels.smartZoom")}
      title={`${t("labels.smartZoom")} - ${KEYS.F.toLocaleUpperCase()}`}
      onClick={() => updateData(null)}
      size={data?.size || "medium"}
      data-testid="button-smart-zoom"
      keyBindingLabel={KEYS.F.toLocaleUpperCase()}
    />
  ),
});
