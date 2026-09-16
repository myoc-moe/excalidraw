import clsx from "clsx";

import { KEYS } from "@excalidraw/common";

import { CaptureUpdateAction } from "@excalidraw/element/store";

import { getElementBounds } from "@excalidraw/element";
import { isImageElement } from "@excalidraw/element/typeChecks";

import type {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
  NonDeletedSceneElementsMap,
} from "@excalidraw/element/types";

import { arrowsToEyeIcon } from "../components/icons";
import { getSelectedElements } from "../scene";
import { IconButton } from "../components/IconButton";
import { getEffectiveEditorPreferences } from "../editorPreferences";
import { atom, useAtomValue } from "../editor-jotai";

import { t } from "../i18n";

import { register } from "./register";

import type { PanelComponentProps } from "./types";

type SmartZoomTarget = readonly ExcalidrawElement[];

// MyOC: Keep the press-and-hold Smart Zoom guidance shared by edit and view
// mode hint viewers.
export const SMART_ZOOM_KEY_HINT =
  "Press <kbd>F</kbd> quickly to smart zoom the canvas, or hold and click on an item to smart zoom to it";

// MyOC: The toolbar button and HintViewer both reflect this held-key state.
export const smartZoomKeyHeldAtom = atom(false);

export const getNextSmartZoomImage = (
  elements: readonly NonDeletedExcalidrawElement[],
  elementsMap: NonDeletedSceneElementsMap,
  currentImageId: ExcalidrawElement["id"] | null,
  direction: "previous" | "next",
) => {
  const images = elements.filter(isImageElement).sort((imageA, imageB) => {
    const [leftA, topA] = getElementBounds(imageA, elementsMap);
    const [leftB, topB] = getElementBounds(imageB, elementsMap);

    return topA - topB || leftA - leftB;
  });

  if (images.length === 0) {
    return null;
  }

  const currentIndex = images.findIndex((image) => image.id === currentImageId);
  const nextIndex =
    direction === "next"
      ? (currentIndex + 1) % images.length
      : (currentIndex < 0
          ? images.length - 1
          : currentIndex - 1 + images.length) % images.length;

  return images[nextIndex];
};

// MyOC: Reflect the held-F interaction on the persistent Smart Zoom control.
const SmartZoomButton = ({ data, updateData }: PanelComponentProps) => {
  const smartZoomKeyHeld = useAtomValue(smartZoomKeyHeldAtom);

  return (
    <IconButton
      type="button"
      icon={arrowsToEyeIcon}
      aria-label={t("labels.smartZoom")}
      title={`${t("labels.smartZoom")} - ${KEYS.F.toLocaleUpperCase()}`}
      onClick={() => updateData(null)}
      size={data?.size || "medium"}
      data-testid="button-smart-zoom"
      keyBindingLabel={KEYS.F.toLocaleUpperCase()}
      className={clsx({
        "smart-zoom-button--key-held": smartZoomKeyHeld,
      })}
    />
  );
};

export const actionSmartZoom = register<SmartZoomTarget | null>({
  name: "smartZoom",
  label: "toolBar.smartZoom",
  trackEvent: { category: "toolbar" },
  icon: arrowsToEyeIcon,
  viewMode: true,
  perform: (elements, appState, targetElements, app) => {
    const settings = getEffectiveEditorPreferences(
      appState,
      app.props.editorPreferences,
    ).smartZoom;
    const selectedElements =
      targetElements && targetElements.length > 0
        ? targetElements
        : getSelectedElements(elements, appState);
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
  PanelComponent: SmartZoomButton,
});
