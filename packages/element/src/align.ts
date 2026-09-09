import type { AppState } from "@excalidraw/excalidraw/types";

import { updateBoundElements } from "./binding";
import { getCommonBoundingBox } from "./bounds";
import { getSelectedElementsByGroup } from "./groups";

import { getNonDeletedElements } from ".";

import type { Scene } from "./Scene";

import type { BoundingBox } from "./bounds";
import type { ExcalidrawElement, NonDeletedExcalidrawElement } from "./types";

export interface Alignment {
  position: "start" | "center" | "end";
  axis: "x" | "y";
}

export interface AlignElementsOptions {
  stacking?: boolean;
  gap?: number;
}

export const alignElements = (
  selectedElements: NonDeletedExcalidrawElement[],
  alignment: Alignment,
  scene: Scene,
  appState: Readonly<AppState>,
  options?: AlignElementsOptions,
): NonDeletedExcalidrawElement[] => {
  const groups = getSelectedElementsByGroup(
    selectedElements,
    scene.getNonDeletedElementsMap(),
    appState,
  ).map(getNonDeletedElements); // Nothing to align on deleted elements
  const selectionBoundingBox = getCommonBoundingBox(selectedElements);
  const translations =
    options?.stacking === false && alignment.position !== "center"
      ? calculateNonStackingTranslations(
          groups,
          alignment,
          Math.max(0, options.gap ?? 0),
        )
      : groups.map((group) =>
          calculateTranslation(group, selectionBoundingBox, alignment),
        );

  return groups.flatMap((group, index) => {
    const translation = translations[index];
    return group.map((element) => {
      // update element
      const updatedEle = scene.mutateElement(element, {
        x: element.x + translation.x,
        y: element.y + translation.y,
      });

      // update bound elements
      updateBoundElements(element, scene, {
        simultaneouslyUpdated: group,
      });
      return updatedEle;
    });
  });
};

const calculateNonStackingTranslations = (
  groups: readonly (readonly ExcalidrawElement[])[],
  { axis, position }: Alignment,
  gap: number,
): { x: number; y: number }[] => {
  const [primaryMin, primaryMax, secondaryMin, secondaryMax]: [
    "minX" | "minY",
    "maxX" | "maxY",
    "minX" | "minY",
    "maxX" | "maxY",
  ] =
    axis === "x"
      ? ["minX", "maxX", "minY", "maxY"]
      : ["minY", "maxY", "minX", "maxX"];

  const orderedGroups = groups
    .map((group, index) => ({
      boundingBox: getCommonBoundingBox(group),
      index,
    }))
    .sort((a, b) => {
      const edgeDifference =
        position === "start"
          ? a.boundingBox[primaryMin] - b.boundingBox[primaryMin]
          : b.boundingBox[primaryMax] - a.boundingBox[primaryMax];
      return edgeDifference || a.index - b.index;
    });

  const translations = groups.map(() => ({ x: 0, y: 0 }));
  const placedBoundingBoxes: BoundingBox[] = [];
  const anchorEdge =
    orderedGroups[0]?.boundingBox[
      position === "start" ? primaryMin : primaryMax
    ] ?? 0;

  for (const { boundingBox, index } of orderedGroups) {
    const overlapsPerpendicularly = (placed: BoundingBox) =>
      boundingBox[secondaryMin] < placed[secondaryMax] &&
      boundingBox[secondaryMax] > placed[secondaryMin];

    let alignedEdge = anchorEdge;
    for (const placed of placedBoundingBoxes) {
      if (!overlapsPerpendicularly(placed)) {
        continue;
      }
      alignedEdge =
        position === "start"
          ? Math.max(alignedEdge, placed[primaryMax] + gap)
          : Math.min(alignedEdge, placed[primaryMin] - gap);
    }

    const translation =
      alignedEdge - boundingBox[position === "start" ? primaryMin : primaryMax];
    translations[index][axis] = translation;
    placedBoundingBoxes.push({
      ...boundingBox,
      [primaryMin]: boundingBox[primaryMin] + translation,
      [primaryMax]: boundingBox[primaryMax] + translation,
    });
  }

  return translations;
};

const calculateTranslation = (
  group: readonly ExcalidrawElement[],
  selectionBoundingBox: BoundingBox,
  { axis, position }: Alignment,
): { x: number; y: number } => {
  const groupBoundingBox = getCommonBoundingBox(group);

  const [min, max]: ["minX" | "minY", "maxX" | "maxY"] =
    axis === "x" ? ["minX", "maxX"] : ["minY", "maxY"];

  const noTranslation = { x: 0, y: 0 };
  if (position === "start") {
    return {
      ...noTranslation,
      [axis]: selectionBoundingBox[min] - groupBoundingBox[min],
    };
  } else if (position === "end") {
    return {
      ...noTranslation,
      [axis]: selectionBoundingBox[max] - groupBoundingBox[max],
    };
  } // else if (position === "center") {
  return {
    ...noTranslation,
    [axis]:
      (selectionBoundingBox[min] + selectionBoundingBox[max]) / 2 -
      (groupBoundingBox[min] + groupBoundingBox[max]) / 2,
  };
};
