import { getFontString } from "@excalidraw/common";
import { vi } from "vitest";

import { ExcalidrawFontFace } from "./ExcalidrawFontFace";
import {
  formatGoogleFontId,
  getGoogleFontCssUrl,
  loadGoogleFontFaces,
  parseGoogleFontFaceCss,
  parseGoogleFontId,
  resetGoogleFontSourceFailures,
  setGoogleFontCssSources,
} from "./googleFonts";

describe("Google Fonts CSS loader", () => {
  it("requests the regular family face from CSS2", () => {
    const url = getGoogleFontCssUrl("Open Sans");

    expect(url.origin).toBe("https://fonts.googleapis.com");
    expect(url.pathname).toBe("/css2");
    expect(url.searchParams.get("family")).toBe("Open Sans:wght@400");
    expect(url.searchParams.get("display")).toBe("swap");
  });

  it("requests the weight from CSS2 and uses a host source", () => {
    const url = getGoogleFontCssUrl(
      "Montserrat",
      700,
      "https://fonts.example.com/fonts/google/css2",
    );

    expect(url.origin).toBe("https://fonts.example.com");
    expect(url.searchParams.get("family")).toBe("Montserrat:wght@700");
  });

  it("parses and formats font ids with an optional weight", () => {
    expect(parseGoogleFontId("google:Montserrat")).toEqual({
      family: "Montserrat",
      weight: 400,
    });
    expect(parseGoogleFontId("google:Montserrat@700")).toEqual({
      family: "Montserrat",
      weight: 700,
    });
    expect(parseGoogleFontId("google:Open Sans@300")).toEqual({
      family: "Open Sans",
      weight: 300,
    });
    expect(parseGoogleFontId(5)).toBeNull();
    expect(formatGoogleFontId("Montserrat")).toBe("google:Montserrat");
    expect(formatGoogleFontId("Montserrat", 400)).toBe("google:Montserrat");
    expect(formatGoogleFontId("Montserrat", 700)).toBe("google:Montserrat@700");
  });

  it("registers each weight as its own CSS family", async () => {
    const css = (weight: number) =>
      `@font-face { font-family: 'X'; font-style: normal; font-weight: ${weight}; src: url(https://fonts.gstatic.com/s/x/v1/${weight}.woff2) format('woff2'); }`;
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) => {
        return { ok: true, text: async () => css(400) } as Response;
      });

    const regular = await loadGoogleFontFaces("google:Weighty");
    const bold = await loadGoogleFontFaces("google:Weighty@700");

    expect(regular.fontFaces[0].fontFace.family).toBe("Weighty");
    expect(bold.fontFaces[0].fontFace.family).toBe('"Weighty@700"');
    expect(
      new URL(String(fetchMock.mock.calls[1][0])).searchParams.get("family"),
    ).toBe("Weighty:wght@700");

    fetchMock.mockRestore();
  });

  it("falls back to the next source and remembers the failed one", async () => {
    resetGoogleFontSourceFailures();
    setGoogleFontCssSources(() => [
      "https://relay.example.com/css2",
      "https://fonts.googleapis.com/css2",
    ]);
    const css = `@font-face { font-family: 'Fb'; src: url(https://fonts.gstatic.com/s/fb/v1/a.woff2) format('woff2'); }`;
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) =>
        new URL(String(input)).origin === "https://relay.example.com"
          ? ({ ok: false, status: 502, statusText: "Bad" } as Response)
          : ({ ok: true, text: async () => css } as Response),
      );

    const first = await loadGoogleFontFaces("google:Fb One");
    expect(first.source).toBe("https://fonts.googleapis.com/css2");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await loadGoogleFontFaces("google:Fb Two");
    // the next family goes straight to the second source
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(new URL(String(fetchMock.mock.calls[2][0])).origin).toBe(
      "https://fonts.googleapis.com",
    );

    fetchMock.mockRestore();
    setGoogleFontCssSources(undefined);
    resetGoogleFontSourceFailures();
  });

  it("does not skip a source for other families after a 4xx", async () => {
    resetGoogleFontSourceFailures();
    setGoogleFontCssSources(() => [
      "https://relay.example.com/css2",
      "https://fonts.googleapis.com/css2",
    ]);
    const css = `@font-face { font-family: 'Fb'; src: url(https://fonts.gstatic.com/s/fb/v1/a.woff2) format('woff2'); }`;
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) => {
        const url = new URL(String(input));
        return url.origin === "https://relay.example.com" &&
          url.searchParams.get("family")!.startsWith("Fam A")
          ? ({ ok: false, status: 400, statusText: "Bad" } as Response)
          : ({ ok: true, text: async () => css } as Response);
      });

    const a = await loadGoogleFontFaces("google:Fam A");
    expect(a.source).toBe("https://fonts.googleapis.com/css2");
    const b = await loadGoogleFontFaces("google:Fam B");
    expect(b.source).toBe("https://relay.example.com/css2");

    fetchMock.mockRestore();
    setGoogleFontCssSources(undefined);
    resetGoogleFontSourceFailures();
  });

  it("embeds the face of the requested weight under the renderer's family", async () => {
    const fontId = "google:Embed X@700";
    const css = (w: number) =>
      `@font-face { font-family: 'Embed X'; font-weight: ${w}; src: url(https://fonts.gstatic.com/s/embedx/v1/${w}.woff2) format('woff2'); }`;
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) => {
        const family = new URL(String(input)).searchParams.get("family")!;
        const weight = Number(family.split("wght@")[1]);
        return { ok: true, text: async () => css(weight) } as Response;
      });

    const { fontFaces } = await loadGoogleFontFaces(fontId);
    expect(fontFaces).toHaveLength(1);
    expect(fontFaces[0].urls.map(String)).toEqual([
      "https://fonts.gstatic.com/s/embedx/v1/700.woff2",
    ]);

    vi.spyOn(fontFaces[0], "getContent").mockResolvedValue(
      "data:font/woff2;base64,AA==",
    );
    const fontString = getFontString({ fontFamily: fontId, fontSize: 20 });
    expect(fontString.startsWith('20px "Embed X@700", ')).toBe(true);
    const rendererFamily = '"Embed X@700"';
    await expect(fontFaces[0].toCSS("A")).resolves.toBe(
      `@font-face { font-family: ${rendererFamily}; src: url(data:font/woff2;base64,AA==); }`,
    );

    fetchMock.mockRestore();
  });

  it("quotes family names in font strings", () => {
    // `document.fonts.check` rejects unquoted names with a word that is not an
    // identifier, such as "2P".
    expect(
      getFontString({ fontFamily: "google:Press Start 2P", fontSize: 10 }),
    ).toMatch(/^10px "Press Start 2P", /);
    expect(
      getFontString({ fontFamily: 'google:Odd"Name\\', fontSize: 10 }),
    ).toMatch(/^10px "Odd\\"Name\\\\", /);
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

  it("resolves relative srcs against the CSS URL and keeps absolute ones", () => {
    const css = `
      @font-face {
        font-weight: 400;
        src: url(/fonts/google/files/s/x/v1/a.woff2) format('woff2');
      }
      @font-face {
        font-weight: 700;
        src: url(https://fonts.gstatic.com/s/x/v1/b.woff2) format('woff2');
      }
      @font-face {
        font-weight: 900;
        src: url(/fonts/google/files/s/x/v1/c.woff) format('woff');
      }
    `;
    const base = "https://relay.example.com/fonts/google/css2?family=X";

    expect(parseGoogleFontFaceCss(css, base).map((d) => d.uri)).toEqual([
      "https://relay.example.com/fonts/google/files/s/x/v1/a.woff2",
      "https://fonts.gstatic.com/s/x/v1/b.woff2",
    ]);
    // no base: relative srcs are skipped, absolute ones are unchanged
    expect(parseGoogleFontFaceCss(css).map((d) => d.uri)).toEqual([
      "https://fonts.gstatic.com/s/x/v1/b.woff2",
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
