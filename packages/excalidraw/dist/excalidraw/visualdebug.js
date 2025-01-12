import { isLineSegment, lineSegment, pointFrom, } from "../math";
import { isBounds } from "./element/typeChecks";
export const debugDrawLine = (segment, opts) => {
    const segments = (isLineSegment(segment) ? [segment] : segment);
    segments.forEach((data) => addToCurrentFrame({
        color: opts?.color ?? "red",
        data,
        permanent: !!opts?.permanent,
    }));
};
export const debugDrawPoint = (p, opts) => {
    const xOffset = opts?.fuzzy ? Math.random() * 3 : 0;
    const yOffset = opts?.fuzzy ? Math.random() * 3 : 0;
    debugDrawLine(lineSegment(pointFrom(p[0] + xOffset - 10, p[1] + yOffset - 10), pointFrom(p[0] + xOffset + 10, p[1] + yOffset + 10)), {
        color: opts?.color ?? "cyan",
        permanent: opts?.permanent,
    });
    debugDrawLine(lineSegment(pointFrom(p[0] + xOffset - 10, p[1] + yOffset + 10), pointFrom(p[0] + xOffset + 10, p[1] + yOffset - 10)), {
        color: opts?.color ?? "cyan",
        permanent: opts?.permanent,
    });
};
export const debugDrawBoundingBox = (box, opts) => {
    (Array.isArray(box) ? box : [box]).forEach((bbox) => debugDrawLine([
        lineSegment(pointFrom(bbox.minX, bbox.minY), pointFrom(bbox.maxX, bbox.minY)),
        lineSegment(pointFrom(bbox.maxX, bbox.minY), pointFrom(bbox.maxX, bbox.maxY)),
        lineSegment(pointFrom(bbox.maxX, bbox.maxY), pointFrom(bbox.minX, bbox.maxY)),
        lineSegment(pointFrom(bbox.minX, bbox.maxY), pointFrom(bbox.minX, bbox.minY)),
    ], {
        color: opts?.color ?? "cyan",
        permanent: opts?.permanent,
    }));
};
export const debugDrawBounds = (box, opts) => {
    (isBounds(box) ? [box] : box).forEach((bbox) => debugDrawLine([
        lineSegment(pointFrom(bbox[0], bbox[1]), pointFrom(bbox[2], bbox[1])),
        lineSegment(pointFrom(bbox[2], bbox[1]), pointFrom(bbox[2], bbox[3])),
        lineSegment(pointFrom(bbox[2], bbox[3]), pointFrom(bbox[0], bbox[3])),
        lineSegment(pointFrom(bbox[0], bbox[3]), pointFrom(bbox[0], bbox[1])),
    ], {
        color: opts?.color ?? "green",
        permanent: !!opts?.permanent,
    }));
};
export const debugCloseFrame = () => {
    window.visualDebug?.data.push([]);
};
export const debugClear = () => {
    if (window.visualDebug?.data) {
        window.visualDebug.data = [];
    }
};
const addToCurrentFrame = (element) => {
    if (window.visualDebug?.data && window.visualDebug.data.length === 0) {
        window.visualDebug.data[0] = [];
    }
    window.visualDebug?.data &&
        window.visualDebug.data[window.visualDebug.data.length - 1].push(element);
};
