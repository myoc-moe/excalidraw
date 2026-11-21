import {
  moveOneLeft,
  moveOneRight,
  moveAllLeft,
  moveAllRight,
} from "@excalidraw/element";

import { CaptureUpdateAction } from "@excalidraw/element";

import {
  BringForwardIcon,
  BringToFrontIcon,
  SendBackwardIcon,
  SendToBackIcon,
} from "../components/icons";
import { useKeymap } from "../components/App";
import { t } from "../i18n";

import { getTitleWithShortcut } from "./shortcuts";

import { register } from "./register";

export const actionSendBackward = register({
  name: "sendBackward",
  label: "labels.sendBackward",
  keywords: ["move down", "zindex", "layer"],
  icon: SendBackwardIcon,
  trackEvent: { category: "element" },
  perform: (elements, appState, value, app) => {
    return {
      elements: moveOneLeft(elements, appState, app.scene),
      appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  keyPriority: 40,
  PanelComponent: ({ updateData, appState }) => {
    const keymap = useKeymap();
    return (
      <button
        type="button"
        className="zIndexButton"
        onClick={() => updateData(null)}
        title={getTitleWithShortcut(
          t("labels.sendBackward"),
          "action:sendBackward",
          keymap,
        )}
      >
        {SendBackwardIcon}
      </button>
    );
  },
});

export const actionBringForward = register({
  name: "bringForward",
  label: "labels.bringForward",
  keywords: ["move up", "zindex", "layer"],
  icon: BringForwardIcon,
  trackEvent: { category: "element" },
  perform: (elements, appState, value, app) => {
    return {
      elements: moveOneRight(elements, appState, app.scene),
      appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  keyPriority: 40,
  PanelComponent: ({ updateData, appState }) => {
    const keymap = useKeymap();
    return (
      <button
        type="button"
        className="zIndexButton"
        onClick={() => updateData(null)}
        title={getTitleWithShortcut(
          t("labels.bringForward"),
          "action:bringForward",
          keymap,
        )}
      >
        {BringForwardIcon}
      </button>
    );
  },
});

export const actionSendToBack = register({
  name: "sendToBack",
  label: "labels.sendToBack",
  keywords: ["move down", "zindex", "layer"],
  icon: SendToBackIcon,
  trackEvent: { category: "element" },
  perform: (elements, appState) => {
    return {
      elements: moveAllLeft(elements, appState),
      appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  PanelComponent: ({ updateData, appState }) => {
    const keymap = useKeymap();
    return (
      <button
        type="button"
        className="zIndexButton"
        onClick={() => updateData(null)}
        title={getTitleWithShortcut(
          t("labels.sendToBack"),
          "action:sendToBack",
          keymap,
        )}
      >
        {SendToBackIcon}
      </button>
    );
  },
});

export const actionBringToFront = register({
  name: "bringToFront",
  label: "labels.bringToFront",
  keywords: ["move up", "zindex", "layer"],
  icon: BringToFrontIcon,
  trackEvent: { category: "element" },

  perform: (elements, appState) => {
    return {
      elements: moveAllRight(elements, appState),
      appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  PanelComponent: ({ updateData, appState }) => {
    const keymap = useKeymap();
    return (
      <button
        type="button"
        className="zIndexButton"
        onClick={(event) => updateData(null)}
        title={getTitleWithShortcut(
          t("labels.bringToFront"),
          "action:bringToFront",
          keymap,
        )}
      >
        {BringToFrontIcon}
      </button>
    );
  },
});
