import { vi } from "vitest";

import { ExcalidrawFontFace } from "./ExcalidrawFontFace";
import { getGoogleFontCssUrl, parseGoogleFontFaceCss } from "./googleFonts";

describe("Google Fonts CSS loader", () => {
  it("requests the regular family face from CSS2", () => {
    const url = getGoogleFontCssUrl("Open Sans");

    expect(url.origin).toBe("https://fonts.googleapis.com");
    expect(url.pathname).toBe("/css2");
    expect(url.searchParams.get("family")).toBe("Open Sans:wght@400");
    expect(url.searchParams.get("display")).toBe("swap");
  });

  it("parses WOFF2 faces and their unicode ranges", () => {
    const descriptors = parseGoogleFontFaceCss(`
      @font-face {
        font-family: 'Open Sans';
        font-style: normal;
        font-weight: 400;
        src: url(https://fonts.gstatic.com/s/opensans/v1/regular.woff2) format('woff2');
        unicode-range: U+0000-00FF, U+0131;
      }
    `);

    expect(descriptors).toEqual([
      {
        uri: "https://fonts.gstatic.com/s/opensans/v1/regular.woff2",
        mustEmbed: true,
        descriptors: {
          weight: "400",
          style: "normal",
          unicodeRange: "U+0000-00FF, U+0131",
        },
      },
    ]);
  });

  it("uses the FontFace CSS family serialization for SVG declarations", async () => {
    const fontFace = new ExcalidrawFontFace(
      "Open Sans",
      "https://fonts.gstatic.com/s/opensans/v1/regular.woff2",
      { unicodeRange: "U+0000-00FF" },
      true,
    );
    vi.spyOn(fontFace, "getContent").mockResolvedValue(
      "data:font/woff2;base64,AA==",
    );

    await expect(fontFace.toCSS("A")).resolves.toBe(
      `@font-face { font-family: ${fontFace.fontFace.family}; src: url(data:font/woff2;base64,AA==); }`,
    );
  });

  it("omits a Google face from SVG when its font asset cannot be fetched", async () => {
    const fontFace = new ExcalidrawFontFace(
      "Open Sans",
      "https://fonts.gstatic.com/s/opensans/v1/regular.woff2",
      { unicodeRange: "U+0000-00FF" },
      true,
    );
    const fetchFont = vi
      .spyOn(fontFace, "fetchFont")
      .mockRejectedValue(new Error("offline"));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await expect(fontFace.toCSS("A")).resolves.toBe("");

    fetchFont.mockRestore();
    consoleError.mockRestore();
  });
});
