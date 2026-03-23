import { getCommonBoundingBox } from "./bounds";

import { getMaximumGroups } from "./groups";

import { GrowingPacker, type Block } from "./arrange-algorithms/packer";
import {
  packBlocksMaxRects,
  type MaxRectsHeuristic,
} from "./arrange-algorithms/maxRects";

import type { Scene } from "./Scene";

import type { BoundingBox } from "./bounds";

import type {
  ElementsMap,
  ExcalidrawElement,
  ArrangeAlgorithms,
} from "./types";

interface Group {
  group: ExcalidrawElement[];
  boundingBox: BoundingBox;
}

type GroupBlock = Block & {
  group: ExcalidrawElement[];
};

/**
 * Updates all elements relative to the group position
 */
const mutateGroup = (
  scene: Scene,
  group: ExcalidrawElement[],
  update: { x: number; y: number },
) => {
  // Determine the delta of the group position, vs the new update position
  const groupBoundingBox = getCommonBoundingBox(group);
  const deltaX = update.x - groupBoundingBox.minX;
  const deltaY = update.y - groupBoundingBox.minY;
  // Update the elements in the group

  group.forEach((element) => {
    scene.mutateElement(element, {
      x: element.x + deltaX,
      y: element.y + deltaY,
    });
  });
};

const createGroupBlocks = (groups: Group[]): GroupBlock[] =>
  groups
    .map((group) => ({
      w: group.boundingBox.width,
      h: group.boundingBox.height,
      group: group.group,
    }))
    .sort(
      (a, b) =>
        b.w * b.h - a.w * a.h ||
        Math.max(b.w, b.h) - Math.max(a.w, a.h) ||
        b.h - a.h ||
        b.w - a.w,
    );

const applyPackedGroups = (
  scene: Scene,
  groupBlocks: GroupBlock[],
  origin: { x: number; y: number },
) => {
  const groupsAdded = groupBlocks.filter((block) => block.fit);

  groupsAdded.forEach((group) => {
    mutateGroup(scene, group.group, {
      x: origin.x + (group.fit?.x ?? 0),
      y: origin.y + (group.fit?.y ?? 0),
    });
  });

  return groupsAdded.flatMap((group) => group.group);
};

const arrangeElementsBinaryTreePacking = (
  scene: Scene,
  groups: Group[],
  gap: number,
): ExcalidrawElement[] => {
  const flattendGroups = groups.flatMap((g) => g.group);
  const commonBoundingBox = getCommonBoundingBox(flattendGroups);
  const origin = {
    x: commonBoundingBox.minX,
    y: commonBoundingBox.minY,
  };

  const groupBlocks = createGroupBlocks(groups);

  const packer = new GrowingPacker(gap);
  packer.fit(groupBlocks);

  return applyPackedGroups(scene, groupBlocks, origin);
};

const arrangeElementsMaxRectsPacking = (
  scene: Scene,
  groups: Group[],
  gap: number,
  heuristic: MaxRectsHeuristic,
): ExcalidrawElement[] => {
  const flattendGroups = groups.flatMap((g) => g.group);
  const commonBoundingBox = getCommonBoundingBox(flattendGroups);
  const origin = {
    x: commonBoundingBox.minX,
    y: commonBoundingBox.minY,
  };
  const groupBlocks = createGroupBlocks(groups);
  const layout = packBlocksMaxRects(groupBlocks, {
    gap,
    heuristic,
  });

  if (!layout) {
    console.warn(
      `Packing heuristic [${heuristic}] failed - using binary tree packer`,
    );
    return arrangeElementsBinaryTreePacking(scene, groups, gap);
  }

  return applyPackedGroups(scene, groupBlocks, origin);
};

const arrangeElements = (
  scene: Scene,
  selectedElements: ExcalidrawElement[],
  elementsMap: ElementsMap,
  algorithm: ArrangeAlgorithms,
  gap: number,
): ExcalidrawElement[] => {
  // Determine the groups that we would be rearranging, as we don't want to be
  // making any manipulations within groups
  const groups: ExcalidrawElement[][] = getMaximumGroups(
    selectedElements,
    elementsMap,
  );
  const groupBoundingBoxes = groups.map((group) => ({
    group,
    boundingBox: getCommonBoundingBox(group),
  }));

  switch (algorithm) {
    case "bin-packing":
    case "bin-packing-center":
      return arrangeElementsMaxRectsPacking(
        scene,
        groupBoundingBoxes,
        gap,
        "center-distance",
      );
    case "bin-packing-max-rects":
      return arrangeElementsMaxRectsPacking(
        scene,
        groupBoundingBoxes,
        gap,
        "best-area-fit",
      );
    case "bin-packing-binary-tree":
      return arrangeElementsBinaryTreePacking(scene, groupBoundingBoxes, gap);
    default:
      console.warn(
        `Unimplemented algorithm [${algorithm}] - using bin-packing`,
      );
      return arrangeElementsMaxRectsPacking(
        scene,
        groupBoundingBoxes,
        gap,
        "center-distance",
      );
  }
};

export { arrangeElements };
