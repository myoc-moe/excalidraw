/**
 * this file defines pure geometric shapes
 *
 * for instance, a cubic bezier curve is specified by its four control points and
 * an ellipse is defined by its center, angle, semi major axis and semi minor axis
 * (but in semi-width and semi-height so it's more relevant to Excalidraw)
 *
 * the idea with pure shapes is so that we can provide collision and other geoemtric methods not depending on
 * the specifics of roughjs or elements in Excalidraw; instead, we can focus on the pure shapes themselves
 *
 * also included in this file are methods for converting an Excalidraw element or a Drawable from roughjs
 * to pure shapes
 */
import { curve, lineSegment, pointFrom, pointDistance, pointFromArray, pointFromVector, pointRotateRads, polygon, polygonFromPoints, PRECISION, segmentsIntersectAt, vector, vectorAdd, vectorFromPoint, vectorScale, } from "../../math";
import { getElementAbsoluteCoords } from "../../excalidraw/element";
import { pointsOnBezierCurves } from "points-on-curve";
import { invariant } from "../../excalidraw/utils";
// polygon
export const getPolygonShape = (element) => {
    const { angle, width, height, x, y } = element;
    const cx = x + width / 2;
    const cy = y + height / 2;
    const center = pointFrom(cx, cy);
    let data;
    if (element.type === "diamond") {
        data = polygon(pointRotateRads(pointFrom(cx, y), center, angle), pointRotateRads(pointFrom(x + width, cy), center, angle), pointRotateRads(pointFrom(cx, y + height), center, angle), pointRotateRads(pointFrom(x, cy), center, angle));
    }
    else {
        data = polygon(pointRotateRads(pointFrom(x, y), center, angle), pointRotateRads(pointFrom(x + width, y), center, angle), pointRotateRads(pointFrom(x + width, y + height), center, angle), pointRotateRads(pointFrom(x, y + height), center, angle));
    }
    return {
        type: "polygon",
        data,
    };
};
// return the selection box for an element, possibly rotated as well
export const getSelectionBoxShape = (element, elementsMap, padding = 10) => {
    let [x1, y1, x2, y2, cx, cy] = getElementAbsoluteCoords(element, elementsMap, true);
    x1 -= padding;
    x2 += padding;
    y1 -= padding;
    y2 += padding;
    //const angleInDegrees = angleToDegrees(element.angle);
    const center = pointFrom(cx, cy);
    const topLeft = pointRotateRads(pointFrom(x1, y1), center, element.angle);
    const topRight = pointRotateRads(pointFrom(x2, y1), center, element.angle);
    const bottomLeft = pointRotateRads(pointFrom(x1, y2), center, element.angle);
    const bottomRight = pointRotateRads(pointFrom(x2, y2), center, element.angle);
    return {
        type: "polygon",
        data: [topLeft, topRight, bottomRight, bottomLeft],
    };
};
// ellipse
export const getEllipseShape = (element) => {
    const { width, height, angle, x, y } = element;
    return {
        type: "ellipse",
        data: {
            center: pointFrom(x + width / 2, y + height / 2),
            angle,
            halfWidth: width / 2,
            halfHeight: height / 2,
        },
    };
};
export const getCurvePathOps = (shape) => {
    for (const set of shape.sets) {
        if (set.type === "path") {
            return set.ops;
        }
    }
    return shape.sets[0].ops;
};
// linear
export const getCurveShape = (roughShape, startingPoint = pointFrom(0, 0), angleInRadian, center) => {
    const transform = (p) => pointRotateRads(pointFrom(p[0] + startingPoint[0], p[1] + startingPoint[1]), center, angleInRadian);
    const ops = getCurvePathOps(roughShape);
    const polycurve = [];
    let p0 = pointFrom(0, 0);
    for (const op of ops) {
        if (op.op === "move") {
            const p = pointFromArray(op.data);
            invariant(p != null, "Ops data is not a point");
            p0 = transform(p);
        }
        if (op.op === "bcurveTo") {
            const p1 = transform(pointFrom(op.data[0], op.data[1]));
            const p2 = transform(pointFrom(op.data[2], op.data[3]));
            const p3 = transform(pointFrom(op.data[4], op.data[5]));
            polycurve.push(curve(p0, p1, p2, p3));
            p0 = p3;
        }
    }
    return {
        type: "polycurve",
        data: polycurve,
    };
};
const polylineFromPoints = (points) => {
    let previousPoint = points[0];
    const polyline = [];
    for (let i = 1; i < points.length; i++) {
        const nextPoint = points[i];
        polyline.push(lineSegment(previousPoint, nextPoint));
        previousPoint = nextPoint;
    }
    return polyline;
};
export const getFreedrawShape = (element, center, isClosed = false) => {
    const transform = (p) => pointRotateRads(pointFromVector(vectorAdd(vectorFromPoint(p), vector(element.x, element.y))), center, element.angle);
    const polyline = polylineFromPoints(element.points.map((p) => transform(p)));
    return (isClosed
        ? {
            type: "polygon",
            data: polygonFromPoints(polyline.flat()),
        }
        : {
            type: "polyline",
            data: polyline,
        });
};
export const getClosedCurveShape = (element, roughShape, startingPoint = pointFrom(0, 0), angleInRadian, center) => {
    const transform = (p) => pointRotateRads(pointFrom(p[0] + startingPoint[0], p[1] + startingPoint[1]), center, angleInRadian);
    if (element.roundness === null) {
        return {
            type: "polygon",
            data: polygonFromPoints(element.points.map((p) => transform(p))),
        };
    }
    const ops = getCurvePathOps(roughShape);
    const points = [];
    let odd = false;
    for (const operation of ops) {
        if (operation.op === "move") {
            odd = !odd;
            if (odd) {
                points.push(pointFrom(operation.data[0], operation.data[1]));
            }
        }
        else if (operation.op === "bcurveTo") {
            if (odd) {
                points.push(pointFrom(operation.data[0], operation.data[1]));
                points.push(pointFrom(operation.data[2], operation.data[3]));
                points.push(pointFrom(operation.data[4], operation.data[5]));
            }
        }
        else if (operation.op === "lineTo") {
            if (odd) {
                points.push(pointFrom(operation.data[0], operation.data[1]));
            }
        }
    }
    const polygonPoints = pointsOnBezierCurves(points, 10, 5).map((p) => transform(p));
    return {
        type: "polygon",
        data: polygonFromPoints(polygonPoints),
    };
};
/**
 * Determine intersection of a rectangular shaped element and a
 * line segment.
 *
 * @param element The rectangular element to test against
 * @param segment The segment intersecting the element
 * @param gap Optional value to inflate the shape before testing
 * @returns An array of intersections
 */
// TODO: Replace with final rounded rectangle code
export const segmentIntersectRectangleElement = (element, segment, gap = 0) => {
    const bounds = [
        element.x - gap,
        element.y - gap,
        element.x + element.width + gap,
        element.y + element.height + gap,
    ];
    const center = pointFrom((bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2);
    return [
        lineSegment(pointRotateRads(pointFrom(bounds[0], bounds[1]), center, element.angle), pointRotateRads(pointFrom(bounds[2], bounds[1]), center, element.angle)),
        lineSegment(pointRotateRads(pointFrom(bounds[2], bounds[1]), center, element.angle), pointRotateRads(pointFrom(bounds[2], bounds[3]), center, element.angle)),
        lineSegment(pointRotateRads(pointFrom(bounds[2], bounds[3]), center, element.angle), pointRotateRads(pointFrom(bounds[0], bounds[3]), center, element.angle)),
        lineSegment(pointRotateRads(pointFrom(bounds[0], bounds[3]), center, element.angle), pointRotateRads(pointFrom(bounds[0], bounds[1]), center, element.angle)),
    ]
        .map((s) => segmentsIntersectAt(segment, s))
        .filter((i) => !!i);
};
const distanceToEllipse = (p, ellipse) => {
    const { angle, halfWidth, halfHeight, center } = ellipse;
    const a = halfWidth;
    const b = halfHeight;
    const translatedPoint = vectorAdd(vectorFromPoint(p), vectorScale(vectorFromPoint(center), -1));
    const [rotatedPointX, rotatedPointY] = pointRotateRads(pointFromVector(translatedPoint), pointFrom(0, 0), -angle);
    const px = Math.abs(rotatedPointX);
    const py = Math.abs(rotatedPointY);
    let tx = 0.707;
    let ty = 0.707;
    for (let i = 0; i < 3; i++) {
        const x = a * tx;
        const y = b * ty;
        const ex = ((a * a - b * b) * tx ** 3) / a;
        const ey = ((b * b - a * a) * ty ** 3) / b;
        const rx = x - ex;
        const ry = y - ey;
        const qx = px - ex;
        const qy = py - ey;
        const r = Math.hypot(ry, rx);
        const q = Math.hypot(qy, qx);
        tx = Math.min(1, Math.max(0, ((qx * r) / q + ex) / a));
        ty = Math.min(1, Math.max(0, ((qy * r) / q + ey) / b));
        const t = Math.hypot(ty, tx);
        tx /= t;
        ty /= t;
    }
    const [minX, minY] = [
        a * tx * Math.sign(rotatedPointX),
        b * ty * Math.sign(rotatedPointY),
    ];
    return pointDistance(pointFrom(rotatedPointX, rotatedPointY), pointFrom(minX, minY));
};
export const pointOnEllipse = (point, ellipse, threshold = PRECISION) => {
    return distanceToEllipse(point, ellipse) <= threshold;
};
export const pointInEllipse = (p, ellipse) => {
    const { center, angle, halfWidth, halfHeight } = ellipse;
    const translatedPoint = vectorAdd(vectorFromPoint(p), vectorScale(vectorFromPoint(center), -1));
    const [rotatedPointX, rotatedPointY] = pointRotateRads(pointFromVector(translatedPoint), pointFrom(0, 0), -angle);
    return ((rotatedPointX / halfWidth) * (rotatedPointX / halfWidth) +
        (rotatedPointY / halfHeight) * (rotatedPointY / halfHeight) <=
        1);
};
export const ellipseAxes = (ellipse) => {
    const widthGreaterThanHeight = ellipse.halfWidth > ellipse.halfHeight;
    const majorAxis = widthGreaterThanHeight
        ? ellipse.halfWidth * 2
        : ellipse.halfHeight * 2;
    const minorAxis = widthGreaterThanHeight
        ? ellipse.halfHeight * 2
        : ellipse.halfWidth * 2;
    return {
        majorAxis,
        minorAxis,
    };
};
export const ellipseFocusToCenter = (ellipse) => {
    const { majorAxis, minorAxis } = ellipseAxes(ellipse);
    return Math.sqrt(majorAxis ** 2 - minorAxis ** 2);
};
export const ellipseExtremes = (ellipse) => {
    const { center, angle } = ellipse;
    const { majorAxis, minorAxis } = ellipseAxes(ellipse);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const sqSum = majorAxis ** 2 + minorAxis ** 2;
    const sqDiff = (majorAxis ** 2 - minorAxis ** 2) * Math.cos(2 * angle);
    const yMax = Math.sqrt((sqSum - sqDiff) / 2);
    const xAtYMax = (yMax * sqSum * sin * cos) /
        (majorAxis ** 2 * sin ** 2 + minorAxis ** 2 * cos ** 2);
    const xMax = Math.sqrt((sqSum + sqDiff) / 2);
    const yAtXMax = (xMax * sqSum * sin * cos) /
        (majorAxis ** 2 * cos ** 2 + minorAxis ** 2 * sin ** 2);
    const centerVector = vectorFromPoint(center);
    return [
        vectorAdd(vector(xAtYMax, yMax), centerVector),
        vectorAdd(vectorScale(vector(xAtYMax, yMax), -1), centerVector),
        vectorAdd(vector(xMax, yAtXMax), centerVector),
        vectorAdd(vector(xMax, yAtXMax), centerVector),
    ];
};
