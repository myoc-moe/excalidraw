import { pointFrom, pointRotateRads, rangeInclusive, rangeIntersection, rangesOverlap, } from "../math";
import { TOOL_TYPE } from "./constants";
import { getCommonBounds, getDraggedElementsBounds, getElementAbsoluteCoords, } from "./element/bounds";
import { isBoundToContainer, isFrameLikeElement } from "./element/typeChecks";
import { getMaximumGroups } from "./groups";
import { KEYS } from "./keys";
import { getSelectedElements, getVisibleAndNonSelectedElements, } from "./scene/selection";
const SNAP_DISTANCE = 8;
// do not comput more gaps per axis than this limit
// TODO increase or remove once we optimize
const VISIBLE_GAPS_LIMIT_PER_AXIS = 99999;
// snap distance with zoom value taken into consideration
export const getSnapDistance = (zoomValue) => {
    return SNAP_DISTANCE / zoomValue;
};
// -----------------------------------------------------------------------------
export class SnapCache {
    static referenceSnapPoints = null;
    static visibleGaps = null;
    static setReferenceSnapPoints = (snapPoints) => {
        SnapCache.referenceSnapPoints = snapPoints;
    };
    static getReferenceSnapPoints = () => {
        return SnapCache.referenceSnapPoints;
    };
    static setVisibleGaps = (gaps) => {
        SnapCache.visibleGaps = gaps;
    };
    static getVisibleGaps = () => {
        return SnapCache.visibleGaps;
    };
    static destroy = () => {
        SnapCache.referenceSnapPoints = null;
        SnapCache.visibleGaps = null;
    };
}
// -----------------------------------------------------------------------------
export const isGridModeEnabled = (app) => app.props.gridModeEnabled ?? app.state.gridModeEnabled;
export const isSnappingEnabled = ({ event, app, selectedElements, }) => {
    if (event) {
        return ((app.state.objectsSnapModeEnabled && !event[KEYS.CTRL_OR_CMD]) ||
            (!app.state.objectsSnapModeEnabled &&
                event[KEYS.CTRL_OR_CMD] &&
                !isGridModeEnabled(app)));
    }
    // do not suggest snaps for an arrow to give way to binding
    if (selectedElements.length === 1 && selectedElements[0].type === "arrow") {
        return false;
    }
    return app.state.objectsSnapModeEnabled;
};
export const areRoughlyEqual = (a, b, precision = 0.01) => {
    return Math.abs(a - b) <= precision;
};
export const getElementsCorners = (elements, elementsMap, { omitCenter, boundingBoxCorners, dragOffset, } = {
    omitCenter: false,
    boundingBoxCorners: false,
}) => {
    let result = [];
    if (elements.length === 1) {
        const element = elements[0];
        let [x1, y1, x2, y2, cx, cy] = getElementAbsoluteCoords(element, elementsMap);
        if (dragOffset) {
            x1 += dragOffset.x;
            x2 += dragOffset.x;
            cx += dragOffset.x;
            y1 += dragOffset.y;
            y2 += dragOffset.y;
            cy += dragOffset.y;
        }
        const halfWidth = (x2 - x1) / 2;
        const halfHeight = (y2 - y1) / 2;
        if ((element.type === "diamond" || element.type === "ellipse") &&
            !boundingBoxCorners) {
            const leftMid = pointRotateRads(pointFrom(x1, y1 + halfHeight), pointFrom(cx, cy), element.angle);
            const topMid = pointRotateRads(pointFrom(x1 + halfWidth, y1), pointFrom(cx, cy), element.angle);
            const rightMid = pointRotateRads(pointFrom(x2, y1 + halfHeight), pointFrom(cx, cy), element.angle);
            const bottomMid = pointRotateRads(pointFrom(x1 + halfWidth, y2), pointFrom(cx, cy), element.angle);
            const center = pointFrom(cx, cy);
            result = omitCenter
                ? [leftMid, topMid, rightMid, bottomMid]
                : [leftMid, topMid, rightMid, bottomMid, center];
        }
        else {
            const topLeft = pointRotateRads(pointFrom(x1, y1), pointFrom(cx, cy), element.angle);
            const topRight = pointRotateRads(pointFrom(x2, y1), pointFrom(cx, cy), element.angle);
            const bottomLeft = pointRotateRads(pointFrom(x1, y2), pointFrom(cx, cy), element.angle);
            const bottomRight = pointRotateRads(pointFrom(x2, y2), pointFrom(cx, cy), element.angle);
            const center = pointFrom(cx, cy);
            result = omitCenter
                ? [topLeft, topRight, bottomLeft, bottomRight]
                : [topLeft, topRight, bottomLeft, bottomRight, center];
        }
    }
    else if (elements.length > 1) {
        const [minX, minY, maxX, maxY] = getDraggedElementsBounds(elements, dragOffset ?? { x: 0, y: 0 });
        const width = maxX - minX;
        const height = maxY - minY;
        const topLeft = pointFrom(minX, minY);
        const topRight = pointFrom(maxX, minY);
        const bottomLeft = pointFrom(minX, maxY);
        const bottomRight = pointFrom(maxX, maxY);
        const center = pointFrom(minX + width / 2, minY + height / 2);
        result = omitCenter
            ? [topLeft, topRight, bottomLeft, bottomRight]
            : [topLeft, topRight, bottomLeft, bottomRight, center];
    }
    return result.map((p) => pointFrom(round(p[0]), round(p[1])));
};
const getReferenceElements = (elements, selectedElements, appState, elementsMap) => {
    const selectedFrames = selectedElements
        .filter((element) => isFrameLikeElement(element))
        .map((frame) => frame.id);
    return getVisibleAndNonSelectedElements(elements, selectedElements, appState, elementsMap).filter((element) => !(element.frameId && selectedFrames.includes(element.frameId)));
};
export const getVisibleGaps = (elements, selectedElements, appState, elementsMap) => {
    const referenceElements = getReferenceElements(elements, selectedElements, appState, elementsMap);
    const referenceBounds = getMaximumGroups(referenceElements, elementsMap)
        .filter((elementsGroup) => !(elementsGroup.length === 1 && isBoundToContainer(elementsGroup[0])))
        .map((group) => getCommonBounds(group).map((bound) => round(bound)));
    const horizontallySorted = referenceBounds.sort((a, b) => a[0] - b[0]);
    const horizontalGaps = [];
    let c = 0;
    horizontal: for (let i = 0; i < horizontallySorted.length; i++) {
        const startBounds = horizontallySorted[i];
        for (let j = i + 1; j < horizontallySorted.length; j++) {
            if (++c > VISIBLE_GAPS_LIMIT_PER_AXIS) {
                break horizontal;
            }
            const endBounds = horizontallySorted[j];
            const [, startMinY, startMaxX, startMaxY] = startBounds;
            const [endMinX, endMinY, , endMaxY] = endBounds;
            if (startMaxX < endMinX &&
                rangesOverlap(rangeInclusive(startMinY, startMaxY), rangeInclusive(endMinY, endMaxY))) {
                horizontalGaps.push({
                    startBounds,
                    endBounds,
                    startSide: [
                        pointFrom(startMaxX, startMinY),
                        pointFrom(startMaxX, startMaxY),
                    ],
                    endSide: [pointFrom(endMinX, endMinY), pointFrom(endMinX, endMaxY)],
                    length: endMinX - startMaxX,
                    overlap: rangeIntersection(rangeInclusive(startMinY, startMaxY), rangeInclusive(endMinY, endMaxY)),
                });
            }
        }
    }
    const verticallySorted = referenceBounds.sort((a, b) => a[1] - b[1]);
    const verticalGaps = [];
    c = 0;
    vertical: for (let i = 0; i < verticallySorted.length; i++) {
        const startBounds = verticallySorted[i];
        for (let j = i + 1; j < verticallySorted.length; j++) {
            if (++c > VISIBLE_GAPS_LIMIT_PER_AXIS) {
                break vertical;
            }
            const endBounds = verticallySorted[j];
            const [startMinX, , startMaxX, startMaxY] = startBounds;
            const [endMinX, endMinY, endMaxX] = endBounds;
            if (startMaxY < endMinY &&
                rangesOverlap(rangeInclusive(startMinX, startMaxX), rangeInclusive(endMinX, endMaxX))) {
                verticalGaps.push({
                    startBounds,
                    endBounds,
                    startSide: [
                        pointFrom(startMinX, startMaxY),
                        pointFrom(startMaxX, startMaxY),
                    ],
                    endSide: [pointFrom(endMinX, endMinY), pointFrom(endMaxX, endMinY)],
                    length: endMinY - startMaxY,
                    overlap: rangeIntersection(rangeInclusive(startMinX, startMaxX), rangeInclusive(endMinX, endMaxX)),
                });
            }
        }
    }
    return {
        horizontalGaps,
        verticalGaps,
    };
};
const getGapSnaps = (selectedElements, dragOffset, app, event, nearestSnapsX, nearestSnapsY, minOffset) => {
    if (!isSnappingEnabled({ app, event, selectedElements })) {
        return [];
    }
    if (selectedElements.length === 0) {
        return [];
    }
    const visibleGaps = SnapCache.getVisibleGaps();
    if (visibleGaps) {
        const { horizontalGaps, verticalGaps } = visibleGaps;
        const [minX, minY, maxX, maxY] = getDraggedElementsBounds(selectedElements, dragOffset).map((bound) => round(bound));
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        for (const gap of horizontalGaps) {
            if (!rangesOverlap(rangeInclusive(minY, maxY), gap.overlap)) {
                continue;
            }
            // center gap
            const gapMidX = gap.startSide[0][0] + gap.length / 2;
            const centerOffset = round(gapMidX - centerX);
            const gapIsLargerThanSelection = gap.length > maxX - minX;
            if (gapIsLargerThanSelection && Math.abs(centerOffset) <= minOffset.x) {
                if (Math.abs(centerOffset) < minOffset.x) {
                    nearestSnapsX.length = 0;
                }
                minOffset.x = Math.abs(centerOffset);
                const snap = {
                    type: "gap",
                    direction: "center_horizontal",
                    gap,
                    offset: centerOffset,
                };
                nearestSnapsX.push(snap);
                continue;
            }
            // side gap, from the right
            const [, , endMaxX] = gap.endBounds;
            const distanceToEndElementX = minX - endMaxX;
            const sideOffsetRight = round(gap.length - distanceToEndElementX);
            if (Math.abs(sideOffsetRight) <= minOffset.x) {
                if (Math.abs(sideOffsetRight) < minOffset.x) {
                    nearestSnapsX.length = 0;
                }
                minOffset.x = Math.abs(sideOffsetRight);
                const snap = {
                    type: "gap",
                    direction: "side_right",
                    gap,
                    offset: sideOffsetRight,
                };
                nearestSnapsX.push(snap);
                continue;
            }
            // side gap, from the left
            const [startMinX, , ,] = gap.startBounds;
            const distanceToStartElementX = startMinX - maxX;
            const sideOffsetLeft = round(distanceToStartElementX - gap.length);
            if (Math.abs(sideOffsetLeft) <= minOffset.x) {
                if (Math.abs(sideOffsetLeft) < minOffset.x) {
                    nearestSnapsX.length = 0;
                }
                minOffset.x = Math.abs(sideOffsetLeft);
                const snap = {
                    type: "gap",
                    direction: "side_left",
                    gap,
                    offset: sideOffsetLeft,
                };
                nearestSnapsX.push(snap);
                continue;
            }
        }
        for (const gap of verticalGaps) {
            if (!rangesOverlap(rangeInclusive(minX, maxX), gap.overlap)) {
                continue;
            }
            // center gap
            const gapMidY = gap.startSide[0][1] + gap.length / 2;
            const centerOffset = round(gapMidY - centerY);
            const gapIsLargerThanSelection = gap.length > maxY - minY;
            if (gapIsLargerThanSelection && Math.abs(centerOffset) <= minOffset.y) {
                if (Math.abs(centerOffset) < minOffset.y) {
                    nearestSnapsY.length = 0;
                }
                minOffset.y = Math.abs(centerOffset);
                const snap = {
                    type: "gap",
                    direction: "center_vertical",
                    gap,
                    offset: centerOffset,
                };
                nearestSnapsY.push(snap);
                continue;
            }
            // side gap, from the top
            const [, startMinY, ,] = gap.startBounds;
            const distanceToStartElementY = startMinY - maxY;
            const sideOffsetTop = round(distanceToStartElementY - gap.length);
            if (Math.abs(sideOffsetTop) <= minOffset.y) {
                if (Math.abs(sideOffsetTop) < minOffset.y) {
                    nearestSnapsY.length = 0;
                }
                minOffset.y = Math.abs(sideOffsetTop);
                const snap = {
                    type: "gap",
                    direction: "side_top",
                    gap,
                    offset: sideOffsetTop,
                };
                nearestSnapsY.push(snap);
                continue;
            }
            // side gap, from the bottom
            const [, , , endMaxY] = gap.endBounds;
            const distanceToEndElementY = round(minY - endMaxY);
            const sideOffsetBottom = gap.length - distanceToEndElementY;
            if (Math.abs(sideOffsetBottom) <= minOffset.y) {
                if (Math.abs(sideOffsetBottom) < minOffset.y) {
                    nearestSnapsY.length = 0;
                }
                minOffset.y = Math.abs(sideOffsetBottom);
                const snap = {
                    type: "gap",
                    direction: "side_bottom",
                    gap,
                    offset: sideOffsetBottom,
                };
                nearestSnapsY.push(snap);
                continue;
            }
        }
    }
};
export const getReferenceSnapPoints = (elements, selectedElements, appState, elementsMap) => {
    const referenceElements = getReferenceElements(elements, selectedElements, appState, elementsMap);
    return getMaximumGroups(referenceElements, elementsMap)
        .filter((elementsGroup) => !(elementsGroup.length === 1 && isBoundToContainer(elementsGroup[0])))
        .flatMap((elementGroup) => getElementsCorners(elementGroup, elementsMap));
};
const getPointSnaps = (selectedElements, selectionSnapPoints, app, event, nearestSnapsX, nearestSnapsY, minOffset) => {
    if (!isSnappingEnabled({ app, event, selectedElements }) ||
        (selectedElements.length === 0 && selectionSnapPoints.length === 0)) {
        return [];
    }
    const referenceSnapPoints = SnapCache.getReferenceSnapPoints();
    if (referenceSnapPoints) {
        for (const thisSnapPoint of selectionSnapPoints) {
            for (const otherSnapPoint of referenceSnapPoints) {
                const offsetX = otherSnapPoint[0] - thisSnapPoint[0];
                const offsetY = otherSnapPoint[1] - thisSnapPoint[1];
                if (Math.abs(offsetX) <= minOffset.x) {
                    if (Math.abs(offsetX) < minOffset.x) {
                        nearestSnapsX.length = 0;
                    }
                    nearestSnapsX.push({
                        type: "point",
                        points: [thisSnapPoint, otherSnapPoint],
                        offset: offsetX,
                    });
                    minOffset.x = Math.abs(offsetX);
                }
                if (Math.abs(offsetY) <= minOffset.y) {
                    if (Math.abs(offsetY) < minOffset.y) {
                        nearestSnapsY.length = 0;
                    }
                    nearestSnapsY.push({
                        type: "point",
                        points: [thisSnapPoint, otherSnapPoint],
                        offset: offsetY,
                    });
                    minOffset.y = Math.abs(offsetY);
                }
            }
        }
    }
};
export const snapDraggedElements = (elements, dragOffset, app, event, elementsMap) => {
    const appState = app.state;
    const selectedElements = getSelectedElements(elements, appState);
    if (!isSnappingEnabled({ app, event, selectedElements }) ||
        selectedElements.length === 0) {
        return {
            snapOffset: {
                x: 0,
                y: 0,
            },
            snapLines: [],
        };
    }
    dragOffset.x = round(dragOffset.x);
    dragOffset.y = round(dragOffset.y);
    const nearestSnapsX = [];
    const nearestSnapsY = [];
    const snapDistance = getSnapDistance(appState.zoom.value);
    const minOffset = {
        x: snapDistance,
        y: snapDistance,
    };
    const selectionPoints = getElementsCorners(selectedElements, elementsMap, {
        dragOffset,
    });
    // get the nearest horizontal and vertical point and gap snaps
    getPointSnaps(selectedElements, selectionPoints, app, event, nearestSnapsX, nearestSnapsY, minOffset);
    getGapSnaps(selectedElements, dragOffset, app, event, nearestSnapsX, nearestSnapsY, minOffset);
    // using the nearest snaps to figure out how
    // much the elements need to be offset to be snapped
    // to some reference elements
    const snapOffset = {
        x: nearestSnapsX[0]?.offset ?? 0,
        y: nearestSnapsY[0]?.offset ?? 0,
    };
    // once the elements are snapped
    // and moved to the snapped position
    // we want to use the element's snapped position
    // to update nearest snaps so that we can create
    // point and gap snap lines correctly without any shifting
    minOffset.x = 0;
    minOffset.y = 0;
    nearestSnapsX.length = 0;
    nearestSnapsY.length = 0;
    const newDragOffset = {
        x: round(dragOffset.x + snapOffset.x),
        y: round(dragOffset.y + snapOffset.y),
    };
    getPointSnaps(selectedElements, getElementsCorners(selectedElements, elementsMap, {
        dragOffset: newDragOffset,
    }), app, event, nearestSnapsX, nearestSnapsY, minOffset);
    getGapSnaps(selectedElements, newDragOffset, app, event, nearestSnapsX, nearestSnapsY, minOffset);
    const pointSnapLines = createPointSnapLines(nearestSnapsX, nearestSnapsY);
    const gapSnapLines = createGapSnapLines(selectedElements, newDragOffset, [...nearestSnapsX, ...nearestSnapsY].filter((snap) => snap.type === "gap"));
    return {
        snapOffset,
        snapLines: [...pointSnapLines, ...gapSnapLines],
    };
};
const round = (x) => {
    const decimalPlaces = 6;
    return Math.round(x * 10 ** decimalPlaces) / 10 ** decimalPlaces;
};
const dedupePoints = (points) => {
    const map = new Map();
    for (const point of points) {
        const key = point.join(",");
        if (!map.has(key)) {
            map.set(key, point);
        }
    }
    return Array.from(map.values());
};
const createPointSnapLines = (nearestSnapsX, nearestSnapsY) => {
    const snapsX = {};
    const snapsY = {};
    if (nearestSnapsX.length > 0) {
        for (const snap of nearestSnapsX) {
            if (snap.type === "point") {
                // key = thisPoint.x
                const key = round(snap.points[0][0]);
                if (!snapsX[key]) {
                    snapsX[key] = [];
                }
                snapsX[key].push(...snap.points.map((p) => pointFrom(round(p[0]), round(p[1]))));
            }
        }
    }
    if (nearestSnapsY.length > 0) {
        for (const snap of nearestSnapsY) {
            if (snap.type === "point") {
                // key = thisPoint.y
                const key = round(snap.points[0][1]);
                if (!snapsY[key]) {
                    snapsY[key] = [];
                }
                snapsY[key].push(...snap.points.map((p) => pointFrom(round(p[0]), round(p[1]))));
            }
        }
    }
    return Object.entries(snapsX)
        .map(([key, points]) => {
        return {
            type: "points",
            points: dedupePoints(points
                .map((p) => {
                return pointFrom(Number(key), p[1]);
            })
                .sort((a, b) => a[1] - b[1])),
        };
    })
        .concat(Object.entries(snapsY).map(([key, points]) => {
        return {
            type: "points",
            points: dedupePoints(points
                .map((p) => {
                return pointFrom(p[0], Number(key));
            })
                .sort((a, b) => a[0] - b[0])),
        };
    }));
};
const dedupeGapSnapLines = (gapSnapLines) => {
    const map = new Map();
    for (const gapSnapLine of gapSnapLines) {
        const key = gapSnapLine.points
            .flat()
            .map((point) => [round(point)])
            .join(",");
        if (!map.has(key)) {
            map.set(key, gapSnapLine);
        }
    }
    return Array.from(map.values());
};
const createGapSnapLines = (selectedElements, dragOffset, gapSnaps) => {
    const [minX, minY, maxX, maxY] = getDraggedElementsBounds(selectedElements, dragOffset);
    const gapSnapLines = [];
    for (const gapSnap of gapSnaps) {
        const [startMinX, startMinY, startMaxX, startMaxY] = gapSnap.gap.startBounds;
        const [endMinX, endMinY, endMaxX, endMaxY] = gapSnap.gap.endBounds;
        const verticalIntersection = rangeIntersection(rangeInclusive(minY, maxY), gapSnap.gap.overlap);
        const horizontalGapIntersection = rangeIntersection(rangeInclusive(minX, maxX), gapSnap.gap.overlap);
        switch (gapSnap.direction) {
            case "center_horizontal": {
                if (verticalIntersection) {
                    const gapLineY = (verticalIntersection[0] + verticalIntersection[1]) / 2;
                    gapSnapLines.push({
                        type: "gap",
                        direction: "horizontal",
                        points: [
                            pointFrom(gapSnap.gap.startSide[0][0], gapLineY),
                            pointFrom(minX, gapLineY),
                        ],
                    }, {
                        type: "gap",
                        direction: "horizontal",
                        points: [
                            pointFrom(maxX, gapLineY),
                            pointFrom(gapSnap.gap.endSide[0][0], gapLineY),
                        ],
                    });
                }
                break;
            }
            case "center_vertical": {
                if (horizontalGapIntersection) {
                    const gapLineX = (horizontalGapIntersection[0] + horizontalGapIntersection[1]) / 2;
                    gapSnapLines.push({
                        type: "gap",
                        direction: "vertical",
                        points: [
                            pointFrom(gapLineX, gapSnap.gap.startSide[0][1]),
                            pointFrom(gapLineX, minY),
                        ],
                    }, {
                        type: "gap",
                        direction: "vertical",
                        points: [
                            pointFrom(gapLineX, maxY),
                            pointFrom(gapLineX, gapSnap.gap.endSide[0][1]),
                        ],
                    });
                }
                break;
            }
            case "side_right": {
                if (verticalIntersection) {
                    const gapLineY = (verticalIntersection[0] + verticalIntersection[1]) / 2;
                    gapSnapLines.push({
                        type: "gap",
                        direction: "horizontal",
                        points: [
                            pointFrom(startMaxX, gapLineY),
                            pointFrom(endMinX, gapLineY),
                        ],
                    }, {
                        type: "gap",
                        direction: "horizontal",
                        points: [pointFrom(endMaxX, gapLineY), pointFrom(minX, gapLineY)],
                    });
                }
                break;
            }
            case "side_left": {
                if (verticalIntersection) {
                    const gapLineY = (verticalIntersection[0] + verticalIntersection[1]) / 2;
                    gapSnapLines.push({
                        type: "gap",
                        direction: "horizontal",
                        points: [
                            pointFrom(maxX, gapLineY),
                            pointFrom(startMinX, gapLineY),
                        ],
                    }, {
                        type: "gap",
                        direction: "horizontal",
                        points: [
                            pointFrom(startMaxX, gapLineY),
                            pointFrom(endMinX, gapLineY),
                        ],
                    });
                }
                break;
            }
            case "side_top": {
                if (horizontalGapIntersection) {
                    const gapLineX = (horizontalGapIntersection[0] + horizontalGapIntersection[1]) / 2;
                    gapSnapLines.push({
                        type: "gap",
                        direction: "vertical",
                        points: [
                            pointFrom(gapLineX, maxY),
                            pointFrom(gapLineX, startMinY),
                        ],
                    }, {
                        type: "gap",
                        direction: "vertical",
                        points: [
                            pointFrom(gapLineX, startMaxY),
                            pointFrom(gapLineX, endMinY),
                        ],
                    });
                }
                break;
            }
            case "side_bottom": {
                if (horizontalGapIntersection) {
                    const gapLineX = (horizontalGapIntersection[0] + horizontalGapIntersection[1]) / 2;
                    gapSnapLines.push({
                        type: "gap",
                        direction: "vertical",
                        points: [
                            pointFrom(gapLineX, startMaxY),
                            pointFrom(gapLineX, endMinY),
                        ],
                    }, {
                        type: "gap",
                        direction: "vertical",
                        points: [pointFrom(gapLineX, endMaxY), pointFrom(gapLineX, minY)],
                    });
                }
                break;
            }
        }
    }
    return dedupeGapSnapLines(gapSnapLines.map((gapSnapLine) => {
        return {
            ...gapSnapLine,
            points: gapSnapLine.points.map((p) => pointFrom(round(p[0]), round(p[1]))),
        };
    }));
};
export const snapResizingElements = (
// use the latest elements to create snap lines
selectedElements, 
// while using the original elements to appy dragOffset to calculate snaps
selectedOriginalElements, app, event, dragOffset, transformHandle) => {
    if (!isSnappingEnabled({ event, selectedElements, app }) ||
        selectedElements.length === 0 ||
        (selectedElements.length === 1 &&
            !areRoughlyEqual(selectedElements[0].angle, 0))) {
        return {
            snapOffset: { x: 0, y: 0 },
            snapLines: [],
        };
    }
    let [minX, minY, maxX, maxY] = getCommonBounds(selectedOriginalElements);
    if (transformHandle) {
        if (transformHandle.includes("e")) {
            maxX += dragOffset.x;
        }
        else if (transformHandle.includes("w")) {
            minX += dragOffset.x;
        }
        if (transformHandle.includes("n")) {
            minY += dragOffset.y;
        }
        else if (transformHandle.includes("s")) {
            maxY += dragOffset.y;
        }
    }
    const selectionSnapPoints = [];
    if (transformHandle) {
        switch (transformHandle) {
            case "e": {
                selectionSnapPoints.push(pointFrom(maxX, minY), pointFrom(maxX, maxY));
                break;
            }
            case "w": {
                selectionSnapPoints.push(pointFrom(minX, minY), pointFrom(minX, maxY));
                break;
            }
            case "n": {
                selectionSnapPoints.push(pointFrom(minX, minY), pointFrom(maxX, minY));
                break;
            }
            case "s": {
                selectionSnapPoints.push(pointFrom(minX, maxY), pointFrom(maxX, maxY));
                break;
            }
            case "ne": {
                selectionSnapPoints.push(pointFrom(maxX, minY));
                break;
            }
            case "nw": {
                selectionSnapPoints.push(pointFrom(minX, minY));
                break;
            }
            case "se": {
                selectionSnapPoints.push(pointFrom(maxX, maxY));
                break;
            }
            case "sw": {
                selectionSnapPoints.push(pointFrom(minX, maxY));
                break;
            }
        }
    }
    const snapDistance = getSnapDistance(app.state.zoom.value);
    const minOffset = {
        x: snapDistance,
        y: snapDistance,
    };
    const nearestSnapsX = [];
    const nearestSnapsY = [];
    getPointSnaps(selectedOriginalElements, selectionSnapPoints, app, event, nearestSnapsX, nearestSnapsY, minOffset);
    const snapOffset = {
        x: nearestSnapsX[0]?.offset ?? 0,
        y: nearestSnapsY[0]?.offset ?? 0,
    };
    // again, once snap offset is calculated
    // reset to recompute for creating snap lines to be rendered
    minOffset.x = 0;
    minOffset.y = 0;
    nearestSnapsX.length = 0;
    nearestSnapsY.length = 0;
    const [x1, y1, x2, y2] = getCommonBounds(selectedElements).map((bound) => round(bound));
    const corners = [
        pointFrom(x1, y1),
        pointFrom(x1, y2),
        pointFrom(x2, y1),
        pointFrom(x2, y2),
    ];
    getPointSnaps(selectedElements, corners, app, event, nearestSnapsX, nearestSnapsY, minOffset);
    const pointSnapLines = createPointSnapLines(nearestSnapsX, nearestSnapsY);
    return {
        snapOffset,
        snapLines: pointSnapLines,
    };
};
export const snapNewElement = (newElement, app, event, origin, dragOffset, elementsMap) => {
    if (!isSnappingEnabled({ event, selectedElements: [newElement], app })) {
        return {
            snapOffset: { x: 0, y: 0 },
            snapLines: [],
        };
    }
    const selectionSnapPoints = [
        pointFrom(origin.x + dragOffset.x, origin.y + dragOffset.y),
    ];
    const snapDistance = getSnapDistance(app.state.zoom.value);
    const minOffset = {
        x: snapDistance,
        y: snapDistance,
    };
    const nearestSnapsX = [];
    const nearestSnapsY = [];
    getPointSnaps([newElement], selectionSnapPoints, app, event, nearestSnapsX, nearestSnapsY, minOffset);
    const snapOffset = {
        x: nearestSnapsX[0]?.offset ?? 0,
        y: nearestSnapsY[0]?.offset ?? 0,
    };
    minOffset.x = 0;
    minOffset.y = 0;
    nearestSnapsX.length = 0;
    nearestSnapsY.length = 0;
    const corners = getElementsCorners([newElement], elementsMap, {
        boundingBoxCorners: true,
        omitCenter: true,
    });
    getPointSnaps([newElement], corners, app, event, nearestSnapsX, nearestSnapsY, minOffset);
    const pointSnapLines = createPointSnapLines(nearestSnapsX, nearestSnapsY);
    return {
        snapOffset,
        snapLines: pointSnapLines,
    };
};
export const getSnapLinesAtPointer = (elements, app, pointer, event, elementsMap) => {
    if (!isSnappingEnabled({ event, selectedElements: [], app })) {
        return {
            originOffset: { x: 0, y: 0 },
            snapLines: [],
        };
    }
    const referenceElements = getVisibleAndNonSelectedElements(elements, [], app.state, elementsMap);
    const snapDistance = getSnapDistance(app.state.zoom.value);
    const minOffset = {
        x: snapDistance,
        y: snapDistance,
    };
    const horizontalSnapLines = [];
    const verticalSnapLines = [];
    for (const referenceElement of referenceElements) {
        const corners = getElementsCorners([referenceElement], elementsMap);
        for (const corner of corners) {
            const offsetX = corner[0] - pointer.x;
            if (Math.abs(offsetX) <= Math.abs(minOffset.x)) {
                if (Math.abs(offsetX) < Math.abs(minOffset.x)) {
                    verticalSnapLines.length = 0;
                }
                verticalSnapLines.push({
                    type: "pointer",
                    points: [corner, pointFrom(corner[0], pointer.y)],
                    direction: "vertical",
                });
                minOffset.x = offsetX;
            }
            const offsetY = corner[1] - pointer.y;
            if (Math.abs(offsetY) <= Math.abs(minOffset.y)) {
                if (Math.abs(offsetY) < Math.abs(minOffset.y)) {
                    horizontalSnapLines.length = 0;
                }
                horizontalSnapLines.push({
                    type: "pointer",
                    points: [corner, pointFrom(pointer.x, corner[1])],
                    direction: "horizontal",
                });
                minOffset.y = offsetY;
            }
        }
    }
    return {
        originOffset: {
            x: verticalSnapLines.length > 0
                ? verticalSnapLines[0].points[0][0] - pointer.x
                : 0,
            y: horizontalSnapLines.length > 0
                ? horizontalSnapLines[0].points[0][1] - pointer.y
                : 0,
        },
        snapLines: [...verticalSnapLines, ...horizontalSnapLines],
    };
};
export const isActiveToolNonLinearSnappable = (activeToolType) => {
    return (activeToolType === TOOL_TYPE.rectangle ||
        activeToolType === TOOL_TYPE.ellipse ||
        activeToolType === TOOL_TYPE.diamond ||
        activeToolType === TOOL_TYPE.frame ||
        activeToolType === TOOL_TYPE.magicframe ||
        activeToolType === TOOL_TYPE.image ||
        activeToolType === TOOL_TYPE.text);
};
// TODO: Rounding this point causes some shake when free drawing
export const getGridPoint = (x, y, gridSize) => {
    if (gridSize) {
        return [
            Math.round(x / gridSize) * gridSize,
            Math.round(y / gridSize) * gridSize,
        ];
    }
    return [x, y];
};
