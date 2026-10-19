import React, {
  useMemo,
  useState,
  useRef,
  useEffect,
  useCallback,
  type KeyboardEventHandler,
} from "react";

import { type FontFamilyValues } from "@excalidraw/element/types";

import {
  arrayToList,
  debounce,
  FONT_FAMILY,
  getFontFamilyString,
  isGoogleFontFamily,
} from "@excalidraw/common";

import type { ValueOf } from "@excalidraw/common/utility-types";

import { Fonts } from "../../fonts";
import {
  DEFAULT_GOOGLE_FONT_WEIGHT,
  formatGoogleFontId,
  parseGoogleFontId,
} from "../../fonts/googleFonts";
import { t } from "../../i18n";
import {
  useApp,
  useAppProps,
  useExcalidrawContainer,
  useStylesPanelMode,
} from "../App";
import { PropertiesPopover } from "../PropertiesPopover";
import { QuickSearch } from "../QuickSearch";
import { ScrollableList } from "../ScrollableList";
import DropdownMenuGroup from "../dropdownMenu/DropdownMenuGroup";
import {
  DropDownMenuItemBadgeType,
  DropDownMenuItemBadge,
} from "../dropdownMenu/DropdownMenuItem";
import MenuItemContent from "../dropdownMenu/DropdownMenuItemContent";
import { getDropdownMenuItemClassName } from "../dropdownMenu/common";
import {
  FontFamilyCodeIcon,
  FontFamilyHeadingIcon,
  FontFamilyNormalIcon,
  FreedrawIcon,
  LockedIcon,
  PlusIcon,
  searchIcon,
} from "../icons";

import { fontPickerKeyHandler } from "./keyboardNavHandlers";

import type { GoogleFontsConfig } from "../../types";

import type { JSX } from "react";
import type { ExcalidrawFontFace } from "../../fonts/ExcalidrawFontFace";

export interface FontDescriptor {
  value: FontFamilyValues;
  icon: JSX.Element;
  text: string;
  deprecated?: true;
  badge?: {
    type: ValueOf<typeof DropDownMenuItemBadgeType>;
    placeholder: string;
  };
  /** Shown but unselectable and skipped by keyboard navigation */
  disabled?: boolean;
  /** Hover text, defaults to the label */
  title?: string;
  /** Google family and state of the row's Add to library button */
  addToLibrary?: { family: string; state: "available" | "locked" };
}

interface FontPickerListProps {
  googleFonts?: GoogleFontsConfig;
  selectedFontFamily: FontFamilyValues | null;
  hoveredFontFamily: FontFamilyValues | null;
  onSelect: (value: FontFamilyValues) => void;
  onHover: (value: FontFamilyValues) => void;
  onLeave: () => void;
  onOpen: () => void;
  onClose: () => void;
}

const getFontFamilyIcon = (fontFamily: FontFamilyValues): JSX.Element => {
  switch (fontFamily) {
    case FONT_FAMILY.Excalifont:
    case FONT_FAMILY.Virgil:
      return FreedrawIcon;
    case FONT_FAMILY.Nunito:
    case FONT_FAMILY.Helvetica:
      return FontFamilyNormalIcon;
    case FONT_FAMILY["Lilita One"]:
      return FontFamilyHeadingIcon;
    case FONT_FAMILY["Comic Shanns"]:
    case FONT_FAMILY.Cascadia:
      return FontFamilyCodeIcon;
    default:
      return FontFamilyNormalIcon;
  }
};

const getFontFamilyLabel = (
  fontFamily: FontFamilyValues,
  fontFaces: ExcalidrawFontFace[],
) => {
  if (isGoogleFontFamily(fontFamily)) {
    // weighted ids such as `google:Montserrat@700` are labelled by family
    return parseGoogleFontId(fontFamily)?.family ?? "Unknown";
  }

  // prefer our config as the browser resolved names may be wrapped in quotes and such
  return (
    Object.entries(FONT_FAMILY).find(([, id]) => id === fontFamily)?.[0] ??
    fontFaces[0]?.fontFace?.family ??
    "Unknown"
  );
};

export const FontPickerList = React.memo(
  ({
    googleFonts,
    selectedFontFamily,
    hoveredFontFamily,
    onSelect,
    onHover,
    onLeave,
    onOpen,
    onClose,
  }: FontPickerListProps) => {
    const { container } = useExcalidrawContainer();
    const app = useApp();
    const { fonts } = app;
    const { showDeprecatedFonts } = useAppProps();
    const canManageLibrary = !!googleFonts && !app.state.viewModeEnabled;
    const stylesPanelMode = useStylesPanelMode();

    const [searchTerm, setSearchTerm] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);
    const sceneFamilies = useMemo(
      () => new Set(fonts.getSceneFamilies()),
      // cache per selected font family, so hover re-render won't mess it up
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [selectedFontFamily],
    );

    const allFonts = useMemo(
      () =>
        Array.from(Fonts.registered.entries())
          .filter(
            ([familyId, { metadata }]) =>
              !metadata.private &&
              !metadata.fallback &&
              !isGoogleFontFamily(familyId),
          )
          .map(([familyId, { metadata, fontFaces }]) => {
            const fontDescriptor = {
              value: familyId,
              icon: getFontFamilyIcon(familyId),
              text: getFontFamilyLabel(familyId, fontFaces),
            };

            if (metadata.deprecated) {
              Object.assign(fontDescriptor, {
                deprecated: metadata.deprecated,
                badge: {
                  type: DropDownMenuItemBadgeType.RED,
                  placeholder: t("fontList.badge.old"),
                },
              });
            }

            return fontDescriptor as FontDescriptor;
          })
          .sort((a, b) =>
            a.text.toLowerCase() > b.text.toLowerCase() ? 1 : -1,
          ),
      [],
    );

    const libraryByFamily = useMemo(
      () =>
        new Map(
          (googleFonts?.libraryFonts ?? []).map((font) => [font.family, font]),
        ),
      [googleFonts?.libraryFonts],
    );

    const sceneFonts = useMemo(
      () => {
        const registeredSceneFonts = allFonts.filter((font) =>
          sceneFamilies.has(font.value),
        );
        const googleSceneFonts = Array.from(sceneFamilies)
          .filter(isGoogleFontFamily)
          .map((fontFamily): FontDescriptor => {
            const { family, weight } = parseGoogleFontId(fontFamily)!;
            const libraryFont = libraryByFamily.get(family);
            const addToLibraryState =
              canManageLibrary &&
              !libraryFont &&
              googleFonts.addToLibrary !== "unavailable"
                ? googleFonts.addToLibrary
                : undefined;
            const label =
              weight === DEFAULT_GOOGLE_FONT_WEIGHT
                ? family
                : `${family} ${weight}`;
            // the host decides whether the plan can apply Google fonts
            const disabled = !!googleFonts && !googleFonts.canApplyGoogleFonts;

            return {
              value: fontFamily,
              icon: getFontFamilyIcon(fontFamily),
              text: label,
              title: disabled ? t("fontList.upgradeToUse") : label,
              disabled,
              addToLibrary: addToLibraryState && {
                family,
                state: addToLibraryState,
              },
            };
          });

        return [...registeredSceneFonts, ...googleSceneFonts];
      }, // always show all the fonts in the scene, even those that were deprecated
      [allFonts, sceneFamilies, libraryByFamily, googleFonts, canManageLibrary],
    );

    const libraryFonts = useMemo(
      () =>
        (googleFonts?.libraryFonts ?? [])
          .map((font): FontDescriptor => {
            const weight = font.weights.includes(DEFAULT_GOOGLE_FONT_WEIGHT)
              ? DEFAULT_GOOGLE_FONT_WEIGHT
              : font.weights.length
              ? Math.min(...font.weights)
              : DEFAULT_GOOGLE_FONT_WEIGHT;
            const value = formatGoogleFontId(font.family, weight);

            return {
              value,
              icon: getFontFamilyIcon(value),
              text:
                weight === DEFAULT_GOOGLE_FONT_WEIGHT
                  ? font.family
                  : `${font.family} ${weight}`,
              disabled: !font.enabled,
            };
          })
          // fonts already in the scene are listed there
          .filter((font) => !sceneFamilies.has(font.value)),
      [googleFonts, sceneFamilies],
    );

    const availableFonts = useMemo(
      () =>
        allFonts.filter(
          (font) =>
            !sceneFamilies.has(font.value) &&
            (showDeprecatedFonts || !font.deprecated), // skip deprecated fonts
        ),
      [allFonts, sceneFamilies, showDeprecatedFonts],
    );

    const sections = useMemo(() => {
      const normalizedSearchTerm = searchTerm.trim().toLowerCase();
      const matchesSearch = (font: FontDescriptor) =>
        font.text.toLowerCase().includes(normalizedSearchTerm);

      return {
        scene: sceneFonts.filter(matchesSearch),
        library: libraryFonts.filter(matchesSearch),
        available: availableFonts.filter(matchesSearch),
      };
    }, [sceneFonts, libraryFonts, availableFonts, searchTerm]);

    // keyboard navigation and hover only visit selectable fonts
    const filteredFonts = useMemo(
      () =>
        arrayToList(
          [
            ...sections.scene,
            ...sections.library,
            ...sections.available,
          ].filter((font) => !font.disabled),
        ),
      [sections],
    );

    const handleHover = useCallback(
      (fontFamily: FontFamilyValues) => {
        onHover(fontFamily);
        if (isGoogleFontFamily(fontFamily)) {
          const font = filteredFonts.find((item) => item.value === fontFamily);
          void fonts
            .loadFontFamily(
              fontFamily,
              font?.text || parseGoogleFontId(fontFamily)?.family || "",
            )
            .catch((error) => {
              console.error(
                `Failed to preview Google Font "${fontFamily}"`,
                error,
              );
            });
        }
      },
      [filteredFonts, fonts, onHover],
    );

    const hoveredFont = useMemo(() => {
      let font;

      if (hoveredFontFamily) {
        font = filteredFonts.find((font) => font.value === hoveredFontFamily);
      } else if (selectedFontFamily) {
        font = filteredFonts.find((font) => font.value === selectedFontFamily);
      }

      if (!font && searchTerm) {
        if (filteredFonts[0]?.value) {
          // hover first element on search
          handleHover(filteredFonts[0].value);
        } else {
          // re-render cache on no results
          onLeave();
        }
      }

      return font;
    }, [
      hoveredFontFamily,
      selectedFontFamily,
      searchTerm,
      filteredFonts,
      handleHover,
      onLeave,
    ]);

    // Create a wrapped onSelect function that preserves caret position
    const wrappedOnSelect = useCallback(
      (fontFamily: FontFamilyValues) => {
        // Save caret position before font selection if editing text
        let savedSelection: { start: number; end: number } | null = null;
        if (app.state.editingTextElement) {
          const textEditor = document.querySelector(
            ".excalidraw-wysiwyg",
          ) as HTMLTextAreaElement;
          if (textEditor) {
            savedSelection = {
              start: textEditor.selectionStart,
              end: textEditor.selectionEnd,
            };
          }
        }

        onSelect(fontFamily);

        // Restore caret position after font selection if editing text
        if (app.state.editingTextElement && savedSelection) {
          setTimeout(() => {
            const textEditor = document.querySelector(
              ".excalidraw-wysiwyg",
            ) as HTMLTextAreaElement;
            if (textEditor && savedSelection) {
              textEditor.focus();
              textEditor.selectionStart = savedSelection.start;
              textEditor.selectionEnd = savedSelection.end;
            }
          }, 0);
        }
      },
      [onSelect, app.state.editingTextElement],
    );

    const onKeyDown = useCallback<KeyboardEventHandler<HTMLDivElement>>(
      (event) => {
        const handled = fontPickerKeyHandler({
          event,
          inputRef,
          hoveredFont,
          filteredFonts,
          onSelect: wrappedOnSelect,
          onHover: handleHover,
          onClose,
        });

        if (handled) {
          event.preventDefault();
          event.stopPropagation();
        }
      },
      [hoveredFont, filteredFonts, wrappedOnSelect, handleHover, onClose],
    );

    useEffect(() => {
      onOpen();

      return () => {
        onClose();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const FontPickerListItem = ({
      font,
      order,
    }: {
      font: FontDescriptor;
      order: number;
    }) => {
      const { disabled } = font;
      const ref = useRef<HTMLButtonElement>(null);
      const isHovered = font.value === hoveredFont?.value;
      const isSelected = font.value === selectedFontFamily;

      useEffect(() => {
        if (!isHovered) {
          return;
        }
        if (order === 0) {
          // scroll into the first item differently, so it's visible what is above (i.e. group title)
          ref.current?.scrollIntoView?.({ block: "end" });
        } else {
          ref.current?.scrollIntoView?.({ block: "nearest" });
        }
      }, [isHovered, order]);

      const addLabel =
        font.addToLibrary?.state === "locked"
          ? t("fontList.addToLibraryLocked")
          : t("fontList.addToLibrary");

      return (
        <div className="FontPicker__row" data-testid="font-picker-row">
          <button
            ref={ref}
            type="button"
            value={font.value}
            disabled={disabled}
            data-testid={`font-picker-item-${font.value}`}
            className={getDropdownMenuItemClassName("", isSelected, isHovered)}
            title={font.title ?? font.text}
            // allow to tab between search and selected font
            tabIndex={isSelected ? 0 : -1}
            onClick={() => {
              if (!disabled) {
                wrappedOnSelect(font.value);
              }
            }}
            onMouseMove={() => {
              if (!disabled && hoveredFont?.value !== font.value) {
                handleHover(font.value);
              }
            }}
          >
            <MenuItemContent
              icon={font.icon}
              badge={
                font.badge && (
                  <DropDownMenuItemBadge type={font.badge.type}>
                    {font.badge.placeholder}
                  </DropDownMenuItemBadge>
                )
              }
              textStyle={{
                fontFamily: getFontFamilyString({ fontFamily: font.value }),
              }}
            >
              {font.text}
            </MenuItemContent>
          </button>
          {font.addToLibrary && (
            <button
              type="button"
              className="FontPicker__row-action"
              data-testid={`font-picker-add-${font.value}`}
              data-locked={font.addToLibrary.state === "locked" || undefined}
              title={addLabel}
              aria-label={addLabel}
              onClick={() =>
                googleFonts?.onAddToLibrary?.(font.addToLibrary!.family)
              }
            >
              {font.addToLibrary.state === "locked" ? LockedIcon : PlusIcon}
            </button>
          )}
        </div>
      );
    };

    const groups = [];
    let offset = 0;

    if (sections.scene.length) {
      groups.push(
        <DropdownMenuGroup title={t("fontList.sceneFonts")} key="group_1">
          {sections.scene.map((font, index) => (
            <FontPickerListItem key={font.value} font={font} order={index} />
          ))}
        </DropdownMenuGroup>,
      );
      offset += sections.scene.length;
    }

    if (sections.library.length) {
      groups.push(
        <DropdownMenuGroup title={t("fontList.myFonts")} key="group_2">
          {sections.library.map((font, index) => (
            <FontPickerListItem
              key={font.value}
              font={font}
              order={index + offset}
            />
          ))}
        </DropdownMenuGroup>,
      );
      offset += sections.library.length;
    }

    if (sections.available.length) {
      groups.push(
        <DropdownMenuGroup title={t("fontList.builtInFonts")} key="group_3">
          {sections.available.map((font, index) => (
            <FontPickerListItem
              key={font.value}
              font={font}
              order={index + offset}
            />
          ))}
        </DropdownMenuGroup>,
      );
    }

    if (canManageLibrary && googleFonts.onBrowse) {
      groups.push(
        <DropdownMenuGroup key="group_browse">
          {!(googleFonts.libraryFonts ?? []).length && (
            <p className="FontPicker__empty-library">
              {t("fontList.emptyLibrary")}
            </p>
          )}
          <button
            type="button"
            className={getDropdownMenuItemClassName()}
            data-testid="font-picker-browse"
            onClick={() => googleFonts.onBrowse?.()}
          >
            <MenuItemContent icon={searchIcon}>
              {t("fontList.browse")}
            </MenuItemContent>
          </button>
        </DropdownMenuGroup>,
      );
    }

    return (
      <PropertiesPopover
        className="properties-content"
        container={container}
        style={{ width: "15rem" }}
        onClose={() => {
          onClose();

          // Refocus text editor when font picker closes if we were editing text
          if (app.state.editingTextElement) {
            setTimeout(() => {
              const textEditor = document.querySelector(
                ".excalidraw-wysiwyg",
              ) as HTMLTextAreaElement;
              if (textEditor) {
                textEditor.focus();
              }
            }, 0);
          }
        }}
        onPointerLeave={onLeave}
        onKeyDown={onKeyDown}
        preventAutoFocusOnTouch={!!app.state.editingTextElement}
      >
        {(stylesPanelMode === "full" ||
          !!googleFonts?.libraryFonts?.length) && (
          <QuickSearch
            ref={inputRef}
            placeholder={t("quickSearch.placeholder")}
            onChange={debounce(setSearchTerm, 20)}
          />
        )}
        <ScrollableList
          className="dropdown-menu fonts manual-hover"
          placeholder={t("fontList.empty")}
        >
          {groups.length ? groups : null}
        </ScrollableList>
        {googleFonts?.upgradeAction && (
          <div className="FontPicker__upgrade-action">
            {googleFonts.upgradeAction}
          </div>
        )}
      </PropertiesPopover>
    );
  },
  (prev, next) =>
    prev.googleFonts === next.googleFonts &&
    prev.selectedFontFamily === next.selectedFontFamily &&
    prev.hoveredFontFamily === next.hoveredFontFamily,
);
