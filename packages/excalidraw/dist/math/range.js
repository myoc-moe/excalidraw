import { toBrandedType } from "../excalidraw/utils";
/**
 * Create an inclusive range from the two numbers provided.
 *
 * @param start Start of the range
 * @param end End of the range
 * @returns
 */
export function rangeInclusive(start, end) {
    return toBrandedType([start, end]);
}
/**
 * Turn a number pair into an inclusive range.
 *
 * @param pair The number pair to convert to an inclusive range
 * @returns The new inclusive range
 */
export function rangeInclusiveFromPair(pair) {
    return toBrandedType(pair);
}
/**
 * Given two ranges, return if the two ranges overlap with each other e.g.
 * [1, 3] overlaps with [2, 4] while [1, 3] does not overlap with [4, 5].
 *
 * @param param0 One of the ranges to compare
 * @param param1 The other range to compare against
 * @returns TRUE if the ranges overlap
 */
export const rangesOverlap = ([a0, a1], [b0, b1]) => {
    if (a0 <= b0) {
        return a1 >= b0;
    }
    if (a0 >= b0) {
        return b1 >= a0;
    }
    return false;
};
/**
 * Given two ranges,return ther intersection of the two ranges if any e.g. the
 * intersection of [1, 3] and [2, 4] is [2, 3].
 *
 * @param param0 The first range to compare
 * @param param1 The second range to compare
 * @returns The inclusive range intersection or NULL if no intersection
 */
export const rangeIntersection = ([a0, a1], [b0, b1]) => {
    const rangeStart = Math.max(a0, b0);
    const rangeEnd = Math.min(a1, b1);
    if (rangeStart <= rangeEnd) {
        return toBrandedType([rangeStart, rangeEnd]);
    }
    return null;
};
/**
 * Determine if a value is inside a range.
 *
 * @param value The value to check
 * @param range The range
 * @returns
 */
export const rangeIncludesValue = (value, [min, max]) => {
    return value >= min && value <= max;
};