import type { Curve, GlobalPoint, LocalPoint, Radians } from "./types";
/**
 *
 * @param a
 * @param b
 * @param c
 * @param d
 * @returns
 */
export declare function curve<Point extends GlobalPoint | LocalPoint>(a: Point, b: Point, c: Point, d: Point): Curve<Point>;
export declare const curveRotate: <Point extends GlobalPoint | LocalPoint>(curve: Curve<Point>, angle: Radians, origin: Point) => Point[];
/**
 *
 * @param pointsIn
 * @param curveTightness
 * @returns
 */
export declare function curveToBezier<Point extends LocalPoint | GlobalPoint>(pointsIn: readonly Point[], curveTightness?: number): Point[];
/**
 *
 * @param t
 * @param controlPoints
 * @returns
 */
export declare const cubicBezierPoint: <Point extends GlobalPoint | LocalPoint>(t: number, controlPoints: Curve<Point>) => Point;
/**
 *
 * @param point
 * @param controlPoints
 * @returns
 */
export declare const cubicBezierDistance: <Point extends GlobalPoint | LocalPoint>(point: Point, controlPoints: Curve<Point>) => number;
