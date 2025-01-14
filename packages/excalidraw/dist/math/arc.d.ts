import type { GlobalPoint, LocalPoint, SymmetricArc } from "./types";
/**
 * Determines if a cartesian point lies on a symmetric arc, i.e. an arc which
 * is part of a circle contour centered on 0, 0.
 */
export declare const isPointOnSymmetricArc: <P extends GlobalPoint | LocalPoint>({ radius: arcRadius, startAngle, endAngle }: SymmetricArc, point: P) => boolean;
