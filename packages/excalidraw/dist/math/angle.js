import { PRECISION } from "./utils";
// TODO: Simplify with modulo and fix for angles beyond 4*Math.PI and - 4*Math.PI
export const normalizeRadians = (angle) => {
    if (angle < 0) {
        return (angle + 2 * Math.PI);
    }
    if (angle >= 2 * Math.PI) {
        return (angle - 2 * Math.PI);
    }
    return angle;
};
/**
 * Return the polar coordinates for the given cartesian point represented by
 * (x, y) for the center point 0,0 where the first number returned is the radius,
 * the second is the angle in radians.
 */
export const cartesian2Polar = ([x, y,]) => [Math.hypot(x, y), Math.atan2(y, x)];
export function degreesToRadians(degrees) {
    return ((degrees * Math.PI) / 180);
}
export function radiansToDegrees(degrees) {
    return ((degrees * 180) / Math.PI);
}
/**
 * Determines if the provided angle is a right angle.
 *
 * @param rads The angle to measure
 * @returns TRUE if the provided angle is a right angle
 */
export function isRightAngleRads(rads) {
    return Math.abs(Math.sin(2 * rads)) < PRECISION;
}
