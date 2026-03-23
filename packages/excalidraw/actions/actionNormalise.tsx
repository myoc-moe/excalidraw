import { arrayToMap } from "@excalidraw/common";

import { CaptureUpdateAction } from "@excalidraw/element";
import { updateFrameMembershipOfSelectedElements } from "@excalidraw/element/frame";
import { normaliseElements } from "@excalidraw/element/normalise";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { NormaliseSizeIcon } from "../components/icons";
import { getEffectiveEditorPreferences } from "../editorPreferences";
import { t } from "../i18n";

import { alignActionsPredicate } from "./actionAlign";
import { register } from "./register";

import type { AppClassProperties, AppState } from "../types";

const normaliseSelectedElements = (
  elements: readonly ExcalidrawElement[],
  appState: Readonly<AppState>,
  app: AppClassProperties,
) => {
  const selectedElements = app.scene.getSelectedElements(appState);
  const elementsMap = arrayToMap(elements);
  const { normalise } = getEffectiveEditorPreferences(
    appState,
    app.props.editorPreferences,
  );
  const updatedElements = normaliseElements(
    app.scene,
    selectedElements,
    elementsMap,
    normalise.mode,
    normalise.metric,
  );

  const updatedElementsMap = arrayToMap(updatedElements);
  return updateFrameMembershipOfSelectedElements(
    elements.map((element) => updatedElementsMap.get(element.id) || element),
    appState,
    app,
  );
};

// Note that this is basically the same as alignActions so the conditions
// to use this action are the same
export const normaliseElementsPredicate = alignActionsPredicate;

/**
 * Normalises selected image elements to a common size based on the configured
 * mode and metric.
 */
export const actionNormaliseElements = register({
  name: "normaliseElements",
  label: "labels.normaliseElements",
  keywords: ["normalize", "normalise", "scale", "size", "image"],
  icon: NormaliseSizeIcon,
  trackEvent: { category: "element" },
  viewMode: false,
  predicate: (_elements, appState, _appProps, app) =>
    normaliseElementsPredicate(appState, app),
  perform: (elements, appState, _value, app) => {
    return {
      appState,
      elements: normaliseSelectedElements(elements, appState, app),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  PanelComponent: ({ updateData }) => (
    <button
      type="button"
      className="arrangeButton"
      onClick={() => updateData(null)}
      title={t("labels.normaliseElements")}
    >
      {NormaliseSizeIcon}
    </button>
  ),
});
