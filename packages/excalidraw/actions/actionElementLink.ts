import { canCreateLinkFromElements } from "@excalidraw/element";

import { CaptureUpdateAction } from "@excalidraw/element";

import { elementLinkIcon } from "../components/icons";
import { getSelectedElements } from "../scene";

import { register } from "./register";

export const actionLinkToElement = register({
  name: "linkToElement",
  label: "labels.linkToElement",
  icon: elementLinkIcon,
  perform: (elements, appState, _, app) => {
    const selectedElements = getSelectedElements(elements, appState);

    if (
      selectedElements.length !== 1 ||
      !canCreateLinkFromElements(selectedElements)
    ) {
      return {
        elements,
        appState,
        app,
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    }

    return {
      appState: {
        ...appState,
        openDialog: {
          name: "elementLinkSelector",
          sourceElementId: getSelectedElements(elements, appState)[0].id,
        },
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  predicate: (elements, appState, appProps, app) => {
    const selectedElements = getSelectedElements(elements, appState);

    return (
      appState.openDialog?.name !== "elementLinkSelector" &&
      selectedElements.length === 1 &&
      canCreateLinkFromElements(selectedElements)
    );
  },
  trackEvent: false,
});
