import { packBlocksMaxRects } from "../arrange-algorithms/maxRects";
import {
  GrowingPacker,
  type Block as LegacyBlock,
} from "../arrange-algorithms/packer";

type TestBlock = {
  id: string;
  w: number;
  h: number;
  fit?: {
    x: number;
    y: number;
  } | null;
};

const createBlocks = (
  sizes: readonly {
    w: number;
    h: number;
  }[],
): TestBlock[] =>
  sizes.map((size, index) => ({
    id: `block-${index}`,
    w: size.w,
    h: size.h,
    fit: null,
  }));

const createLegacyBlocks = (
  sizes: readonly {
    w: number;
    h: number;
  }[],
): (LegacyBlock & { id: string })[] =>
  sizes.map((size, index) => ({
    id: `block-${index}`,
    w: size.w,
    h: size.h,
    fit: null,
  }));

const getBounds = (blocks: readonly TestBlock[]) => {
  const placedBlocks = blocks.filter((block) => block.fit);
  if (placedBlocks.length === 0) {
    return null;
  }

  return placedBlocks.reduce(
    (bounds, block) => ({
      minX: Math.min(bounds.minX, block.fit!.x),
      minY: Math.min(bounds.minY, block.fit!.y),
      maxX: Math.max(bounds.maxX, block.fit!.x + block.w),
      maxY: Math.max(bounds.maxY, block.fit!.y + block.h),
    }),
    {
      minX: placedBlocks[0].fit!.x,
      minY: placedBlocks[0].fit!.y,
      maxX: placedBlocks[0].fit!.x + placedBlocks[0].w,
      maxY: placedBlocks[0].fit!.y + placedBlocks[0].h,
    },
  );
};

const getPackedArea = (blocks: readonly TestBlock[]) => {
  const bounds = getBounds(blocks);
  return bounds ? (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY) : 0;
};

const getCenterSpread = (blocks: readonly TestBlock[]) => {
  const bounds = getBounds(blocks);
  if (!bounds) {
    return 0;
  }

  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;

  return blocks.reduce((spread, block) => {
    if (!block.fit) {
      return spread;
    }

    const blockCenterX = block.fit.x + block.w / 2;
    const blockCenterY = block.fit.y + block.h / 2;
    return (
      spread +
      Math.abs(blockCenterX - centerX) +
      Math.abs(blockCenterY - centerY)
    );
  }, 0);
};

const rectanglesOverlap = (a: TestBlock, b: TestBlock) =>
  a.fit &&
  b.fit &&
  a.fit.x < b.fit.x + b.w &&
  a.fit.x + a.w > b.fit.x &&
  a.fit.y < b.fit.y + b.h &&
  a.fit.y + a.h > b.fit.y;

describe("arrange packers", () => {
  const mixedSizes = [
    { w: 180, h: 120 },
    { w: 150, h: 110 },
    { w: 130, h: 90 },
    { w: 90, h: 160 },
    { w: 80, h: 140 },
    { w: 70, h: 70 },
    { w: 60, h: 60 },
    { w: 50, h: 110 },
  ] as const;

  it.each(["best-area-fit", "center-distance"] as const)(
    "packs without overlaps using %s",
    (heuristic) => {
      const blocks = createBlocks(mixedSizes);

      expect(
        packBlocksMaxRects(blocks, {
          gap: 16,
          heuristic,
        }),
      ).not.toBeNull();
      expect(blocks.every((block) => block.fit)).toBe(true);

      for (let i = 0; i < blocks.length; i++) {
        for (let j = i + 1; j < blocks.length; j++) {
          expect(rectanglesOverlap(blocks[i], blocks[j])).toBe(false);
        }
      }
    },
  );

  it("keeps blocks closer to the layout center when using the center heuristic", () => {
    const areaBlocks = createBlocks(mixedSizes);
    const centerBlocks = createBlocks(mixedSizes);

    packBlocksMaxRects(areaBlocks, {
      gap: 16,
      heuristic: "best-area-fit",
    });
    packBlocksMaxRects(centerBlocks, {
      gap: 16,
      heuristic: "center-distance",
    });

    expect(getCenterSpread(centerBlocks)).toBeLessThan(
      getCenterSpread(areaBlocks),
    );
  });

  it("beats the legacy binary-tree packer on a fragmentation-heavy layout", () => {
    const sizes = [
      { w: 220, h: 80 },
      { w: 210, h: 70 },
      { w: 160, h: 150 },
      { w: 150, h: 140 },
      { w: 90, h: 210 },
      { w: 80, h: 200 },
      { w: 70, h: 70 },
      { w: 60, h: 60 },
    ] as const;
    const legacyBlocks = createLegacyBlocks(sizes);
    const maxRectsBlocks = createBlocks(sizes);

    new GrowingPacker(16).fit(legacyBlocks);
    packBlocksMaxRects(maxRectsBlocks, {
      gap: 16,
      heuristic: "best-area-fit",
    });

    expect(getPackedArea(maxRectsBlocks)).toBeLessThan(
      getPackedArea(legacyBlocks),
    );
  });
});
