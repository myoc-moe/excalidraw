import { toGoogleFontFamily } from "@excalidraw/common";
import { vi } from "vitest";

import {
  resetGoogleFontSourceFailures,
  setGoogleFontCssSources,
} from "./googleFonts";

import { Fonts } from "./Fonts";

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
    setGoogleFontCssSources(undefined);
    resetGoogleFontSourceFailures();
  });
});
