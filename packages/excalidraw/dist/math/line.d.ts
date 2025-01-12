import type { GlobalPoint, Line, LocalPoint, Radians } from "./types";
/**
 * Create a line from two points.
 *
 * @param points The two points lying on the line
 * @returns The line on which the points lie
 */
export declare function line<P extends GlobalPoint | LocalPoint>(a: P, b: P): Line<P>;
/**
 * Convenient point creation from an array of two points.
 *
 * @param param0 The array with the two points to convert to a line
 * @returns The created line
 */
export declare function lineFromPointPair<P extends GlobalPoint | LocalPoint>([a, b]: [
    P,
    P
]): Line<P>;
/**
 * TODO
 *
 * @param pointArray
 * @returns
 */
export declare function lineFromPointArray<P extends GlobalPoint | LocalPoint>(pointArray: P[]): Line<P> | undefined;
export declare const lineRotate: <Point extends GlobalPoint | LocalPoint>(l: Line<Point>, angle: Radians, origin?: Point | undefined) => Line<Point>;
