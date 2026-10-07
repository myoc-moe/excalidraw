import { ExcalidrawFontFace } from "./ExcalidrawFontFace";

import type { ExcalidrawFontFaceDescriptor } from "./Fonts";

const GOOGLE_FONTS_CSS_URL = "https://fonts.googleapis.com/css2";

export const getGoogleFontCssUrl = (family: string) => {
  const url = new URL(GOOGLE_FONTS_CSS_URL);
  url.searchParams.set("family", `${family}:wght@400`);
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

export const loadGoogleFontFaces = async (family: string) => {
  const response = await fetch(getGoogleFontCssUrl(family), {
    cache: "force-cache",
    headers: { Accept: "text/css" },
  });

  if (!response.ok) {
    throw new Error(
      `Google Fonts CSS request failed for "${family}": ${response.status} ${response.statusText}`,
    );
  }

  const descriptors = parseGoogleFontFaceCss(await response.text());
  if (!descriptors.length) {
    throw new Error(`Google Fonts returned no WOFF2 faces for "${family}"`);
  }

  return descriptors.map(
    ({ uri, descriptors, mustEmbed }) =>
      new ExcalidrawFontFace(family, uri, descriptors, mustEmbed),
  );
};
