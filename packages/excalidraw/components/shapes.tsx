import { KEYS } from "@excalidraw/common";

import {
  SelectionIcon,
  RectangleIcon,
  DiamondIcon,
  EllipseIcon,
  ArrowIcon,
  LineIcon,
  FreedrawIcon,
  TextIcon,
  ImageIcon,
  EraserIcon,
} from "./icons";

export const SHAPES = [
  {
    icon: SelectionIcon,
    value: "selection",
    key: KEYS.V,
    fillable: true,
    myocSimplifiedMode: true,
  },
  {
    icon: RectangleIcon,
    value: "rectangle",
    key: KEYS.R,
    fillable: true,
    myocSimplifiedMode: false,
  },
  {
    icon: DiamondIcon,
    value: "diamond",
    key: KEYS.D,
    fillable: true,
    myocSimplifiedMode: false,
  },
  {
    icon: EllipseIcon,
    value: "ellipse",
    key: KEYS.O,
    fillable: true,
    myocSimplifiedMode: false,
  },
  {
    icon: ArrowIcon,
    value: "arrow",
    key: KEYS.A,
    fillable: true,
    myocSimplifiedMode: false,
  },
  {
    icon: LineIcon,
    value: "line",
    key: KEYS.L,
    fillable: true,
    myocSimplifiedMode: false,
  },
  {
    icon: FreedrawIcon,
    value: "freedraw",
    key: [KEYS.P, KEYS.X],
    fillable: false,
    myocSimplifiedMode: true,
  },
  {
    icon: TextIcon,
    value: "text",
    key: KEYS.T,
    fillable: false,
    myocSimplifiedMode: true,
  },
  {
    icon: ImageIcon,
    value: "image",
    key: [KEYS.I],
    fillable: false,
    myocSimplifiedMode: true,
  },
  {
    icon: EraserIcon,
    value: "eraser",
    key: KEYS.E,
    fillable: false,
    myocSimplifiedMode: true,
  },
] as const;

export const findShapeByKey = (key: string) => {
  const shape = SHAPES.find((shape, index) => {
    return (
      shape.key &&
      (typeof shape.key === "string"
        ? shape.key === key
        : (shape.key as readonly string[]).includes(key))
    );
  });
  return shape?.value || null;
};
