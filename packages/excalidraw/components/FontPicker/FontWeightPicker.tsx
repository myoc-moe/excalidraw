import { Popover } from "radix-ui";
import clsx from "clsx";
import { useEffect, useState } from "react";

import { getFontFamilyString } from "@excalidraw/common";

import {
  DEFAULT_GOOGLE_FONT_WEIGHT,
  formatGoogleFontId,
} from "../../fonts/googleFonts";
import { t } from "../../i18n";
import { useApp, useExcalidrawContainer } from "../App";
import { PropertiesPopover } from "../PropertiesPopover";

const WEIGHT_NAME_KEYS: Record<number, string> = {
  100: "thin",
  200: "extraLight",
  300: "light",
  400: "regular",
  500: "medium",
  600: "semiBold",
  700: "bold",
  800: "extraBold",
  900: "black",
};

const getFontWeightLabel = (weight: number) => {
  const key = WEIGHT_NAME_KEYS[weight];
  return key ? t(`fontWeight.${key}` as any) : String(weight);
};

/** 400 if present, else the lowest weight. */
export const pickDefaultWeight = (weights: readonly number[]) =>
  weights.includes(DEFAULT_GOOGLE_FONT_WEIGHT)
    ? DEFAULT_GOOGLE_FONT_WEIGHT
    : weights.length
    ? Math.min(...weights)
    : DEFAULT_GOOGLE_FONT_WEIGHT;

interface FontWeightPickerProps {
  family: string;
  /** weights added to the library for the family */
  weights: readonly number[];
  /** `null` when the selection has mixed weights */
  selectedWeight: number | null;
  onSelect: (weight: number) => void;
  onEditWeights?: (family: string) => void;
  compactMode?: boolean;
}

const isArrowKey = (key: string) =>
  key === "ArrowLeft" ||
  key === "ArrowRight" ||
  key === "ArrowUp" ||
  key === "ArrowDown";

/**
 * Excalidraw nudges the selection on arrow keys through a document level
 * listener; React's delegated `stopPropagation` keeps them from reaching it.
 */
const stopArrowKeys = (event: React.KeyboardEvent) => {
  if (isArrowKey(event.key)) {
    event.stopPropagation();
  }
};

export const FontWeightPicker = ({
  family,
  weights,
  selectedWeight,
  onSelect,
  onEditWeights,
  compactMode = false,
}: FontWeightPickerProps) => {
  const { fonts } = useApp();
  const { container } = useExcalidrawContainer();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const sortedWeights = [...weights].sort((a, b) => a - b);
  const weightsKey = sortedWeights.join(",");

  // so each option can render in its own weight
  useEffect(() => {
    for (const weight of weightsKey ? weightsKey.split(",").map(Number) : []) {
      const fontId = formatGoogleFontId(family, weight);
      fonts
        .loadFontFamily(fontId, getFontWeightLabel(weight))
        .catch((error) => {
          console.error(`Failed to load font weight "${fontId}"`, error);
        });
    }
  }, [fonts, family, weightsKey]);

  if (sortedWeights.length < 2) {
    return null;
  }

  const getOptionFontFamily = (weight: number) =>
    getFontFamilyString({
      fontFamily: formatGoogleFontId(family, weight),
    });

  if (compactMode) {
    return (
      <fieldset
        className="FontWeightPicker FontWeightPicker--compact"
        data-testid="font-weight-picker"
      >
        <Popover.Root open={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <Popover.Trigger asChild>
            <button
              type="button"
              className="FontWeightPicker__trigger"
              data-testid="font-weight-trigger"
              aria-label={
                selectedWeight !== null
                  ? `${t("labels.fontWeight")}: ${getFontWeightLabel(
                      selectedWeight,
                    )}`
                  : t("labels.fontWeight")
              }
              style={
                selectedWeight !== null
                  ? { fontFamily: getOptionFontFamily(selectedWeight) }
                  : undefined
              }
            >
              {selectedWeight !== null
                ? getFontWeightLabel(selectedWeight)
                : t("labels.fontWeight")}{" "}
              ▾
            </button>
          </Popover.Trigger>
          {isMenuOpen && (
            <PropertiesPopover
              onKeyDown={stopArrowKeys}
              className="FontWeightPicker__popover"
              container={container}
              onClose={() => {}}
            >
              <div className="FontWeightPicker__menu">
                {sortedWeights.map((weight) => (
                  <button
                    key={weight}
                    type="button"
                    className="FontWeightPicker__menu-item"
                    aria-pressed={weight === selectedWeight}
                    data-testid={`font-weight-${weight}`}
                    style={{ fontFamily: getOptionFontFamily(weight) }}
                    onClick={() => {
                      setIsMenuOpen(false);
                      onSelect(weight);
                    }}
                  >
                    <span>{getFontWeightLabel(weight)}</span>
                    {weight === selectedWeight && (
                      <span aria-hidden="true">✓</span>
                    )}
                  </button>
                ))}
                {onEditWeights && (
                  <>
                    <hr className="FontWeightPicker__divider" />
                    <button
                      type="button"
                      className="FontWeightPicker__menu-item"
                      data-testid="font-weight-more"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onEditWeights(family);
                      }}
                    >
                      {t("fontWeight.more")}
                    </button>
                  </>
                )}
              </div>
            </PropertiesPopover>
          )}
        </Popover.Root>
      </fieldset>
    );
  }

  return (
    <fieldset
      onKeyDown={stopArrowKeys}
      className="FontWeightPicker"
      data-testid="font-weight-picker"
    >
      <legend>{t("labels.fontWeight")}</legend>
      <div
        className="FontWeightPicker__options"
        role="group"
        aria-label={t("labels.fontWeight")}
      >
        {sortedWeights.map((weight) => (
          <button
            key={weight}
            type="button"
            className={clsx("FontWeightPicker__option", {
              active: weight === selectedWeight,
            })}
            aria-pressed={weight === selectedWeight}
            data-testid={`font-weight-${weight}`}
            style={{ fontFamily: getOptionFontFamily(weight) }}
            onClick={() => onSelect(weight)}
          >
            {getFontWeightLabel(weight)}
          </button>
        ))}
      </div>
      {onEditWeights && (
        <button
          type="button"
          className="FontWeightPicker__more"
          data-testid="font-weight-more"
          onClick={() => onEditWeights(family)}
        >
          {t("fontWeight.more")}
        </button>
      )}
    </fieldset>
  );
};
