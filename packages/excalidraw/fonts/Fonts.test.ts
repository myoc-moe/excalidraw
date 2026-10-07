import { toGoogleFontFamily } from "@excalidraw/common";
import { vi } from "vitest";

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
