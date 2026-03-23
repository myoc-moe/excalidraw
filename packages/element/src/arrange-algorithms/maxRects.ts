export interface Block {
  w: number;
  h: number;
  fit?: {
    x: number;
    y: number;
  } | null;
}

export type MaxRectsHeuristic = "best-area-fit" | "center-distance";

type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

type PositionedBlock<T extends Block> = {
  source: T;
  actualW: number;
  actualH: number;
  packedW: number;
  packedH: number;
  fit: {
    x: number;
    y: number;
  } | null;
};

type Candidate = {
  x: number;
  y: number;
  score: number[];
};

const AREA_MULTIPLIERS = [1, 1.08, 1.18, 1.32, 1.5, 1.75, 2.1, 2.6, 3.25];
const ASPECT_RATIOS = [1, 4 / 3, 3 / 4, 3 / 2, 2 / 3, 2, 1 / 2];

const compareScores = (a: readonly number[], b: readonly number[]) => {
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) {
    const delta = (a[i] ?? 0) - (b[i] ?? 0);
    if (delta !== 0) {
      return delta;
    }
  }
  return 0;
};

const compareBlocks = <T extends Block>(
  a: PositionedBlock<T>,
  b: PositionedBlock<T>,
) =>
  b.packedW * b.packedH - a.packedW * a.packedH ||
  Math.max(b.packedW, b.packedH) - Math.max(a.packedW, a.packedH) ||
  b.packedH - a.packedH ||
  b.packedW - a.packedW;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const intersects = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

const contains = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.w <= outer.x + outer.w &&
  inner.y + inner.h <= outer.y + outer.h;

const getLayoutBounds = <T extends Block>(
  blocks: readonly PositionedBlock<T>[],
) => {
  const placedBlocks = blocks.filter((block) => block.fit);
  if (placedBlocks.length === 0) {
    return null;
  }

  return placedBlocks.reduce<Bounds>(
    (bounds, block) => ({
      minX: Math.min(bounds.minX, block.fit!.x),
      minY: Math.min(bounds.minY, block.fit!.y),
      maxX: Math.max(bounds.maxX, block.fit!.x + block.actualW),
      maxY: Math.max(bounds.maxY, block.fit!.y + block.actualH),
    }),
    {
      minX: placedBlocks[0].fit!.x,
      minY: placedBlocks[0].fit!.y,
      maxX: placedBlocks[0].fit!.x + placedBlocks[0].actualW,
      maxY: placedBlocks[0].fit!.y + placedBlocks[0].actualH,
    },
  );
};

const measureCenterSpread = <T extends Block>(
  blocks: readonly PositionedBlock<T>[],
  bounds: Bounds,
) => {
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;

  return blocks.reduce((spread, block) => {
    if (!block.fit) {
      return spread;
    }

    const blockCenterX = block.fit.x + block.actualW / 2;
    const blockCenterY = block.fit.y + block.actualH / 2;
    return (
      spread +
      Math.abs(blockCenterX - centerX) +
      Math.abs(blockCenterY - centerY)
    );
  }, 0);
};

const pruneFreeRects = (freeRects: Rect[]) => {
  const pruned: Rect[] = [];

  outer: for (let i = 0; i < freeRects.length; i++) {
    const candidate = freeRects[i];
    if (candidate.w <= 0 || candidate.h <= 0) {
      continue;
    }

    for (let j = 0; j < freeRects.length; j++) {
      if (i === j) {
        continue;
      }

      if (contains(freeRects[j], candidate)) {
        continue outer;
      }
    }

    if (
      !pruned.some(
        (rect) =>
          rect.x === candidate.x &&
          rect.y === candidate.y &&
          rect.w === candidate.w &&
          rect.h === candidate.h,
      )
    ) {
      pruned.push(candidate);
    }
  }

  return pruned;
};

const splitFreeRects = (freeRects: Rect[], placedRect: Rect) => {
  const nextFreeRects: Rect[] = [];

  for (const freeRect of freeRects) {
    if (!intersects(freeRect, placedRect)) {
      nextFreeRects.push(freeRect);
      continue;
    }

    if (placedRect.x > freeRect.x) {
      nextFreeRects.push({
        x: freeRect.x,
        y: freeRect.y,
        w: placedRect.x - freeRect.x,
        h: freeRect.h,
      });
    }

    if (placedRect.x + placedRect.w < freeRect.x + freeRect.w) {
      nextFreeRects.push({
        x: placedRect.x + placedRect.w,
        y: freeRect.y,
        w: freeRect.x + freeRect.w - (placedRect.x + placedRect.w),
        h: freeRect.h,
      });
    }

    if (placedRect.y > freeRect.y) {
      nextFreeRects.push({
        x: freeRect.x,
        y: freeRect.y,
        w: freeRect.w,
        h: placedRect.y - freeRect.y,
      });
    }

    if (placedRect.y + placedRect.h < freeRect.y + freeRect.h) {
      nextFreeRects.push({
        x: freeRect.x,
        y: placedRect.y + placedRect.h,
        w: freeRect.w,
        h: freeRect.y + freeRect.h - (placedRect.y + placedRect.h),
      });
    }
  }

  return pruneFreeRects(nextFreeRects);
};

const getCandidatePositions = <T extends Block>(
  freeRect: Rect,
  block: PositionedBlock<T>,
  heuristic: MaxRectsHeuristic,
  targetCenter: { x: number; y: number },
) => {
  const maxX = freeRect.x + freeRect.w - block.packedW;
  const maxY = freeRect.y + freeRect.h - block.packedH;
  const positions = [
    { x: freeRect.x, y: freeRect.y },
    { x: maxX, y: freeRect.y },
    { x: freeRect.x, y: maxY },
    { x: maxX, y: maxY },
  ];

  if (heuristic === "center-distance") {
    positions.push({
      x: clamp(targetCenter.x - block.actualW / 2, freeRect.x, maxX),
      y: clamp(targetCenter.y - block.actualH / 2, freeRect.y, maxY),
    });
  }

  return positions.filter(
    (position, index, allPositions) =>
      allPositions.findIndex(
        (candidate) => candidate.x === position.x && candidate.y === position.y,
      ) === index,
  );
};

const getCandidateScore = <T extends Block>(
  freeRect: Rect,
  block: PositionedBlock<T>,
  position: { x: number; y: number },
  heuristic: MaxRectsHeuristic,
  usedBounds: Bounds | null,
  binWidth: number,
  binHeight: number,
) => {
  const areaFit = freeRect.w * freeRect.h - block.packedW * block.packedH;
  const leftoverHoriz = freeRect.w - block.packedW;
  const leftoverVert = freeRect.h - block.packedH;
  const shortSideFit = Math.min(leftoverHoriz, leftoverVert);
  const longSideFit = Math.max(leftoverHoriz, leftoverVert);

  if (heuristic === "best-area-fit") {
    return [areaFit, shortSideFit, longSideFit, position.y, position.x];
  }

  const targetCenter = usedBounds
    ? {
        x: (usedBounds.minX + usedBounds.maxX) / 2,
        y: (usedBounds.minY + usedBounds.maxY) / 2,
      }
    : {
        x: binWidth / 2,
        y: binHeight / 2,
      };
  const candidateCenterX = position.x + block.actualW / 2;
  const candidateCenterY = position.y + block.actualH / 2;
  const centerDistance =
    Math.abs(candidateCenterX - targetCenter.x) +
    Math.abs(candidateCenterY - targetCenter.y);
  const projectedBounds = usedBounds
    ? {
        minX: Math.min(usedBounds.minX, position.x),
        minY: Math.min(usedBounds.minY, position.y),
        maxX: Math.max(usedBounds.maxX, position.x + block.actualW),
        maxY: Math.max(usedBounds.maxY, position.y + block.actualH),
      }
    : {
        minX: position.x,
        minY: position.y,
        maxX: position.x + block.actualW,
        maxY: position.y + block.actualH,
      };
  const projectedWidth = projectedBounds.maxX - projectedBounds.minX;
  const projectedHeight = projectedBounds.maxY - projectedBounds.minY;
  const projectedArea = projectedWidth * projectedHeight;

  return [centerDistance, projectedArea, areaFit, shortSideFit, longSideFit];
};

const tryPack = <T extends Block>(
  blocks: PositionedBlock<T>[],
  binWidth: number,
  binHeight: number,
  heuristic: MaxRectsHeuristic,
) => {
  let freeRects: Rect[] = [{ x: 0, y: 0, w: binWidth, h: binHeight }];

  for (const block of blocks) {
    const usedBounds = getLayoutBounds(blocks);
    let bestCandidate: Candidate | null = null;

    for (const freeRect of freeRects) {
      if (block.packedW > freeRect.w || block.packedH > freeRect.h) {
        continue;
      }

      const targetCenter = usedBounds
        ? {
            x: (usedBounds.minX + usedBounds.maxX) / 2,
            y: (usedBounds.minY + usedBounds.maxY) / 2,
          }
        : {
            x: binWidth / 2,
            y: binHeight / 2,
          };

      const positions = getCandidatePositions(
        freeRect,
        block,
        heuristic,
        targetCenter,
      );

      for (const position of positions) {
        const candidateScore = getCandidateScore(
          freeRect,
          block,
          position,
          heuristic,
          usedBounds,
          binWidth,
          binHeight,
        );

        if (
          !bestCandidate ||
          compareScores(candidateScore, bestCandidate.score) < 0
        ) {
          bestCandidate = {
            x: position.x,
            y: position.y,
            score: candidateScore,
          };
        }
      }
    }

    if (!bestCandidate) {
      return null;
    }

    block.fit = {
      x: bestCandidate.x,
      y: bestCandidate.y,
    };

    freeRects = splitFreeRects(freeRects, {
      x: bestCandidate.x,
      y: bestCandidate.y,
      w: block.packedW,
      h: block.packedH,
    });
  }

  const bounds = getLayoutBounds(blocks);
  if (!bounds) {
    return {
      width: 0,
      height: 0,
      spread: 0,
    };
  }

  const offsetX = bounds.minX;
  const offsetY = bounds.minY;
  blocks.forEach((block) => {
    if (block.fit) {
      block.fit = {
        x: block.fit.x - offsetX,
        y: block.fit.y - offsetY,
      };
    }
  });

  return {
    width: bounds.maxX - bounds.minX,
    height: bounds.maxY - bounds.minY,
    spread: measureCenterSpread(blocks, {
      minX: 0,
      minY: 0,
      maxX: bounds.maxX - bounds.minX,
      maxY: bounds.maxY - bounds.minY,
    }),
  };
};

export const packBlocksMaxRects = <T extends Block>(
  blocks: T[],
  options: {
    gap?: number;
    heuristic?: MaxRectsHeuristic;
  } = {},
) => {
  const gap = Math.max(options.gap ?? 0, 0);
  const heuristic = options.heuristic ?? "best-area-fit";

  blocks.forEach((block) => {
    block.fit = null;
  });

  if (blocks.length === 0) {
    return {
      width: 0,
      height: 0,
    };
  }

  const positionedBlocks = blocks
    .map<PositionedBlock<T>>((block) => ({
      source: block,
      actualW: block.w,
      actualH: block.h,
      packedW: block.w + gap,
      packedH: block.h + gap,
      fit: null,
    }))
    .sort(compareBlocks);

  const totalPackedArea = positionedBlocks.reduce(
    (area, block) => area + block.packedW * block.packedH,
    0,
  );
  const maxPackedWidth = Math.max(
    ...positionedBlocks.map((block) => block.packedW),
  );
  const maxPackedHeight = Math.max(
    ...positionedBlocks.map((block) => block.packedH),
  );
  let bestLayout: {
    width: number;
    height: number;
    spread: number;
    blocks: PositionedBlock<T>[];
  } | null = null;

  for (const areaMultiplier of AREA_MULTIPLIERS) {
    const targetArea = totalPackedArea * areaMultiplier;

    for (const aspectRatio of ASPECT_RATIOS) {
      const width = Math.max(
        maxPackedWidth,
        Math.ceil(Math.sqrt(targetArea * aspectRatio)),
      );
      const height = Math.max(maxPackedHeight, Math.ceil(targetArea / width));
      const candidateBlocks = positionedBlocks.map<PositionedBlock<T>>(
        (block) => ({
          ...block,
          fit: null,
        }),
      );
      const layout = tryPack(candidateBlocks, width, height, heuristic);

      if (!layout) {
        continue;
      }

      const candidate = {
        width: layout.width,
        height: layout.height,
        spread: layout.spread,
        blocks: candidateBlocks,
      };

      if (!bestLayout) {
        bestLayout = candidate;
        continue;
      }

      const areaDelta =
        candidate.width * candidate.height -
        bestLayout.width * bestLayout.height;
      const candidateAspectDelta = Math.abs(candidate.width - candidate.height);
      const bestAspectDelta = Math.abs(bestLayout.width - bestLayout.height);

      if (
        areaDelta < 0 ||
        (areaDelta === 0 &&
          (candidateAspectDelta < bestAspectDelta ||
            (candidateAspectDelta === bestAspectDelta &&
              (candidate.spread < bestLayout.spread ||
                (candidate.spread === bestLayout.spread &&
                  candidate.width + candidate.height <
                    bestLayout.width + bestLayout.height)))))
      ) {
        bestLayout = candidate;
      }
    }

    if (bestLayout) {
      break;
    }
  }

  if (!bestLayout) {
    return null;
  }

  bestLayout.blocks.forEach((block) => {
    block.source.fit = block.fit;
  });

  return {
    width: bestLayout.width,
    height: bestLayout.height,
  };
};
