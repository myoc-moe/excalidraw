import { vectorCross, vectorFromPoint, } from "../math";
export function getBBox(line) {
    return [
        Math.min(line[0][0], line[1][0]),
        Math.min(line[0][1], line[1][1]),
        Math.max(line[0][0], line[1][0]),
        Math.max(line[0][1], line[1][1]),
    ];
}
export function doBBoxesIntersect(a, b) {
    return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}
const EPSILON = 0.000001;
export function isPointOnLine(l, p) {
    const p1 = vectorFromPoint(l[1], l[0]);
    const p2 = vectorFromPoint(p, l[0]);
    const r = vectorCross(p1, p2);
    return Math.abs(r) < EPSILON;
}
export function isPointRightOfLine(l, p) {
    const p1 = vectorFromPoint(l[1], l[0]);
    const p2 = vectorFromPoint(p, l[0]);
    return vectorCross(p1, p2) < 0;
}
export function isLineSegmentTouchingOrCrossingLine(a, b) {
    return (isPointOnLine(a, b[0]) ||
        isPointOnLine(a, b[1]) ||
        (isPointRightOfLine(a, b[0])
            ? !isPointRightOfLine(a, b[1])
            : isPointRightOfLine(a, b[1])));
}
// https://martin-thoma.com/how-to-check-if-two-line-segments-intersect/
export function doLineSegmentsIntersect(a, b) {
    return (doBBoxesIntersect(getBBox(a), getBBox(b)) &&
        isLineSegmentTouchingOrCrossingLine(a, b) &&
        isLineSegmentTouchingOrCrossingLine(b, a));
}