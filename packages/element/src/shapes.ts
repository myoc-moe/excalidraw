import { KEYS } from "@excalidraw/common";
import { type GlobalPoint, type LocalPoint } from "@excalidraw/math";
import { type GeometricShape } from "@excalidraw/utils/shape";

// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import {
  ArrowIcon,
  DiamondIcon,
  EllipseIcon,
  EraserIcon,
  FreedrawIcon,
  ImageIcon,
  LineIcon,
  RectangleIcon,
  SelectionIcon,
  TextIcon,
} from "@excalidraw/excalidraw/components/icons";

import type { AppClassProperties } from "@excalidraw/excalidraw/types";

import { LinearElementEditor } from "./linearElementEditor";
import { getBoundTextElement } from "./textElement";

import { getElementShape } from "./shape";

import type { ExcalidrawElement, ElementsMap } from "./types";

export type ToolCategory = "manipulation" | "elements";

export const SHAPES = [
  {
    icon: SelectionIcon,
    value: "selection",
    key: KEYS.V,
    numericKey: undefined,
    fillable: true,
    myocSimplifiedMode: true,
  },
  {
    icon: RectangleIcon,
    value: "rectangle",
    key: KEYS.R,
    numericKey: undefined,
    fillable: true,
    myocSimplifiedMode: false,
  },
  {
    icon: DiamondIcon,
    value: "diamond",
    key: KEYS.D,
    numericKey: undefined,
    fillable: true,
    myocSimplifiedMode: false,
  },
  {
    icon: EllipseIcon,
    value: "ellipse",
    key: KEYS.O,
    numericKey: undefined,
    fillable: true,
    myocSimplifiedMode: false,
  },
  {
    icon: ArrowIcon,
    value: "arrow",
    key: KEYS.A,
    numericKey: undefined,
    fillable: true,
    myocSimplifiedMode: false,
  },
  {
    icon: LineIcon,
    value: "line",
    key: KEYS.L,
    numericKey: undefined,
    fillable: true,
    myocSimplifiedMode: false,
  },
  {
    icon: FreedrawIcon,
    value: "freedraw",
    key: [KEYS.P, KEYS.X],
    numericKey: undefined,
    fillable: false,
    myocSimplifiedMode: true,
  },
  {
    icon: TextIcon,
    value: "text",
    key: KEYS.T,
    numericKey: undefined,
    fillable: false,
    myocSimplifiedMode: true,
  },
  {
    icon: ImageIcon,
    value: "image",
    key: [KEYS.I],
    numericKey: undefined,
    fillable: false,
    myocSimplifiedMode: true,
  },
  {
    icon: EraserIcon,
    value: "eraser",
    key: KEYS.E,
    numericKey: undefined,
    fillable: false,
    myocSimplifiedMode: true,
  },
] as const;

export const getToolbarTools = (app: AppClassProperties) => {
  return app.state.preferredSelectionTool.type === "lasso"
    ? ([
        {
          value: "lasso",
          icon: SelectionIcon,
          key: KEYS.V,
          fillable: true,
          myocSimplifiedMode: true,
        },
        ...SHAPES.slice(1),
      ] as const)
    : SHAPES;
};

export const findShapeByKey = (key: string, app: AppClassProperties) => {
  const shape = getToolbarTools(app).find((shape, index) => {
    return (
      // @ts-expect-error numericKey is just undefined for now because myoc wants to reserve this for future use of screen views
      (shape.numericKey != null && key === shape.numericKey?.toString()) ||
      (shape.key &&
        (typeof shape.key === "string"
          ? shape.key === key
          : (shape.key as readonly string[]).includes(key)))
    );
  });
  return shape?.value || null;
};

export const getBoundTextShape = <Point extends GlobalPoint | LocalPoint>(
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
): GeometricShape<Point> | null => {
  const boundTextElement = getBoundTextElement(element, elementsMap);

  if (boundTextElement) {
    if (element.type === "arrow") {
      return getElementShape(
        {
          ...boundTextElement,
          // arrow's bound text accurate position is not stored in the element's property
          // but rather calculated and returned from the following static method
          ...LinearElementEditor.getBoundTextElementPosition(
            element,
            boundTextElement,
            elementsMap,
          ),
        },
        elementsMap,
      );
    }
    return getElementShape(boundTextElement, elementsMap);
  }

  return null;
};
