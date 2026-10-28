import { toGoogleFontFamily } from "@excalidraw/common";
import { vi } from "vitest";

import {
  resetGoogleFontSourceFailures,
  setGoogleFontCssSources,
} from "./googleFonts";

import { Fonts, fontFaceCoversWeight } from "./Fonts";

describe("Google Fonts registration retry", () => {
  it("keeps the scene family and retries after the CSS request fails", async () => {
    const fontFamily = toGoogleFontFamily("Retry Font");
    const element = {
      type: "text",
      fontFamily,
      text: "Retry me",
      originalText: "Retry me",
    } as any;
    const css = `
      @font-face {
        font-family: 'Retry Font';
        font-style: normal;
        font-weight: 400;
        src: url(https://fonts.gstatic.com/s/retryfont/v1/regular.woff2) format('woff2');
        unicode-range: U+0000-00FF;
      }
    `;
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({
        ok: true,
        text: async () => css,
      } as Response);
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await Fonts.loadElementsFonts([element]);

    expect(element.fontFamily).toBe(fontFamily);
    expect(Fonts.registered.has(fontFamily)).toBe(false);

    await Fonts.loadElementsFonts([element]);

    expect(Fonts.registered.has(fontFamily)).toBe(true);
    expect(element.fontFamily).toBe(fontFamily);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    fetchMock.mockRestore();
    consoleError.mockRestore();
  });
});

describe("Google Fonts weights and sources", () => {
  const css = (name: string) => `
    @font-face {
      font-family: '${name}';
      font-style: normal;
      font-weight: 400;
      src: url(https://fonts.gstatic.com/s/${name}/v1/regular.woff2) format('woff2');
    }
  `;

  it("registers each weight of a family as its own face", async () => {
    const regular = toGoogleFontFamily("Weighted");
    const bold = toGoogleFontFamily("Weighted@700");
    const elements = [regular, bold].map(
      (fontFamily) =>
        ({
          type: "text",
          fontFamily,
          text: "A",
          originalText: "A",
        } as any),
    );
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(
        async () =>
          ({ ok: true, text: async () => css("weighted") } as Response),
      );

    await Fonts.loadElementsFonts(elements);

    const regularFaces = Fonts.registered.get(regular)!.fontFaces;
    const boldFaces = Fonts.registered.get(bold)!.fontFaces;
    expect(regularFaces[0].fontFace).not.toBe(boldFaces[0].fontFace);
    expect(regularFaces[0].fontFace.family).not.toBe(
      boldFaces[0].fontFace.family,
    );
    expect(
      fetchMock.mock.calls.map(([url]) =>
        new URL(String(url)).searchParams.get("family"),
      ),
    ).toEqual(
      expect.arrayContaining(["Weighted:wght@400", "Weighted:wght@700"]),
    );

    fetchMock.mockRestore();
  });

  it("retries a family with the next source when its faces fail to load", async () => {
    resetGoogleFontSourceFailures();
    setGoogleFontCssSources(() => [
      "https://relay.example.com/css2",
      "https://fonts.googleapis.com/css2",
    ]);
    const fontFamily = toGoogleFontFamily("Face Fallback");
    const element = {
      type: "text",
      fontFamily,
      text: "A",
      originalText: "A",
    } as any;
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(
        async () => ({ ok: true, text: async () => css("fb") } as Response),
      );
    const fonts = document.fonts as any;
    fonts.delete = vi.fn();
    const check = vi.spyOn(fonts, "check").mockReturnValue(false);
    const load = vi
      .spyOn(fonts, "load")
      .mockRejectedValueOnce(new Error("face failed"))
      .mockResolvedValue([]);
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    // no face loads, so the weight fallback is logged
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await Fonts.loadElementsFonts([element]);

    expect(load).toHaveBeenCalledTimes(2);
    expect(
      fetchMock.mock.calls.map(([url]) => new URL(String(url)).origin),
    ).toEqual(["https://relay.example.com", "https://fonts.googleapis.com"]);
    expect(Fonts.registered.has(fontFamily)).toBe(true);

    fetchMock.mockRestore();
    check.mockRestore();
    load.mockRestore();
    consoleError.mockRestore();
    consoleWarn.mockRestore();
    setGoogleFontCssSources(undefined);
    resetGoogleFontSourceFailures();
  });
});

describe("Google font weight fallback log", () => {
  it("reads single, named and variable face weights", () => {
    expect(fontFaceCoversWeight("700", 700)).toBe(true);
    expect(fontFaceCoversWeight("400", 700)).toBe(false);
    expect(fontFaceCoversWeight("bold", 700)).toBe(true);
    expect(fontFaceCoversWeight("normal", 400)).toBe(true);
    expect(fontFaceCoversWeight("100 900", 500)).toBe(true);
    expect(fontFaceCoversWeight("100 400", 500)).toBe(false);
  });

  const loadWith = async (name: string, loaded: Partial<FontFace>[]) => {
    const fontFamily = toGoogleFontFamily(`${name}@700`);
    const element = {
      type: "text",
      fontFamily,
      text: "A",
      originalText: "A",
    } as any;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        ({
          ok: true,
          text: async () => `
            @font-face {
              font-family: '${name}';
              font-weight: 700;
              src: url(https://fonts.gstatic.com/s/${name}/v1/bold.woff2) format('woff2');
            }
          `,
        } as Response),
    );
    const fonts = document.fonts as any;
    const check = vi.spyOn(fonts, "check").mockReturnValue(false);
    const load = vi.spyOn(fonts, "load").mockResolvedValue(loaded);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await Fonts.loadElementsFonts([element]);
    const messages = warn.mock.calls.map(([message]) => String(message));

    fetchMock.mockRestore();
    check.mockRestore();
    load.mockRestore();
    warn.mockRestore();
    return messages;
  };

  it("logs nothing when the face of the weight loads", async () => {
    expect(await loadWith("Has Bold", [{ weight: "700" }])).toEqual([]);
  });

  it("logs when only another weight loads", async () => {
    expect(await loadWith("Only Regular", [{ weight: "400" }])).toEqual([
      'Google font "google:Only Regular@700" has no 700 face; text uses weight 400',
    ]);
  });

  it("logs when no face loads", async () => {
    expect(await loadWith("No Face", [])).toEqual([
      'Google font "google:No Face@700" loaded no face; text uses a fallback font',
    ]);
  });
});
