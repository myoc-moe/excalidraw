import { getShortcutFromShortcutName } from "@excalidraw/excalidraw/actions/shortcuts";
import { probablySupportsClipboardBlob } from "@excalidraw/excalidraw/clipboard";
import {
  isFirefox,
  isDarwin,
  isWindows,
} from "@excalidraw/excalidraw/constants";
import { t } from "@excalidraw/excalidraw/i18n";
import { KEYS } from "@excalidraw/excalidraw/keys";
import { SHAPES } from "@excalidraw/excalidraw/shapes";
import { getShortcutKey } from "@excalidraw/excalidraw/utils";

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
export default function BasicHelpDialog() {
  return (
    <Section title={t("helpDialog.shortcuts")}>
      <ShortcutIsland
        className="HelpDialog__island--tools"
        caption={t("helpDialog.tools")}
      >
        <Shortcut label={t("toolBar.hand")} shortcuts={[KEYS.H]} />
        {SHAPES.filter(({ myocSimplifiedMode }) => myocSimplifiedMode).map(
          ({ value, key }) => (
            <Shortcut
              key={value}
              label={t(`toolBar.${value}`)}
              shortcuts={[...key]}
            />
          ),
        )}
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
        <Shortcut label={t("helpDialog.smartZoom")} shortcuts={[KEYS.F]} />
        <Shortcut
          label={t("buttons.zoomIn")}
          shortcuts={[getShortcutKey("CtrlOrCmd++")]}
        />
        <Shortcut
          label={t("buttons.zoomOut")}
          shortcuts={[getShortcutKey("CtrlOrCmd+-")]}
        />
        <Shortcut
          label={t("buttons.resetZoom")}
          shortcuts={[getShortcutKey("CtrlOrCmd+0")]}
        />
        <Shortcut
          label={t("helpDialog.zoomToSelection")}
          shortcuts={["Shift+2"]}
        />
        <Shortcut
          label={t("helpDialog.movePageUpDown")}
          shortcuts={["PgUp/PgDn"]}
        />
        <Shortcut
          label={t("helpDialog.movePageLeftRight")}
          shortcuts={["Shift+PgUp/PgDn"]}
        />
        <Shortcut
          label={t("buttons.zenMode")}
          shortcuts={[getShortcutKey("Alt+Z")]}
        />
        <Shortcut
          label={t("buttons.objectsSnapMode")}
          shortcuts={[getShortcutKey("Alt+S")]}
        />
        <Shortcut
          label={t("labels.toggleGrid")}
          shortcuts={[getShortcutKey("CtrlOrCmd+'")]}
        />
        <Shortcut
          label={t("labels.viewMode")}
          shortcuts={[getShortcutKey("Alt+R")]}
        />
        <Shortcut
          label={t("stats.fullTitle")}
          shortcuts={[getShortcutKey("Alt+/")]}
        />
        <Shortcut
          label={t("search.title")}
          shortcuts={[getShortcutFromShortcutName("searchMenu")]}
        />
        <Shortcut
          label={t("commandPalette.title")}
          shortcuts={
            isFirefox
              ? [getShortcutFromShortcutName("commandPalette")]
              : [
                  getShortcutFromShortcutName("commandPalette"),
                  getShortcutFromShortcutName("commandPalette", 1),
                ]
          }
        />
      </ShortcutIsland>
      <ShortcutIsland
        className="HelpDialog__island--editor"
        caption={t("helpDialog.editor")}
      >
        <Shortcut
          label={t("labels.moveCanvas")}
          shortcuts={[
            getShortcutKey(`Space+${t("helpDialog.drag")}`),
            getShortcutKey(`Wheel+${t("helpDialog.drag")}`),
          ]}
          isOr={true}
        />
        <Shortcut
          label={t("labels.delete")}
          shortcuts={[getShortcutKey("Delete")]}
        />
        <Shortcut
          label={t("labels.cut")}
          shortcuts={[getShortcutKey("CtrlOrCmd+X")]}
        />
        <Shortcut
          label={t("labels.copy")}
          shortcuts={[getShortcutKey("CtrlOrCmd+C")]}
        />
        <Shortcut
          label={t("labels.paste")}
          shortcuts={[getShortcutKey("CtrlOrCmd+V")]}
        />
        <Shortcut
          label={t("labels.pasteAsPlaintext")}
          shortcuts={[getShortcutKey("CtrlOrCmd+Shift+V")]}
        />
        <Shortcut
          label={t("labels.selectAll")}
          shortcuts={[getShortcutKey("CtrlOrCmd+A")]}
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
            shortcuts={[getShortcutKey("Shift+Alt+C")]}
          />
        )}
        <Shortcut
          label={t("labels.sendToBack")}
          shortcuts={[
            isDarwin
              ? getShortcutKey("CtrlOrCmd+Alt+[")
              : getShortcutKey("CtrlOrCmd+Shift+["),
          ]}
        />
        <Shortcut
          label={t("labels.bringToFront")}
          shortcuts={[
            isDarwin
              ? getShortcutKey("CtrlOrCmd+Alt+]")
              : getShortcutKey("CtrlOrCmd+Shift+]"),
          ]}
        />
        <Shortcut
          label={t("labels.sendBackward")}
          shortcuts={[getShortcutKey("CtrlOrCmd+[")]}
        />
        <Shortcut
          label={t("labels.bringForward")}
          shortcuts={[getShortcutKey("CtrlOrCmd+]")]}
        />
        <Shortcut
          label={t("helpDialog.toggleElementLock")}
          shortcuts={[getShortcutKey("CtrlOrCmd+Shift+L")]}
        />
        <Shortcut
          label={t("buttons.undo")}
          shortcuts={[getShortcutKey("CtrlOrCmd+Z")]}
        />
        <Shortcut
          label={t("buttons.redo")}
          shortcuts={
            isWindows
              ? [
                  getShortcutKey("CtrlOrCmd+Y"),
                  getShortcutKey("CtrlOrCmd+Shift+Z"),
                ]
              : [getShortcutKey("CtrlOrCmd+Shift+Z")]
          }
        />
        <Shortcut
          label={t("labels.group")}
          shortcuts={[getShortcutKey("CtrlOrCmd+G")]}
        />
        <Shortcut
          label={t("labels.ungroup")}
          shortcuts={[getShortcutKey("CtrlOrCmd+Shift+G")]}
        />
        <Shortcut
          label={t("labels.flipHorizontal")}
          shortcuts={[getShortcutKey("Shift+H")]}
        />
        <Shortcut
          label={t("labels.flipVertical")}
          shortcuts={[getShortcutKey("Shift+V")]}
        />
      </ShortcutIsland>
    </Section>
  );
}
