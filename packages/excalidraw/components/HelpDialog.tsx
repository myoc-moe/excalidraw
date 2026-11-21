import React, { useMemo } from "react";
import clsx from "clsx";

import { isFirefox } from "@excalidraw/common";

import { getBindingLabels } from "../actions/shortcuts";
import { probablySupportsClipboardBlob } from "../clipboard";
import { t } from "../i18n";
import { DEFAULT_BINDINGS } from "../keymap";
import { getShortcutKey } from "../shortcut";

import { useAppProps, useKeymap } from "./App";
import { Dialog } from "./Dialog";

import "./HelpDialog.scss";

import BasicHelpDialog from "./HelpDialog/BasicHelpDialog";

import type { JSX } from "react";
// Myoc - no header!
// const Header = () => (
//   <div className="HelpDialog__header">
//     <a
//       className="HelpDialog__btn"
//       href="https://docs.excalidraw.com"
//       target="_blank"
//       rel="noopener"
//     >
//       <div className="HelpDialog__link-icon">{ExternalLinkIcon}</div>
//       {t("helpDialog.documentation")}
//     </a>
//     <a
//       className="HelpDialog__btn"
//       href="https://plus.excalidraw.com/blog"
//       target="_blank"
//       rel="noopener"
//     >
//       <div className="HelpDialog__link-icon">{ExternalLinkIcon}</div>
//       {t("helpDialog.blog")}
//     </a>
//     <a
//       className="HelpDialog__btn"
//       href="https://github.com/excalidraw/excalidraw/issues"
//       target="_blank"
//       rel="noopener noreferrer"
//     >
//       <div className="HelpDialog__link-icon">{GithubIcon}</div>
//       {t("helpDialog.github")}
//     </a>
//     <a
//       className="HelpDialog__btn"
//       href="https://youtube.com/@excalidraw"
//       target="_blank"
//       rel="noopener noreferrer"
//     >
//       <div className="HelpDialog__link-icon">{youtubeIcon}</div>
//       YouTube
//     </a>
//   </div>
// );

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

const TOOL_BINDING_IDS = (
  Object.keys(DEFAULT_BINDINGS) as (keyof typeof DEFAULT_BINDINGS)[]
).filter((id) => id.startsWith("tool:"));

const footerLinkStyle: React.CSSProperties = {
  padding: 0,
  border: "none",
  background: "none",
  color: "var(--color-primary)",
  textDecoration: "underline",
  cursor: "pointer",
  font: "inherit",
};

export const HelpDialog = ({ onClose }: { onClose?: () => void }) => {
  const keymap = useKeymap();
  const onOpenKeyboardShortcuts = useAppProps()?.onOpenKeyboardShortcuts;
  const keysOf = (id: keyof typeof DEFAULT_BINDINGS) =>
    getBindingLabels(id, keymap);
  const [isShowAll, setIsShowAll] = React.useState(false);

  const handleClose = React.useCallback(() => {
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  const handleOpenKeyboardShortcuts = React.useCallback(() => {
    handleClose();
    onOpenKeyboardShortcuts?.();
  }, [handleClose, onOpenKeyboardShortcuts]);

  const showAllButton = useMemo(
    () =>
      isShowAll ? (
        <button
          className={clsx("toggle-button", {})}
          onClick={() => setIsShowAll(false)}
        >
          {t("helpDialog.myoc.showingAll")}
        </button>
      ) : (
        <button
          className={clsx("toggle-button", {})}
          onClick={() => setIsShowAll(true)}
        >
          {t("helpDialog.myoc.showingBasic")}
        </button>
      ),
    [isShowAll],
  );

  return (
    <>
      <Dialog
        onCloseRequest={handleClose}
        title={t("helpDialog.title")}
        className={"HelpDialog"}
        titleButton={showAllButton}
        portalContainerClassName="HelpDialog__modalContainer"
      >
        {/* <Header /> - Myoc - no header! */}
        {isShowAll ? (
          <Section title={t("helpDialog.shortcuts")}>
            <ShortcutIsland
              className="HelpDialog__island--tools"
              caption={t("helpDialog.tools")}
            >
              {TOOL_BINDING_IDS.map((id) => (
                <Shortcut
                  key={id}
                  label={t(DEFAULT_BINDINGS[id].labelKey)}
                  shortcuts={keysOf(id)}
                />
              ))}
              <Shortcut
                label={t("labels.eyeDropper")}
                shortcuts={[
                  ...keysOf("editor:eyeDropperStroke"),
                  ...keysOf("editor:eyeDropperBackground"),
                ]}
              />
              <Shortcut
                label={t("helpDialog.editLineArrowPoints")}
                shortcuts={[getShortcutKey("CtrlOrCmd+Enter")]}
              />
              <Shortcut
                label={t("helpDialog.editText")}
                shortcuts={[getShortcutKey("Enter")]}
              />
              <Shortcut
                label={t("helpDialog.textNewLine")}
                shortcuts={[
                  getShortcutKey("Enter"),
                  getShortcutKey("Shift+Enter"),
                ]}
              />
              <Shortcut
                label={t("helpDialog.textFinish")}
                shortcuts={[
                  getShortcutKey("Esc"),
                  getShortcutKey("CtrlOrCmd+Enter"),
                ]}
              />
              <Shortcut
                label={t("helpDialog.curvedArrow")}
                shortcuts={[
                  "A",
                  t("helpDialog.click"),
                  t("helpDialog.click"),
                  t("helpDialog.click"),
                ]}
                isOr={false}
              />
              <Shortcut
                label={t("helpDialog.curvedLine")}
                shortcuts={[
                  "L",
                  t("helpDialog.click"),
                  t("helpDialog.click"),
                  t("helpDialog.click"),
                ]}
                isOr={false}
              />
              <Shortcut
                label={t("helpDialog.cropStart")}
                shortcuts={[
                  t("helpDialog.doubleClick"),
                  getShortcutKey("Enter"),
                ]}
                isOr={true}
              />
              <Shortcut
                label={t("helpDialog.cropFinish")}
                shortcuts={[getShortcutKey("Enter"), getShortcutKey("Escape")]}
                isOr={true}
              />
              <Shortcut
                label={t("toolBar.lock")}
                shortcuts={keysOf("editor:toolLock")}
              />
              <Shortcut
                label={t("helpDialog.preventBinding")}
                shortcuts={[getShortcutKey("CtrlOrCmd")]}
              />
              <Shortcut
                label={t("toolBar.link")}
                shortcuts={keysOf("action:hyperlink")}
              />
              <Shortcut
                label={t("toolBar.convertElementType")}
                shortcuts={["Tab", "Shift+Tab"]}
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
                label={t("helpDialog.dragToZoom")}
                shortcuts={keysOf("editor:holdZoom").map(
                  (key) => `${key}+${t("helpDialog.drag")}`,
                )}
              />
              <Shortcut
                label={t("buttons.zoomIn")}
                shortcuts={keysOf("action:zoomIn")}
              />
              <Shortcut
                label={t("buttons.zoomOut")}
                shortcuts={keysOf("action:zoomOut")}
              />
              <Shortcut
                label={t("buttons.resetZoom")}
                shortcuts={keysOf("action:resetZoom")}
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
                label={t("buttons.objectsSnapMode")}
                shortcuts={keysOf("action:objectsSnapMode")}
              />
              <Shortcut
                label={t("labels.toggleGrid")}
                shortcuts={keysOf("action:gridMode")}
              />
              <Shortcut
                label={t("labels.viewMode")}
                shortcuts={keysOf("action:viewMode")}
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
                label={t("stats.fullTitle")}
                shortcuts={keysOf("action:stats")}
              />
              <Shortcut
                label={t("search.title")}
                shortcuts={keysOf("action:searchMenu")}
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
                shortcuts={keysOf("action:selectAll")}
              />
              <Shortcut
                label={t("labels.multiSelect")}
                shortcuts={[getShortcutKey(`Shift+${t("helpDialog.click")}`)]}
              />
              <Shortcut
                label={t("helpDialog.deepSelect")}
                shortcuts={[
                  getShortcutKey(`CtrlOrCmd+${t("helpDialog.click")}`),
                ]}
              />
              <Shortcut
                label={t("helpDialog.deepBoxSelect")}
                shortcuts={[
                  getShortcutKey(`CtrlOrCmd+${t("helpDialog.drag")}`),
                ]}
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
                label={t("labels.sendToBack")}
                shortcuts={keysOf("action:sendToBack")}
              />
              <Shortcut
                label={t("labels.bringToFront")}
                shortcuts={keysOf("action:bringToFront")}
              />
              <Shortcut
                label={t("labels.sendBackward")}
                shortcuts={keysOf("action:sendBackward")}
              />
              <Shortcut
                label={t("labels.bringForward")}
                shortcuts={keysOf("action:bringForward")}
              />
              <Shortcut
                label={t("labels.alignTop")}
                shortcuts={keysOf("action:alignTop")}
              />
              <Shortcut
                label={t("labels.alignBottom")}
                shortcuts={keysOf("action:alignBottom")}
              />
              <Shortcut
                label={t("labels.alignLeft")}
                shortcuts={keysOf("action:alignLeft")}
              />
              <Shortcut
                label={t("labels.alignRight")}
                shortcuts={keysOf("action:alignRight")}
              />
              <Shortcut
                label={t("labels.arrangeElements")}
                shortcuts={keysOf("action:arrangeElements")}
              />
              <Shortcut
                label={t("labels.duplicateSelection")}
                shortcuts={[
                  ...keysOf("action:duplicateSelection"),
                  getShortcutKey(`Alt+${t("helpDialog.drag")}`),
                ]}
              />
              <Shortcut
                label={t("helpDialog.toggleElementLock")}
                shortcuts={keysOf("action:toggleElementLock")}
              />
              <Shortcut
                label={t("buttons.undo")}
                shortcuts={keysOf("action:undo")}
              />
              <Shortcut
                label={t("buttons.redo")}
                shortcuts={keysOf("action:redo")}
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
              <Shortcut
                label={t("labels.showStroke")}
                shortcuts={keysOf("editor:strokePicker")}
              />
              <Shortcut
                label={t("labels.showBackground")}
                shortcuts={keysOf("editor:backgroundPicker")}
              />
              <Shortcut
                label={t("labels.showFonts")}
                shortcuts={keysOf("editor:fontPicker")}
              />
              <Shortcut
                label={t("labels.decreaseFontSize")}
                shortcuts={keysOf("action:decreaseFontSize")}
              />
              <Shortcut
                label={t("labels.increaseFontSize")}
                shortcuts={keysOf("action:increaseFontSize")}
              />
            </ShortcutIsland>
          </Section>
        ) : (
          <BasicHelpDialog />
        )}
        {onOpenKeyboardShortcuts && (
          <div className="HelpDialog__footer">
            <span>{t("helpDialog.myoc.shortcutsNote")}</span>{" "}
            <button
              type="button"
              style={footerLinkStyle}
              onClick={handleOpenKeyboardShortcuts}
            >
              {t("helpDialog.myoc.changeShortcuts")}
            </button>
          </div>
        )}
      </Dialog>
    </>
  );
};
