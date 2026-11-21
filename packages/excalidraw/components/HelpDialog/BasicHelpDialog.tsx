import { isFirefox } from "@excalidraw/common";

import { getBindingLabels } from "../../actions/shortcuts";
import { probablySupportsClipboardBlob } from "../../clipboard";
import { t } from "../../i18n";
import { DEFAULT_BINDINGS } from "../../keymap";
import { getShortcutKey } from "../../shortcut";

import { useKeymap } from "../App";

import type { JSX } from "react";

const Section = (props: { title: string; children: React.ReactNode }) => (
  <>
    <h3>{props.title}</h3>
    <div className="HelpDialog__islands-container">{props.children}</div>
  </>
);

const ShortcutIsland = (props: {
  caption: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={`HelpDialog__island ${props.className}`}>
    <h4 className="HelpDialog__island-title">{props.caption}</h4>
    <div className="HelpDialog__island-content">{props.children}</div>
  </div>
);

function* intersperse(as: JSX.Element[][], delim: string | null) {
  let first = true;
  for (const x of as) {
    if (!first) {
      yield delim;
    }
    first = false;
    yield x;
  }
}

const upperCaseSingleChars = (str: string) => {
  return str.replace(/\b[a-z]\b/, (c) => c.toUpperCase());
};

const Shortcut = ({
  label,
  shortcuts,
  isOr = true,
}: {
  label: string;
  shortcuts: string[];
  isOr?: boolean;
}) => {
  if (shortcuts.length === 0) {
    // every key of the binding was removed
    return null;
  }

  const splitShortcutKeys = shortcuts.map((shortcut) => {
    const keys = shortcut.endsWith("++")
      ? [...shortcut.slice(0, -2).split("+"), "+"]
      : shortcut.split("+");

    return keys.map((key) => (
      <ShortcutKey key={key}>{upperCaseSingleChars(key)}</ShortcutKey>
    ));
  });

  return (
    <div className="HelpDialog__shortcut">
      <div>{label}</div>
      <div className="HelpDialog__key-container">
        {[...intersperse(splitShortcutKeys, isOr ? t("helpDialog.or") : null)]}
      </div>
    </div>
  );
};

const ShortcutKey = (props: { children: React.ReactNode }) => (
  <kbd className="HelpDialog__key" {...props} />
);
const BASIC_TOOL_IDS = [
  "tool:hand",
  "tool:selection",
  "tool:freedraw",
  "tool:text",
  "tool:image",
  "tool:eraser",
] as const;

export default function BasicHelpDialog() {
  const keymap = useKeymap();
  const keysOf = (id: keyof typeof DEFAULT_BINDINGS) =>
    getBindingLabels(id, keymap);

  return (
    <Section title={t("helpDialog.shortcuts")}>
      <ShortcutIsland
        className="HelpDialog__island--tools"
        caption={t("helpDialog.tools")}
      >
        {BASIC_TOOL_IDS.map((id) => (
          <Shortcut
            key={id}
            label={t(DEFAULT_BINDINGS[id].labelKey)}
            shortcuts={keysOf(id)}
          />
        ))}
        <Shortcut
          label={t("helpDialog.cropStart")}
          shortcuts={[t("helpDialog.doubleClick"), getShortcutKey("Enter")]}
          isOr={true}
        />
        <Shortcut
          label={t("helpDialog.cropFinish")}
          shortcuts={[getShortcutKey("Enter"), getShortcutKey("Escape")]}
          isOr={true}
        />
      </ShortcutIsland>
      <ShortcutIsland
        className="HelpDialog__island--view"
        caption={t("helpDialog.view")}
      >
        <Shortcut
          label={t("helpDialog.smartZoom")}
          shortcuts={keysOf("editor:smartZoom")}
        />
        <Shortcut
          label={t("labels.flipViewpointHorizontal")}
          shortcuts={[getShortcutKey("Shift+R")]}
        />
        <Shortcut
          label={t("labels.flipViewpointVertical")}
          shortcuts={[getShortcutKey("Alt+Shift+R")]}
        />
        <Shortcut
          label={t("helpDialog.dragToZoom")}
          shortcuts={keysOf("editor:holdZoom").map(
            (key) => `${key}+${t("helpDialog.drag")}`,
          )}
        />
        <Shortcut
          label={t("buttons.objectsSnapMode")}
          shortcuts={keysOf("action:objectsSnapMode")}
        />
      </ShortcutIsland>
      <ShortcutIsland
        className="HelpDialog__island--editor"
        caption={t("helpDialog.editor")}
      >
        <Shortcut
          label={t("labels.pasteAsPlaintext")}
          shortcuts={[getShortcutKey("CtrlOrCmd+Shift+V")]}
        />
        <Shortcut
          label={t("labels.multiSelect")}
          shortcuts={[getShortcutKey(`Shift+${t("helpDialog.click")}`)]}
        />
        <Shortcut
          label={t("helpDialog.deepSelect")}
          shortcuts={[getShortcutKey(`CtrlOrCmd+${t("helpDialog.click")}`)]}
        />
        <Shortcut
          label={t("helpDialog.deepBoxSelect")}
          shortcuts={[getShortcutKey(`CtrlOrCmd+${t("helpDialog.drag")}`)]}
        />
        {/* firefox supports clipboard API under a flag, so we'll
                    show users what they can do in the error message */}
        {(probablySupportsClipboardBlob || isFirefox) && (
          <Shortcut
            label={t("labels.copyAsPng")}
            shortcuts={keysOf("action:copyAsPng")}
          />
        )}
        <Shortcut
          label={t("helpDialog.toggleElementLock")}
          shortcuts={keysOf("action:toggleElementLock")}
        />
        <Shortcut
          label={t("labels.group")}
          shortcuts={keysOf("action:group")}
        />
        <Shortcut
          label={t("labels.ungroup")}
          shortcuts={keysOf("action:ungroup")}
        />
        <Shortcut
          label={t("labels.flipHorizontal")}
          shortcuts={keysOf("action:flipHorizontal")}
        />
        <Shortcut
          label={t("labels.flipVertical")}
          shortcuts={keysOf("action:flipVertical")}
        />
      </ShortcutIsland>
    </Section>
  );
}
