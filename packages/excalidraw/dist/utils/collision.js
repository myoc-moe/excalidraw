import { pointInEllipse, pointOnEllipse, } from "./geometry/shape";
import { lineSegment, pointFrom, polygonIncludesPoint, pointOnLineSegment, pointOnPolygon, polygonFromPoints, } from "../math";
// check if the given point is considered on the given shape's border
export const isPointOnShape = (point, shape, tolerance = 0) => {
    // get the distance from the given point to the given element
    // check if the distance is within the given epsilon range
    switch (shape.type) {
        case "polygon":
            return pointOnPolygon(point, shape.data, tolerance);
        case "ellipse":
            return pointOnEllipse(point, shape.data, tolerance);
        case "line":
            return pointOnLineSegment(point, shape.data, tolerance);
        case "polyline":
            return pointOnPolyline(point, shape.data, tolerance);
        case "curve":
            return pointOnCurve(point, shape.data, tolerance);
        case "polycurve":
            return pointOnPolycurve(point, shape.data, tolerance);
        default:
            throw Error(`shape ${shape} is not implemented`);
    }
};
// check if the given point is considered inside the element's border
export const isPointInShape = (point, shape) => {
    switch (shape.type) {
        case "polygon":
            return polygonIncludesPoint(point, shape.data);
        case "line":
            return false;
        case "curve":
            return false;
        case "ellipse":
            return pointInEllipse(point, shape.data);
        case "polyline": {
            const polygon = polygonFromPoints(shape.data.flat());
            return polygonIncludesPoint(point, polygon);
        }
        case "polycurve": {
            return false;
        }
        default:
            throw Error(`shape ${shape} is not implemented`);
    }
};
// check if the given element is in the given bounds
export const isPointInBounds = (point, bounds) => {
    return polygonIncludesPoint(point, bounds);
};
const pointOnPolycurve = (point, polycurve, tolerance) => {
    return polycurve.some((curve) => pointOnCurve(point, curve, tolerance));
};
const cubicBezierEquation = (curve) => {
    const [p0, p1, p2, p3] = curve;
    // B(t) = p0 * (1-t)^3 + 3p1 * t * (1-t)^2 + 3p2 * t^2 * (1-t) + p3 * t^3
    return (t, idx) => Math.pow(1 - t, 3) * p3[idx] +
        3 * t * Math.pow(1 - t, 2) * p2[idx] +
        3 * Math.pow(t, 2) * (1 - t) * p1[idx] +
        p0[idx] * Math.pow(t, 3);
};
const polyLineFromCurve = (curve, segments = 10) => {
    const equation = cubicBezierEquation(curve);
    let startingPoint = [equation(0, 0), equation(0, 1)];
    const lineSegments = [];
    let t = 0;
    const increment = 1 / segments;
    for (let i = 0; i < segments; i++) {
        t += increment;
        if (t <= 1) {
            const nextPoint = pointFrom(equation(t, 0), equation(t, 1));
            lineSegments.push(lineSegment(startingPoint, nextPoint));
            startingPoint = nextPoint;
        }
    }
    return lineSegments;
};
export const pointOnCurve = (point, curve, threshold) => {
    return pointOnPolyline(point, polyLineFromCurve(curve), threshold);
};
export const pointOnPolyline = (point, polyline, threshold = 10e-5) => {
    return polyline.some((line) => pointOnLineSegment(point, line, threshold));
};
