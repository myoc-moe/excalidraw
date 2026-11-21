import {
  getNonDeletedElements,
  isEmbeddableElement,
} from "@excalidraw/element";

import { KEYS } from "@excalidraw/common";

import { CaptureUpdateAction } from "@excalidraw/element";

import { IconButton } from "../components/IconButton";
import { getContextMenuLabel } from "../components/hyperlink/Hyperlink";
import { LinkIcon } from "../components/icons";
import { useKeymap } from "../components/App";
import { t } from "../i18n";
import { getSelectedElements } from "../scene";

import { register } from "./register";
import { getBindingLabels, joinLabels } from "./shortcuts";

export const actionLink = register({
  name: "hyperlink",
  label: (elements, appState) =>
    getContextMenuLabel(getNonDeletedElements(elements), appState),
  icon: LinkIcon,
  perform: (elements, appState) => {
    if (appState.showHyperlinkPopup === "editor") {
      return false;
    }

    return {
      elements,
      appState: {
        ...appState,
        showHyperlinkPopup: "editor",
        openMenu: null,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  trackEvent: { category: "hyperlink", action: "click" },
  keyTest: (event) => event[KEYS.CTRL_OR_CMD] && event.key === KEYS.K,
  predicate: (elements, appState) => {
    const selectedElements = getSelectedElements(elements, appState);
    return selectedElements.length === 1;
  },
  PanelComponent: ({ elements, appState, updateData }) => {
    const keymap = useKeymap();
    const selectedElements = getSelectedElements(elements, appState);
    const shortcut = joinLabels(getBindingLabels("action:hyperlink", keymap));
    const label = isEmbeddableElement(elements[0])
      ? t("labels.link.labelEmbed")
      : t("labels.link.label");

    return (
      <IconButton
        type="toggle"
        icon={LinkIcon}
        aria-label={t(
          getContextMenuLabel(getNonDeletedElements(elements), appState),
        )}
        title={shortcut ? `${label} - ${shortcut}` : label}
        onSelect={() => updateData(null)}
        checked={selectedElements.length === 1 && !!selectedElements[0].link}
      />
    );
  },
});
