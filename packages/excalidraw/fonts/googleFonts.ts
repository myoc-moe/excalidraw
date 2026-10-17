import {
  getGoogleFontFamilyName,
  isGoogleFontFamily,
  toGoogleFontFamily,
} from "@excalidraw/common";

import type { GoogleFontFamily } from "@excalidraw/common";

import { ExcalidrawFontFace } from "./ExcalidrawFontFace";

import type { ExcalidrawFontFaceDescriptor } from "./Fonts";

const GOOGLE_FONTS_CSS_URL = "https://fonts.googleapis.com/css2";

export const DEFAULT_GOOGLE_FONT_WEIGHT = 400;

/**
 * Font id format: `google:<Family>@<weight>`; no suffix means 400.
 * Returns `null` if the id is not a Google font id.
 */
export const parseGoogleFontId = (
  fontId: unknown,
): { family: string; weight: number } | null => {
  if (!isGoogleFontFamily(fontId)) {
    return null;
  }

  const name = getGoogleFontFamilyName(fontId);
  const match = name.match(/^(.+)@(\d{1,4})$/);
  if (!match) {
    return { family: name, weight: DEFAULT_GOOGLE_FONT_WEIGHT };
  }

  return { family: match[1], weight: Number(match[2]) };
};

export const formatGoogleFontId = (
  family: string,
  weight: number = DEFAULT_GOOGLE_FONT_WEIGHT,
): GoogleFontFamily =>
  toGoogleFontFamily(
    weight === DEFAULT_GOOGLE_FONT_WEIGHT ? family : `${family}@${weight}`,
  );

type GoogleFontCssSources = (family: string) => readonly string[];

let cssSources: GoogleFontCssSources | undefined;

// CSS sources that failed during this session; later families skip them
const failedCssSources = new Set<string>();

/**
 * Host-provided CSS2 base URLs per family, tried in order. The `family` and
 * `display` params are set by the fork. `undefined` restores the default.
 */
export const setGoogleFontCssSources = (
  sources: GoogleFontCssSources | undefined,
) => {
  cssSources = sources;
};

const getCssSources = (family: string) => {
  const sources = cssSources?.(family);
  return sources?.length ? sources : [GOOGLE_FONTS_CSS_URL];
};

/** Sources not yet failed this session; all of them if every one failed. */
const getAvailableCssSources = (family: string) => {
  const sources = getCssSources(family);
  const available = sources.filter((source) => !failedCssSources.has(source));
  return available.length ? available : sources;
};

/**
 * Marks a source as failed for the session.
 * Returns `true` if the family has another source left to try.
 */
export const markGoogleFontSourceFailed = (family: string, source: string) => {
  failedCssSources.add(source);
  return getCssSources(family).some((x) => !failedCssSources.has(x));
};

export const resetGoogleFontSourceFailures = () => {
  failedCssSources.clear();
};

export const getGoogleFontCssUrl = (
  family: string,
  weight: number = DEFAULT_GOOGLE_FONT_WEIGHT,
  source: string = GOOGLE_FONTS_CSS_URL,
) => {
  const url = new URL(source);
  url.searchParams.set("family", `${family}:wght@${weight}`);
  url.searchParams.set("display", "swap");
  return url;
};

const getCssProperty = (css: string, property: string) => {
  const match = css.match(
    new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, "i"),
  );
  return match?.[1]?.trim();
};

export const parseGoogleFontFaceCss = (
  css: string,
): ExcalidrawFontFaceDescriptor[] => {
  const descriptors: ExcalidrawFontFaceDescriptor[] = [];
  const fontFaceRegex = /@font-face\s*\{([^}]+)\}/gi;
  let match: RegExpExecArray | null;

  while ((match = fontFaceRegex.exec(css))) {
    const body = match[1];
    const src = getCssProperty(body, "src");
    const url = src?.match(/url\((['"]?)(https?:\/\/[^'")]+)\1\)/i)?.[2];

    if (!url || !url.endsWith(".woff2")) {
      continue;
    }

    const weight = getCssProperty(body, "font-weight") || "400";
    const style = getCssProperty(body, "font-style") || "normal";
    const unicodeRange = getCssProperty(body, "unicode-range");

    descriptors.push({
      uri: url,
      mustEmbed: true,
      descriptors: {
        weight,
        style,
        ...(unicodeRange ? { unicodeRange } : {}),
      },
    });
  }

  return descriptors;
};

/** CSS family name the faces are registered under (matches the renderer's). */
const getInternalCssFamily = (fontId: GoogleFontFamily) => {
  const name = getGoogleFontFamilyName(fontId);
  // names such as `Montserrat@700` are not a valid unquoted CSS identifier
  return /^[\p{L}\p{N}_ -]+$/u.test(name) ? name : JSON.stringify(name);
};

/** Whether a failure says the source itself is unhealthy (vs. this family). */
class SourceFailure extends Error {}

const fetchGoogleFontFaces = async (
  fontId: GoogleFontFamily,
  family: string,
  weight: number,
  source: string,
) => {
  let response: Response;
  try {
    response = await fetch(getGoogleFontCssUrl(family, weight, source), {
      cache: "force-cache",
      headers: { Accept: "text/css" },
    });
  } catch (error) {
    // network error
    throw new SourceFailure(String(error), { cause: error });
  }

  if (!response.ok) {
    const ErrorType =
      response.status >= 500 || response.status === 429 ? SourceFailure : Error;
    throw new ErrorType(
      `Google Fonts CSS request failed for "${fontId}": ${response.status} ${response.statusText}`,
    );
  }

  const descriptors = parseGoogleFontFaceCss(await response.text());
  if (!descriptors.length) {
    throw new Error(`Google Fonts returned no WOFF2 faces for "${fontId}"`);
  }

  const cssFamily = getInternalCssFamily(fontId);
  return descriptors.map(
    ({ uri, descriptors, mustEmbed }) =>
      new ExcalidrawFontFace(cssFamily, uri, descriptors, mustEmbed),
  );
};

/**
 * Loads the faces of a Google font id, trying the CSS sources in order.
 * A source that fails with a network error, 5xx or 429 is skipped for the
 * rest of the session; other errors only make this family try the next source.
 */
export const loadGoogleFontFaces = async (fontId: GoogleFontFamily) => {
  const { family, weight } = parseGoogleFontId(fontId)!;

  let lastError: unknown;
  for (const source of getAvailableCssSources(family)) {
    try {
      const fontFaces = await fetchGoogleFontFaces(
        fontId,
        family,
        weight,
        source,
      );
      return { fontFaces, source };
    } catch (error) {
      lastError = error;
      if (error instanceof SourceFailure) {
        failedCssSources.add(source);
      }
    }
  }

  throw lastError;
};
