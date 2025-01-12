import { getTransformHandlesFromCoords, getTransformHandles, getOmitSidesForDevice, canResizeFromSides, } from "./transformHandles";
import { getElementAbsoluteCoords } from "./bounds";
import { SIDE_RESIZING_THRESHOLD } from "../constants";
import { isImageElement, isLinearElement } from "./typeChecks";
import { pointFrom, pointOnLineSegment, pointRotateRads, } from "../../math";
const isInsideTransformHandle = (transformHandle, x, y) => x >= transformHandle[0] &&
    x <= transformHandle[0] + transformHandle[2] &&
    y >= transformHandle[1] &&
    y <= transformHandle[1] + transformHandle[3];
export const resizeTest = (element, elementsMap, appState, x, y, zoom, pointerType, device) => {
    if (!appState.selectedElementIds[element.id]) {
        return false;
    }
    const { rotation: rotationTransformHandle, ...transformHandles } = getTransformHandles(element, zoom, elementsMap, pointerType, getOmitSidesForDevice(device));
    if (rotationTransformHandle &&
        isInsideTransformHandle(rotationTransformHandle, x, y)) {
        return "rotation";
    }
    const filter = Object.keys(transformHandles).filter((key) => {
        const transformHandle = transformHandles[key];
        if (!transformHandle) {
            return false;
        }
        return isInsideTransformHandle(transformHandle, x, y);
    });
    if (filter.length > 0) {
        return filter[0];
    }
    if (canResizeFromSides(device)) {
        const [x1, y1, x2, y2, cx, cy] = getElementAbsoluteCoords(element, elementsMap);
        // do not resize from the sides for linear elements with only two points
        if (!(isLinearElement(element) && element.points.length <= 2)) {
            const SPACING = isImageElement(element)
                ? 0
                : SIDE_RESIZING_THRESHOLD / zoom.value;
            const ZOOMED_SIDE_RESIZING_THRESHOLD = SIDE_RESIZING_THRESHOLD / zoom.value;
            const sides = getSelectionBorders(pointFrom(x1 - SPACING, y1 - SPACING), pointFrom(x2 + SPACING, y2 + SPACING), pointFrom(cx, cy), element.angle);
            for (const [dir, side] of Object.entries(sides)) {
                // test to see if x, y are on the line segment
                if (pointOnLineSegment(pointFrom(x, y), side, ZOOMED_SIDE_RESIZING_THRESHOLD)) {
                    return dir;
                }
            }
        }
    }
    return false;
};
export const getElementWithTransformHandleType = (elements, appState, scenePointerX, scenePointerY, zoom, pointerType, elementsMap, device) => {
    return elements.reduce((result, element) => {
        if (result) {
            return result;
        }
        const transformHandleType = resizeTest(element, elementsMap, appState, scenePointerX, scenePointerY, zoom, pointerType, device);
        return transformHandleType ? { element, transformHandleType } : null;
    }, null);
};
export const getTransformHandleTypeFromCoords = ([x1, y1, x2, y2], scenePointerX, scenePointerY, zoom, pointerType, device) => {
    const transformHandles = getTransformHandlesFromCoords([x1, y1, x2, y2, (x1 + x2) / 2, (y1 + y2) / 2], 0, zoom, pointerType, getOmitSidesForDevice(device));
    const found = Object.keys(transformHandles).find((key) => {
        const transformHandle = transformHandles[key];
        return (transformHandle &&
            isInsideTransformHandle(transformHandle, scenePointerX, scenePointerY));
    });
    if (found) {
        return found;
    }
    if (canResizeFromSides(device)) {
        const cx = (x1 + x2) / 2;
        const cy = (y1 + y2) / 2;
        const SPACING = SIDE_RESIZING_THRESHOLD / zoom.value;
        const sides = getSelectionBorders(pointFrom(x1 - SPACING, y1 - SPACING), pointFrom(x2 + SPACING, y2 + SPACING), pointFrom(cx, cy), 0);
        for (const [dir, side] of Object.entries(sides)) {
            // test to see if x, y are on the line segment
            if (pointOnLineSegment(pointFrom(scenePointerX, scenePointerY), side, SPACING)) {
                return dir;
            }
        }
    }
    return false;
};
const RESIZE_CURSORS = ["ns", "nesw", "ew", "nwse"];
const rotateResizeCursor = (cursor, angle) => {
    const index = RESIZE_CURSORS.indexOf(cursor);
    if (index >= 0) {
        const a = Math.round(angle / (Math.PI / 4));
        cursor = RESIZE_CURSORS[(index + a) % RESIZE_CURSORS.length];
    }
    return cursor;
};
/*
 * Returns bi-directional cursor for the element being resized
 */
export const getCursorForResizingElement = (resizingElement) => {
    const { element, transformHandleType } = resizingElement;
    const shouldSwapCursors = element && Math.sign(element.height) * Math.sign(element.width) === -1;
    let cursor = null;
    switch (transformHandleType) {
        case "n":
        case "s":
            cursor = "ns";
            break;
        case "w":
        case "e":
            cursor = "ew";
            break;
        case "nw":
        case "se":
            if (shouldSwapCursors) {
                cursor = "nesw";
            }
            else {
                cursor = "nwse";
            }
            break;
        case "ne":
        case "sw":
            if (shouldSwapCursors) {
                cursor = "nwse";
            }
            else {
                cursor = "nesw";
            }
            break;
        case "rotation":
            return "grab";
    }
    if (cursor && element) {
        cursor = rotateResizeCursor(cursor, element.angle);
    }
    return cursor ? `${cursor}-resize` : "";
};
const getSelectionBorders = ([x1, y1], [x2, y2], center, angle) => {
    const topLeft = pointRotateRads(pointFrom(x1, y1), center, angle);
    const topRight = pointRotateRads(pointFrom(x2, y1), center, angle);
    const bottomLeft = pointRotateRads(pointFrom(x1, y2), center, angle);
    const bottomRight = pointRotateRads(pointFrom(x2, y2), center, angle);
    return {
        n: [topLeft, topRight],
        e: [topRight, bottomRight],
        s: [bottomRight, bottomLeft],
        w: [bottomLeft, topLeft],
    };
};
