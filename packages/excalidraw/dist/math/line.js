import { pointCenter, pointRotateRads } from "./point";
/**
 * Create a line from two points.
 *
 * @param points The two points lying on the line
 * @returns The line on which the points lie
 */
export function line(a, b) {
    return [a, b];
}
/**
 * Convenient point creation from an array of two points.
 *
 * @param param0 The array with the two points to convert to a line
 * @returns The created line
 */
export function lineFromPointPair([a, b]) {
    return line(a, b);
}
/**
 * TODO
 *
 * @param pointArray
 * @returns
 */
export function lineFromPointArray(pointArray) {
    return pointArray.length === 2
        ? line(pointArray[0], pointArray[1])
        : undefined;
}
// return the coordinates resulting from rotating the given line about an origin by an angle in degrees
// note that when the origin is not given, the midpoint of the given line is used as the origin
export const lineRotate = (l, angle, origin) => {
    return line(pointRotateRads(l[0], origin || pointCenter(l[0], l[1]), angle), pointRotateRads(l[1], origin || pointCenter(l[0], l[1]), angle));
};
