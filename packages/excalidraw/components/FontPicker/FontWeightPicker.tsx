import clsx from "clsx";
import { useEffect } from "react";

import { getFontFamilyString } from "@excalidraw/common";

import type { FontFamilyValues } from "@excalidraw/element/types";

import {
  DEFAULT_GOOGLE_FONT_WEIGHT,
  formatGoogleFontId,
  parseGoogleFontId,
} from "../../fonts/googleFonts";
import { t } from "../../i18n";
import { RadioSelection } from "../RadioSelection";
import { useApp } from "../App";

import type enLocale from "../../locales/en.json";
import type { GoogleFontsConfig } from "../../types";

type WeightNameKey = Exclude<keyof typeof enLocale["fontWeight"], "more">;

const WEIGHT_NAME_KEYS: Record<number, WeightNameKey> = {
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
  return key ? t(`fontWeight.${key}`) : String(weight);
};

/** 400 if present, else the lowest weight. */
export const pickDefaultWeight = (weights: readonly number[]) =>
  weights.includes(DEFAULT_GOOGLE_FONT_WEIGHT)
    ? DEFAULT_GOOGLE_FONT_WEIGHT
    : weights.length
    ? Math.min(...weights)
    : DEFAULT_GOOGLE_FONT_WEIGHT;

/**
 * Switching family keeps the current weight if the picked family has it
 * added, otherwise the picked (default) weight stays; scene entries are
 * applied as listed.
 */
export const mapPickedFontFamily = (
  picked: FontFamilyValues,
  current: FontFamilyValues | null,
  libraryFonts: GoogleFontsConfig["libraryFonts"] | undefined,
  sceneFamilies: readonly FontFamilyValues[],
) => {
  const pickedId = parseGoogleFontId(picked);
  const currentId = parseGoogleFontId(current);
  if (
    !pickedId ||
    !currentId ||
    pickedId.family === currentId.family ||
    sceneFamilies.includes(picked)
  ) {
    return picked;
  }
  const pickedLibraryFont = libraryFonts?.find(
    (font) => font.family === pickedId.family,
  );
  return pickedLibraryFont &&
    pickedId.weight === pickDefaultWeight(pickedLibraryFont.weights) &&
    pickedLibraryFont.weights.includes(currentId.weight)
    ? formatGoogleFontId(pickedId.family, currentId.weight)
    : picked;
};

/**
 * The weight row of the selected Google family. Plans that can't apply Google
 * fonts (or disabled library entries) get no row (`weights` is `undefined`).
 */
export const getGoogleFontWeightRow = (
  selection: {
    fontFamily: FontFamilyValues | null;
    googleFamily: string | null;
  },
  googleFonts: GoogleFontsConfig | undefined,
) => {
  const family = selection.googleFamily;
  const libraryFont =
    family && googleFonts?.canApplyGoogleFonts
      ? googleFonts.libraryFonts.find(
          (font) => font.family === family && font.enabled,
        )
      : undefined;
  return {
    family,
    weights: libraryFont?.weights,
    selectedWeight: parseGoogleFontId(selection.fontFamily)?.weight ?? null,
  };
};

interface FontWeightPickerProps {
  family: string;
  /** weights added to the library for the family */
  weights: readonly number[];
  /** `null` when the selection has mixed weights */
  selectedWeight: number | null;
  onSelect: (weight: number) => void;
  /** shows a "More weights…" link in the `row` variant */
  onEditWeights?: (family: string) => void;
  /**
   * `row`: weight names under the font picker (full panel).
   * `section`: a "Weight" section of numbers, like the font size section
   * (compact text properties popover).
   */
  variant?: "row" | "section";
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
  variant = "row",
}: FontWeightPickerProps) => {
  const { fonts } = useApp();
  const sortedWeights = [...weights].sort((a, b) => a - b);
  const weightsKey = sortedWeights.join(",");

  // so each option can render in its own weight
  useEffect(() => {
    for (const weight of sortedWeights) {
      const fontId = formatGoogleFontId(family, weight);
      fonts
        .loadFontFamily(fontId, getFontWeightLabel(weight))
        .catch((error) => {
          console.error(`Failed to load font weight "${fontId}"`, error);
        });
    }
    // `sortedWeights` is a fresh array each render, `weightsKey` stands in for it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fonts, family, weightsKey]);

  if (sortedWeights.length < 2) {
    return null;
  }

  const getOptionFontFamily = (weight: number) =>
    getFontFamilyString({
      fontFamily: formatGoogleFontId(family, weight),
    });

  const moreButton = onEditWeights && (
    <button
      type="button"
      className="FontWeightPicker__more"
      data-testid="font-weight-more"
      onClick={() => onEditWeights(family)}
    >
      {t("fontWeight.more")}
    </button>
  );

  if (variant === "section") {
    return (
      <fieldset
        onKeyDown={stopArrowKeys}
        className="FontWeightPicker FontWeightPicker--section"
        data-testid="font-weight-picker"
      >
        <legend>{t("labels.fontWeight")}</legend>
        <div className="buttonList">
          <RadioSelection
            group="font-weight"
            options={sortedWeights.map((weight) => ({
              value: weight,
              text: getFontWeightLabel(weight),
              icon: <span className="FontWeightPicker__number">{weight}</span>,
              testId: `font-weight-${weight}`,
            }))}
            value={selectedWeight}
            onChange={onSelect}
          />
        </div>
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
      {moreButton}
    </fieldset>
  );
};
