import { pointsEqual } from "./point";
import { lineSegment, pointOnLineSegment } from "./segment";
import { PRECISION } from "./utils";
export function polygon(...points) {
    return polygonClose(points);
}
export function polygonFromPoints(points) {
    return polygonClose(points);
}
export const polygonIncludesPoint = (point, polygon) => {
    const x = point[0];
    const y = point[1];
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i][0];
        const yi = polygon[i][1];
        const xj = polygon[j][0];
        const yj = polygon[j][1];
        if (((yi > y && yj <= y) || (yi <= y && yj > y)) &&
            x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
            inside = !inside;
        }
    }
    return inside;
};
export const pointOnPolygon = (p, poly, threshold = PRECISION) => {
    let on = false;
    for (let i = 0, l = poly.length - 1; i < l; i++) {
        if (pointOnLineSegment(p, lineSegment(poly[i], poly[i + 1]), threshold)) {
            on = true;
            break;
        }
    }
    return on;
};
function polygonClose(polygon) {
    return polygonIsClosed(polygon)
        ? polygon
        : [...polygon, polygon[0]];
}
function polygonIsClosed(polygon) {
    return pointsEqual(polygon[0], polygon[polygon.length - 1]);
}
