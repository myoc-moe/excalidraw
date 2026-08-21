import { CODES, KEYS } from "@excalidraw/common";

import clsx from "clsx";
import { CaptureUpdateAction } from "@excalidraw/element";

import { IconButton } from "../components/IconButton";
import { eyeIcon } from "../components/icons";

import { t } from "../i18n";

import { register } from "./register";

export const actionToggleViewMode = register({
  name: "viewMode",
  label: "labels.viewMode",
  icon: eyeIcon,
  viewMode: true,
  trackEvent: {
    category: "canvas",
    predicate: (appState) => !appState.viewModeEnabled,
  },
  perform(elements, appState) {
    if (appState.viewModeOnly) {
      return false;
    }

    return {
      appState: {
        ...appState,
        viewModeEnabled: !this.checked!(appState),
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  checked: (appState) => appState.viewModeEnabled,
  predicate: (elements, appState, appProps, app) => {
    return (
      !appState.viewModeOnly &&
      !appProps.viewModeOnly &&
      typeof appProps.viewModeEnabled === "undefined" &&
      app.isInteractionEnabled()
    );
  },
  keyTest: (event) =>
    !event[KEYS.CTRL_OR_CMD] && event.altKey && event.code === CODES.R,
  PanelComponent: ({ data, updateData, appState, appProps }) => {
    if (appState.viewModeOnly || appProps.viewModeOnly) {
      return null;
    }

    return (
      <IconButton
        type="button"
        icon={eyeIcon}
        aria-label={t("labels.viewMode")}
        onClick={() => updateData(null)}
        size={data?.size || "medium"}
        data-testid="button-view-mode"
        className={clsx({
          enabled: appState.viewModeEnabled,
        })}
      />
    );
  },
});
