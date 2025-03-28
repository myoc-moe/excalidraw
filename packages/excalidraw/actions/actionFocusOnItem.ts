import { eyeIcon } from "../components/icons";
import { KEYS } from "../keys";
import { getSelectedElements } from "../scene";
import { CaptureUpdateAction } from "../store";

import { register } from "./register";

export const actionFocusOnItem = register({
  name: "focusOnItem",
  label: "toolBar.focusOnItem",
  trackEvent: { category: "toolbar" },
  icon: eyeIcon,
  viewMode: false,
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
});
