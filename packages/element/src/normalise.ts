import { getCommonBoundingBox } from "./bounds";

import { getMaximumGroups } from "./groups";

import type { Scene } from "./Scene";

import type { BoundingBox } from "./bounds";

import type { ElementsMap, ExcalidrawElement } from "./types";

interface Group {
  group: ExcalidrawElement[];
  boundingBox: BoundingBox;
}

// Modes
// From first selected element, or average

// What to normailse
// Scale - x zoom amount
// Height - use height to normalise
// Width - use width to normalise
// Size - use area to normalise
//

export type NormaliseMode = "first" | "average";
export type NormaliseMetric = "scale" | "height" | "width" | "size";

const getGroupCenter = (boundingBox: BoundingBox) => ({
  x: (boundingBox.minX + boundingBox.maxX) / 2,
  y: (boundingBox.minY + boundingBox.maxY) / 2,
});

const getMetricValue = (metric: NormaliseMetric, boundingBox: BoundingBox) => {
  switch (metric) {
    case "height":
      return boundingBox.height;
    case "width":
      return boundingBox.width;
    case "size":
      return boundingBox.width * boundingBox.height;
    case "scale":
      return (boundingBox.width + boundingBox.height) / 2;
  }
};

const getReferenceValue = (
  metric: NormaliseMetric,
  groups: Group[],
  mode: NormaliseMode,
) => {
  if (mode === "first") {
    return getMetricValue(metric, groups[0].boundingBox);
  }

  const total = groups.reduce(
    (sum, group) => sum + getMetricValue(metric, group.boundingBox),
    0,
  );

  return total / groups.length;
};

const getScaleFromMetric = (
  metric: NormaliseMetric,
  referenceValue: number,
  boundingBox: BoundingBox,
) => {
  switch (metric) {
    case "height":
      return referenceValue / boundingBox.height;
    case "width":
      return referenceValue / boundingBox.width;
    case "size":
      return Math.sqrt(
        referenceValue / (boundingBox.width * boundingBox.height),
      );
    case "scale":
      return referenceValue / ((boundingBox.width + boundingBox.height) / 2);
  }
};

const normaliseElements = (
  scene: Scene,
  selectedElements: ExcalidrawElement[],
  elementsMap: ElementsMap,
  mode: NormaliseMode = "average",
  metric: NormaliseMetric = "size",
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

  if (groupBoundingBoxes.length === 0) {
    return selectedElements;
  }

  const referenceValue = getReferenceValue(metric, groupBoundingBoxes, mode);

  const updatedElements: ExcalidrawElement[] = [];

  groupBoundingBoxes.forEach((group) => {
    const scale = getScaleFromMetric(metric, referenceValue, group.boundingBox);
    if (!Number.isFinite(scale) || scale <= 0) {
      return;
    }

    const groupCenter = getGroupCenter(group.boundingBox);

    group.group.forEach((element) => {
      const elementCenter = {
        x: element.x + element.width / 2,
        y: element.y + element.height / 2,
      };
      const updatedCenter = {
        x: groupCenter.x + (elementCenter.x - groupCenter.x) * scale,
        y: groupCenter.y + (elementCenter.y - groupCenter.y) * scale,
      };
      const nextWidth = element.width * scale;
      const nextHeight = element.height * scale;

      scene.mutateElement(element, {
        x: updatedCenter.x - nextWidth / 2,
        y: updatedCenter.y - nextHeight / 2,
        width: nextWidth,
        height: nextHeight,
      });

      updatedElements.push(element);
    });
  });

  return updatedElements;
};

export { normaliseElements };
