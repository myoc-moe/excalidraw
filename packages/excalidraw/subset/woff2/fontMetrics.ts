export interface Woff2FontMetrics {
  unitsPerEm: number;
  ascender: number;
  descender: number;
  lineGap: number;
  lineHeight: number;
}

export const parseSfntFontMetrics = (sfnt: Uint8Array): Woff2FontMetrics => {
  const view = new DataView(sfnt.buffer, sfnt.byteOffset, sfnt.byteLength);
  const tableCount = view.getUint16(4);
  const tables = new Map<string, { offset: number; length: number }>();

  for (let index = 0; index < tableCount; index++) {
    const offset = 12 + index * 16;
    const tag = String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3),
    );
    tables.set(tag, {
      offset: view.getUint32(offset + 8),
      length: view.getUint32(offset + 12),
    });
  }

  const head = tables.get("head");
  const hhea = tables.get("hhea");
  if (!head || !hhea || head.length < 20 || hhea.length < 10) {
    throw new Error("Font is missing OpenType head or hhea metrics");
  }

  const unitsPerEm = view.getUint16(head.offset + 18);
  const ascender = view.getInt16(hhea.offset + 4);
  const descender = view.getInt16(hhea.offset + 6);
  const lineGap = view.getInt16(hhea.offset + 8);
  const lineHeight = (ascender - descender + lineGap) / unitsPerEm;

  if (
    !unitsPerEm ||
    !Number.isFinite(lineHeight) ||
    lineHeight <= 0 ||
    !ascender
  ) {
    throw new Error("Font contains invalid OpenType metrics");
  }

  return { unitsPerEm, ascender, descender, lineGap, lineHeight };
};
