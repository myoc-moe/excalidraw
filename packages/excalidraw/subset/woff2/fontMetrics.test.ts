import { parseSfntFontMetrics } from "./fontMetrics";

const createSfntWithMetrics = () => {
  const headOffset = 44;
  const hheaOffset = 72;
  const sfnt = new Uint8Array(hheaOffset + 10);
  const view = new DataView(sfnt.buffer);

  view.setUint16(4, 2);
  sfnt.set([104, 101, 97, 100], 12);
  view.setUint32(20, headOffset);
  view.setUint32(24, 54);
  sfnt.set([104, 104, 101, 97], 28);
  view.setUint32(36, hheaOffset);
  view.setUint32(40, 36);
  view.setUint16(headOffset + 18, 2048);
  view.setInt16(hheaOffset + 4, 1900);
  view.setInt16(hheaOffset + 6, -500);
  view.setInt16(hheaOffset + 8, 100);

  return sfnt;
};

describe("parseSfntFontMetrics", () => {
  it("reads unitsPerEm and hhea metrics from the font tables", () => {
    expect(parseSfntFontMetrics(createSfntWithMetrics())).toEqual({
      unitsPerEm: 2048,
      ascender: 1900,
      descender: -500,
      lineGap: 100,
      lineHeight: 2500 / 2048,
    });
  });

  it("rejects fonts without required metric tables", () => {
    expect(() => parseSfntFontMetrics(new Uint8Array(64))).toThrow(
      "Font is missing OpenType head or hhea metrics",
    );
  });
});
