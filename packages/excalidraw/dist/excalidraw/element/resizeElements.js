import { MIN_FONT_SIZE, SHIFT_LOCKING_ANGLE } from "../constants";
import { rescalePoints } from "../points";
import { getElementAbsoluteCoords, getCommonBounds, getResizedElementAbsoluteCoords, getCommonBoundingBox, getElementBounds, } from "./bounds";
import { isArrowElement, isBoundToContainer, isElbowArrow, isFrameLikeElement, isFreeDrawElement, isImageElement, isLinearElement, isTextElement, } from "./typeChecks";
import { mutateElement } from "./mutateElement";
import { getFontString } from "../utils";
import { getArrowLocalFixedPoints, updateBoundElements } from "./binding";
import { getApproxMinLineWidth, getBoundTextElement, getBoundTextElementId, getContainerElement, handleBindTextResize, getBoundTextMaxWidth, getApproxMinLineHeight, measureText, getMinTextElementWidth, } from "./textElement";
import { wrapText } from "./textWrapping";
import { LinearElementEditor } from "./linearElementEditor";
import { isInGroup } from "../groups";
import { mutateElbowArrow } from "./routing";
import { pointCenter, normalizeRadians, pointFrom, pointFromPair, pointRotateRads, } from "../../math";
// Returns true when transform (resizing/rotation) happened
export const transformElements = (originalElements, transformHandleType, selectedElements, elementsMap, scene, shouldRotateWithDiscreteAngle, shouldResizeFromCenter, shouldMaintainAspectRatio, pointerX, pointerY, centerX, centerY) => {
    if (selectedElements.length === 1) {
        const [element] = selectedElements;
        if (transformHandleType === "rotation") {
            if (!isElbowArrow(element)) {
                rotateSingleElement(element, elementsMap, scene, pointerX, pointerY, shouldRotateWithDiscreteAngle);
                updateBoundElements(element, elementsMap);
            }
        }
        else if (isTextElement(element) && transformHandleType) {
            resizeSingleTextElement(originalElements, element, elementsMap, transformHandleType, shouldResizeFromCenter, pointerX, pointerY);
            updateBoundElements(element, elementsMap);
            return true;
        }
        else if (transformHandleType) {
            const elementId = selectedElements[0].id;
            const latestElement = elementsMap.get(elementId);
            const origElement = originalElements.get(elementId);
            if (latestElement && origElement) {
                const { nextWidth, nextHeight } = getNextSingleWidthAndHeightFromPointer(latestElement, origElement, elementsMap, originalElements, transformHandleType, pointerX, pointerY, {
                    shouldMaintainAspectRatio,
                    shouldResizeFromCenter,
                });
                resizeSingleElement(nextWidth, nextHeight, latestElement, origElement, elementsMap, originalElements, transformHandleType, {
                    shouldMaintainAspectRatio,
                    shouldResizeFromCenter,
                });
            }
        }
        return true;
    }
    else if (selectedElements.length > 1) {
        if (transformHandleType === "rotation") {
            rotateMultipleElements(originalElements, selectedElements, elementsMap, scene, pointerX, pointerY, shouldRotateWithDiscreteAngle, centerX, centerY);
            return true;
        }
        else if (transformHandleType) {
            const { nextWidth, nextHeight, flipByX, flipByY, originalBoundingBox } = getNextMultipleWidthAndHeightFromPointer(selectedElements, originalElements, elementsMap, transformHandleType, pointerX, pointerY, {
                shouldMaintainAspectRatio,
                shouldResizeFromCenter,
            });
            resizeMultipleElements(selectedElements, elementsMap, transformHandleType, scene, {
                shouldResizeFromCenter,
                shouldMaintainAspectRatio,
                originalElementsMap: originalElements,
                flipByX,
                flipByY,
                nextWidth,
                nextHeight,
                originalBoundingBox,
            });
            return true;
        }
    }
    return false;
};
const rotateSingleElement = (element, elementsMap, scene, pointerX, pointerY, shouldRotateWithDiscreteAngle) => {
    const [x1, y1, x2, y2] = getElementAbsoluteCoords(element, elementsMap);
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    let angle;
    if (isFrameLikeElement(element)) {
        angle = 0;
    }
    else {
        angle = ((5 * Math.PI) / 2 +
            Math.atan2(pointerY - cy, pointerX - cx));
        if (shouldRotateWithDiscreteAngle) {
            angle = (angle + SHIFT_LOCKING_ANGLE / 2);
            angle = (angle - (angle % SHIFT_LOCKING_ANGLE));
        }
        angle = normalizeRadians(angle);
    }
    const boundTextElementId = getBoundTextElementId(element);
    mutateElement(element, { angle });
    if (boundTextElementId) {
        const textElement = scene.getElement(boundTextElementId);
        if (textElement && !isArrowElement(element)) {
            mutateElement(textElement, { angle });
        }
    }
};
export const rescalePointsInElement = (element, width, height, normalizePoints) => isLinearElement(element) || isFreeDrawElement(element)
    ? {
        points: rescalePoints(0, width, rescalePoints(1, height, element.points, normalizePoints), normalizePoints),
    }
    : {};
export const measureFontSizeFromWidth = (element, elementsMap, nextWidth) => {
    // We only use width to scale font on resize
    let width = element.width;
    const hasContainer = isBoundToContainer(element);
    if (hasContainer) {
        const container = getContainerElement(element, elementsMap);
        if (container) {
            width = getBoundTextMaxWidth(container, element);
        }
    }
    const nextFontSize = element.fontSize * (nextWidth / width);
    if (nextFontSize < MIN_FONT_SIZE) {
        return null;
    }
    return {
        size: nextFontSize,
    };
};
const resizeSingleTextElement = (originalElements, element, elementsMap, transformHandleType, shouldResizeFromCenter, pointerX, pointerY) => {
    const [x1, y1, x2, y2, cx, cy] = getElementAbsoluteCoords(element, elementsMap);
    // rotation pointer with reverse angle
    const [rotatedX, rotatedY] = pointRotateRads(pointFrom(pointerX, pointerY), pointFrom(cx, cy), -element.angle);
    let scaleX = 0;
    let scaleY = 0;
    if (transformHandleType !== "e" && transformHandleType !== "w") {
        if (transformHandleType.includes("e")) {
            scaleX = (rotatedX - x1) / (x2 - x1);
        }
        if (transformHandleType.includes("w")) {
            scaleX = (x2 - rotatedX) / (x2 - x1);
        }
        if (transformHandleType.includes("n")) {
            scaleY = (y2 - rotatedY) / (y2 - y1);
        }
        if (transformHandleType.includes("s")) {
            scaleY = (rotatedY - y1) / (y2 - y1);
        }
    }
    const scale = Math.max(scaleX, scaleY);
    if (scale > 0) {
        const nextWidth = element.width * scale;
        const nextHeight = element.height * scale;
        const metrics = measureFontSizeFromWidth(element, elementsMap, nextWidth);
        if (metrics === null) {
            return;
        }
        const startTopLeft = [x1, y1];
        const startBottomRight = [x2, y2];
        const startCenter = [cx, cy];
        let newTopLeft = pointFrom(x1, y1);
        if (["n", "w", "nw"].includes(transformHandleType)) {
            newTopLeft = pointFrom(startBottomRight[0] - Math.abs(nextWidth), startBottomRight[1] - Math.abs(nextHeight));
        }
        if (transformHandleType === "ne") {
            const bottomLeft = [startTopLeft[0], startBottomRight[1]];
            newTopLeft = pointFrom(bottomLeft[0], bottomLeft[1] - Math.abs(nextHeight));
        }
        if (transformHandleType === "sw") {
            const topRight = [startBottomRight[0], startTopLeft[1]];
            newTopLeft = pointFrom(topRight[0] - Math.abs(nextWidth), topRight[1]);
        }
        if (["s", "n"].includes(transformHandleType)) {
            newTopLeft[0] = startCenter[0] - nextWidth / 2;
        }
        if (["e", "w"].includes(transformHandleType)) {
            newTopLeft[1] = startCenter[1] - nextHeight / 2;
        }
        if (shouldResizeFromCenter) {
            newTopLeft[0] = startCenter[0] - Math.abs(nextWidth) / 2;
            newTopLeft[1] = startCenter[1] - Math.abs(nextHeight) / 2;
        }
        const angle = element.angle;
        const rotatedTopLeft = pointRotateRads(newTopLeft, pointFrom(cx, cy), angle);
        const newCenter = pointFrom(newTopLeft[0] + Math.abs(nextWidth) / 2, newTopLeft[1] + Math.abs(nextHeight) / 2);
        const rotatedNewCenter = pointRotateRads(newCenter, pointFrom(cx, cy), angle);
        newTopLeft = pointRotateRads(rotatedTopLeft, rotatedNewCenter, -angle);
        const [nextX, nextY] = newTopLeft;
        mutateElement(element, {
            fontSize: metrics.size,
            width: nextWidth,
            height: nextHeight,
            x: nextX,
            y: nextY,
        });
    }
    if (transformHandleType === "e" || transformHandleType === "w") {
        const stateAtResizeStart = originalElements.get(element.id);
        const [x1, y1, x2, y2] = getResizedElementAbsoluteCoords(stateAtResizeStart, stateAtResizeStart.width, stateAtResizeStart.height, true);
        const startTopLeft = pointFrom(x1, y1);
        const startBottomRight = pointFrom(x2, y2);
        const startCenter = pointCenter(startTopLeft, startBottomRight);
        const rotatedPointer = pointRotateRads(pointFrom(pointerX, pointerY), startCenter, -stateAtResizeStart.angle);
        const [esx1, , esx2] = getResizedElementAbsoluteCoords(element, element.width, element.height, true);
        const boundsCurrentWidth = esx2 - esx1;
        const atStartBoundsWidth = startBottomRight[0] - startTopLeft[0];
        const minWidth = getMinTextElementWidth(getFontString({
            fontSize: element.fontSize,
            fontFamily: element.fontFamily,
        }), element.lineHeight);
        let scaleX = atStartBoundsWidth / boundsCurrentWidth;
        if (transformHandleType.includes("e")) {
            scaleX = (rotatedPointer[0] - startTopLeft[0]) / boundsCurrentWidth;
        }
        if (transformHandleType.includes("w")) {
            scaleX = (startBottomRight[0] - rotatedPointer[0]) / boundsCurrentWidth;
        }
        const newWidth = element.width * scaleX < minWidth ? minWidth : element.width * scaleX;
        const text = wrapText(element.originalText, getFontString(element), Math.abs(newWidth));
        const metrics = measureText(text, getFontString(element), element.lineHeight);
        const eleNewHeight = metrics.height;
        const [newBoundsX1, newBoundsY1, newBoundsX2, newBoundsY2] = getResizedElementAbsoluteCoords(stateAtResizeStart, newWidth, eleNewHeight, true);
        const newBoundsWidth = newBoundsX2 - newBoundsX1;
        const newBoundsHeight = newBoundsY2 - newBoundsY1;
        let newTopLeft = [...startTopLeft];
        if (["n", "w", "nw"].includes(transformHandleType)) {
            newTopLeft = [
                startBottomRight[0] - Math.abs(newBoundsWidth),
                startTopLeft[1],
            ];
        }
        // adjust topLeft to new rotation point
        const angle = stateAtResizeStart.angle;
        const rotatedTopLeft = pointRotateRads(pointFromPair(newTopLeft), startCenter, angle);
        const newCenter = pointFrom(newTopLeft[0] + Math.abs(newBoundsWidth) / 2, newTopLeft[1] + Math.abs(newBoundsHeight) / 2);
        const rotatedNewCenter = pointRotateRads(newCenter, startCenter, angle);
        newTopLeft = pointRotateRads(rotatedTopLeft, rotatedNewCenter, -angle);
        const resizedElement = {
            width: Math.abs(newWidth),
            height: Math.abs(metrics.height),
            x: newTopLeft[0],
            y: newTopLeft[1],
            text,
            autoResize: false,
        };
        mutateElement(element, resizedElement);
    }
};
const rotateMultipleElements = (originalElements, elements, elementsMap, scene, pointerX, pointerY, shouldRotateWithDiscreteAngle, centerX, centerY) => {
    let centerAngle = (5 * Math.PI) / 2 + Math.atan2(pointerY - centerY, pointerX - centerX);
    if (shouldRotateWithDiscreteAngle) {
        centerAngle += SHIFT_LOCKING_ANGLE / 2;
        centerAngle -= centerAngle % SHIFT_LOCKING_ANGLE;
    }
    for (const element of elements) {
        if (!isFrameLikeElement(element)) {
            const [x1, y1, x2, y2] = getElementAbsoluteCoords(element, elementsMap);
            const cx = (x1 + x2) / 2;
            const cy = (y1 + y2) / 2;
            const origAngle = originalElements.get(element.id)?.angle ?? element.angle;
            const [rotatedCX, rotatedCY] = pointRotateRads(pointFrom(cx, cy), pointFrom(centerX, centerY), (centerAngle + origAngle - element.angle));
            if (isElbowArrow(element)) {
                const points = getArrowLocalFixedPoints(element, elementsMap);
                mutateElbowArrow(element, elementsMap, points);
            }
            else {
                mutateElement(element, {
                    x: element.x + (rotatedCX - cx),
                    y: element.y + (rotatedCY - cy),
                    angle: normalizeRadians((centerAngle + origAngle)),
                }, false);
            }
            updateBoundElements(element, elementsMap, {
                simultaneouslyUpdated: elements,
            });
            const boundText = getBoundTextElement(element, elementsMap);
            if (boundText && !isArrowElement(element)) {
                mutateElement(boundText, {
                    x: boundText.x + (rotatedCX - cx),
                    y: boundText.y + (rotatedCY - cy),
                    angle: normalizeRadians((centerAngle + origAngle)),
                }, false);
            }
        }
    }
    scene.triggerUpdate();
};
export const getResizeOffsetXY = (transformHandleType, selectedElements, elementsMap, x, y) => {
    const [x1, y1, x2, y2] = selectedElements.length === 1
        ? getElementAbsoluteCoords(selectedElements[0], elementsMap)
        : getCommonBounds(selectedElements);
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    const angle = (selectedElements.length === 1 ? selectedElements[0].angle : 0);
    [x, y] = pointRotateRads(pointFrom(x, y), pointFrom(cx, cy), -angle);
    switch (transformHandleType) {
        case "n":
            return pointRotateRads(pointFrom(x - (x1 + x2) / 2, y - y1), pointFrom(0, 0), angle);
        case "s":
            return pointRotateRads(pointFrom(x - (x1 + x2) / 2, y - y2), pointFrom(0, 0), angle);
        case "w":
            return pointRotateRads(pointFrom(x - x1, y - (y1 + y2) / 2), pointFrom(0, 0), angle);
        case "e":
            return pointRotateRads(pointFrom(x - x2, y - (y1 + y2) / 2), pointFrom(0, 0), angle);
        case "nw":
            return pointRotateRads(pointFrom(x - x1, y - y1), pointFrom(0, 0), angle);
        case "ne":
            return pointRotateRads(pointFrom(x - x2, y - y1), pointFrom(0, 0), angle);
        case "sw":
            return pointRotateRads(pointFrom(x - x1, y - y2), pointFrom(0, 0), angle);
        case "se":
            return pointRotateRads(pointFrom(x - x2, y - y2), pointFrom(0, 0), angle);
        default:
            return [0, 0];
    }
};
export const getResizeArrowDirection = (transformHandleType, element) => {
    const [, [px, py]] = element.points;
    const isResizeEnd = (transformHandleType === "nw" && (px < 0 || py < 0)) ||
        (transformHandleType === "ne" && px >= 0) ||
        (transformHandleType === "sw" && px <= 0) ||
        (transformHandleType === "se" && (px > 0 || py > 0));
    return isResizeEnd ? "end" : "origin";
};
const getResizeAnchor = (handleDirection, shouldMaintainAspectRatio, shouldResizeFromCenter) => {
    if (shouldResizeFromCenter) {
        return "center";
    }
    if (shouldMaintainAspectRatio) {
        switch (handleDirection) {
            case "n":
                return "south-side";
            case "e": {
                return "west-side";
            }
            case "s":
                return "north-side";
            case "w":
                return "east-side";
            case "ne":
                return "bottom-left";
            case "nw":
                return "bottom-right";
            case "se":
                return "top-left";
            case "sw":
                return "top-right";
        }
    }
    if (["e", "se", "s"].includes(handleDirection)) {
        return "top-left";
    }
    else if (["n", "nw", "w"].includes(handleDirection)) {
        return "bottom-right";
    }
    else if (handleDirection === "ne") {
        return "bottom-left";
    }
    return "top-right";
};
const getResizedOrigin = (prevOrigin, prevWidth, prevHeight, newWidth, newHeight, angle, handleDirection, shouldMaintainAspectRatio, shouldResizeFromCenter) => {
    const anchor = getResizeAnchor(handleDirection, shouldMaintainAspectRatio, shouldResizeFromCenter);
    const [x, y] = prevOrigin;
    switch (anchor) {
        case "top-left":
            return {
                x: x +
                    (prevWidth - newWidth) / 2 +
                    ((newWidth - prevWidth) / 2) * Math.cos(angle) +
                    ((prevHeight - newHeight) / 2) * Math.sin(angle),
                y: y +
                    (prevHeight - newHeight) / 2 +
                    ((newWidth - prevWidth) / 2) * Math.sin(angle) +
                    ((newHeight - prevHeight) / 2) * Math.cos(angle),
            };
        case "top-right":
            return {
                x: x +
                    ((prevWidth - newWidth) / 2) * (Math.cos(angle) + 1) +
                    ((prevHeight - newHeight) / 2) * Math.sin(angle),
                y: y +
                    (prevHeight - newHeight) / 2 +
                    ((prevWidth - newWidth) / 2) * Math.sin(angle) +
                    ((newHeight - prevHeight) / 2) * Math.cos(angle),
            };
        case "bottom-left":
            return {
                x: x +
                    ((prevWidth - newWidth) / 2) * (1 - Math.cos(angle)) +
                    ((newHeight - prevHeight) / 2) * Math.sin(angle),
                y: y +
                    ((prevHeight - newHeight) / 2) * (Math.cos(angle) + 1) +
                    ((newWidth - prevWidth) / 2) * Math.sin(angle),
            };
        case "bottom-right":
            return {
                x: x +
                    ((prevWidth - newWidth) / 2) * (Math.cos(angle) + 1) +
                    ((newHeight - prevHeight) / 2) * Math.sin(angle),
                y: y +
                    ((prevHeight - newHeight) / 2) * (Math.cos(angle) + 1) +
                    ((prevWidth - newWidth) / 2) * Math.sin(angle),
            };
        case "center":
            return {
                x: x - (newWidth - prevWidth) / 2,
                y: y - (newHeight - prevHeight) / 2,
            };
        case "east-side":
            return {
                x: x + ((prevWidth - newWidth) / 2) * (Math.cos(angle) + 1),
                y: y +
                    (newHeight - prevHeight) / 2 +
                    ((prevWidth - newWidth) / 2) * Math.sin(angle),
            };
        case "west-side":
            return {
                x: x + ((prevWidth - newWidth) / 2) * (1 - Math.cos(angle)),
                y: y +
                    ((newWidth - prevWidth) / 2) * Math.sin(angle) +
                    (prevHeight - newHeight) / 2,
            };
        case "north-side":
            return {
                x: x +
                    (prevWidth - newWidth) / 2 +
                    ((prevHeight - newHeight) / 2) * Math.sin(angle),
                y: y + ((newHeight - prevHeight) / 2) * (Math.cos(angle) - 1),
            };
        case "south-side":
            return {
                x: x +
                    (prevWidth - newWidth) / 2 +
                    ((newHeight - prevHeight) / 2) * Math.sin(angle),
                y: y + ((prevHeight - newHeight) / 2) * (Math.cos(angle) + 1),
            };
    }
};
export const resizeSingleElement = (nextWidth, nextHeight, latestElement, origElement, elementsMap, originalElementsMap, handleDirection, { shouldInformMutation = true, shouldMaintainAspectRatio = false, shouldResizeFromCenter = false, } = {}) => {
    let boundTextFont = {};
    const boundTextElement = getBoundTextElement(latestElement, elementsMap);
    if (boundTextElement) {
        const stateOfBoundTextElementAtResize = originalElementsMap.get(boundTextElement.id);
        if (stateOfBoundTextElementAtResize) {
            boundTextFont = {
                fontSize: stateOfBoundTextElementAtResize.fontSize,
            };
        }
        if (shouldMaintainAspectRatio) {
            const updatedElement = {
                ...latestElement,
                width: nextWidth,
                height: nextHeight,
            };
            const nextFont = measureFontSizeFromWidth(boundTextElement, elementsMap, getBoundTextMaxWidth(updatedElement, boundTextElement));
            if (nextFont === null) {
                return;
            }
            boundTextFont = {
                fontSize: nextFont.size,
            };
        }
        else {
            const minWidth = getApproxMinLineWidth(getFontString(boundTextElement), boundTextElement.lineHeight);
            const minHeight = getApproxMinLineHeight(boundTextElement.fontSize, boundTextElement.lineHeight);
            nextWidth = Math.max(nextWidth, minWidth);
            nextHeight = Math.max(nextHeight, minHeight);
        }
    }
    const rescaledPoints = rescalePointsInElement(origElement, nextWidth, nextHeight, true);
    let previousOrigin = pointFrom(origElement.x, origElement.y);
    if (isLinearElement(origElement)) {
        const [x1, y1] = getElementBounds(origElement, originalElementsMap);
        previousOrigin = pointFrom(x1, y1);
    }
    const newOrigin = getResizedOrigin(previousOrigin, origElement.width, origElement.height, nextWidth, nextHeight, origElement.angle, handleDirection, shouldMaintainAspectRatio, shouldResizeFromCenter);
    if (isLinearElement(origElement) && rescaledPoints.points) {
        const offsetX = origElement.x - previousOrigin[0];
        const offsetY = origElement.y - previousOrigin[1];
        newOrigin.x += offsetX;
        newOrigin.y += offsetY;
        const scaledX = rescaledPoints.points[0][0];
        const scaledY = rescaledPoints.points[0][1];
        newOrigin.x += scaledX;
        newOrigin.y += scaledY;
        rescaledPoints.points = rescaledPoints.points.map((p) => pointFrom(p[0] - scaledX, p[1] - scaledY));
    }
    // flipping
    if (nextWidth < 0) {
        newOrigin.x = newOrigin.x + nextWidth;
    }
    if (nextHeight < 0) {
        newOrigin.y = newOrigin.y + nextHeight;
    }
    if ("scale" in latestElement && "scale" in origElement) {
        mutateElement(latestElement, {
            scale: [
                // defaulting because scaleX/Y can be 0/-0
                (Math.sign(nextWidth) || origElement.scale[0]) * origElement.scale[0],
                (Math.sign(nextHeight) || origElement.scale[1]) * origElement.scale[1],
            ],
        });
    }
    if (isArrowElement(latestElement) &&
        boundTextElement &&
        shouldMaintainAspectRatio) {
        const fontSize = (nextWidth / latestElement.width) * boundTextElement.fontSize;
        if (fontSize < MIN_FONT_SIZE) {
            return;
        }
        boundTextFont.fontSize = fontSize;
    }
    if (nextWidth !== 0 &&
        nextHeight !== 0 &&
        Number.isFinite(newOrigin.x) &&
        Number.isFinite(newOrigin.y)) {
        const updates = {
            ...newOrigin,
            width: Math.abs(nextWidth),
            height: Math.abs(nextHeight),
            ...rescaledPoints,
        };
        mutateElement(latestElement, updates, shouldInformMutation);
        updateBoundElements(latestElement, elementsMap, {
            // TODO: confirm with MARK if this actually makes sense
            newSize: { width: nextWidth, height: nextHeight },
        });
        if (boundTextElement && boundTextFont != null) {
            mutateElement(boundTextElement, {
                fontSize: boundTextFont.fontSize,
            });
        }
        handleBindTextResize(latestElement, elementsMap, handleDirection, shouldMaintainAspectRatio);
    }
};
const getNextSingleWidthAndHeightFromPointer = (latestElement, origElement, elementsMap, originalElementsMap, handleDirection, pointerX, pointerY, { shouldMaintainAspectRatio = false, shouldResizeFromCenter = false, } = {}) => {
    // Gets bounds corners
    const [x1, y1, x2, y2] = getResizedElementAbsoluteCoords(origElement, origElement.width, origElement.height, true);
    const startTopLeft = pointFrom(x1, y1);
    const startBottomRight = pointFrom(x2, y2);
    const startCenter = pointCenter(startTopLeft, startBottomRight);
    // Calculate new dimensions based on cursor position
    const rotatedPointer = pointRotateRads(pointFrom(pointerX, pointerY), startCenter, -origElement.angle);
    // Get bounds corners rendered on screen
    const [esx1, esy1, esx2, esy2] = getResizedElementAbsoluteCoords(latestElement, latestElement.width, latestElement.height, true);
    const boundsCurrentWidth = esx2 - esx1;
    const boundsCurrentHeight = esy2 - esy1;
    // It's important we set the initial scale value based on the width and height at resize start,
    // otherwise previous dimensions affected by modifiers will be taken into account.
    const atStartBoundsWidth = startBottomRight[0] - startTopLeft[0];
    const atStartBoundsHeight = startBottomRight[1] - startTopLeft[1];
    let scaleX = atStartBoundsWidth / boundsCurrentWidth;
    let scaleY = atStartBoundsHeight / boundsCurrentHeight;
    if (handleDirection.includes("e")) {
        scaleX = (rotatedPointer[0] - startTopLeft[0]) / boundsCurrentWidth;
    }
    if (handleDirection.includes("s")) {
        scaleY = (rotatedPointer[1] - startTopLeft[1]) / boundsCurrentHeight;
    }
    if (handleDirection.includes("w")) {
        scaleX = (startBottomRight[0] - rotatedPointer[0]) / boundsCurrentWidth;
    }
    if (handleDirection.includes("n")) {
        scaleY = (startBottomRight[1] - rotatedPointer[1]) / boundsCurrentHeight;
    }
    // We have to use dimensions of element on screen, otherwise the scaling of the
    // dimensions won't match the cursor for linear elements.
    let nextWidth = latestElement.width * scaleX;
    let nextHeight = latestElement.height * scaleY;
    if (shouldResizeFromCenter) {
        nextWidth = 2 * nextWidth - origElement.width;
        nextHeight = 2 * nextHeight - origElement.height;
    }
    // adjust dimensions to keep sides ratio
    if (shouldMaintainAspectRatio) {
        const widthRatio = Math.abs(nextWidth) / origElement.width;
        const heightRatio = Math.abs(nextHeight) / origElement.height;
        if (handleDirection.length === 1) {
            nextHeight *= widthRatio;
            nextWidth *= heightRatio;
        }
        if (handleDirection.length === 2) {
            const ratio = Math.max(widthRatio, heightRatio);
            nextWidth = origElement.width * ratio * Math.sign(nextWidth);
            nextHeight = origElement.height * ratio * Math.sign(nextHeight);
        }
    }
    return {
        nextWidth,
        nextHeight,
    };
};
const getNextMultipleWidthAndHeightFromPointer = (selectedElements, originalElementsMap, elementsMap, handleDirection, pointerX, pointerY, { shouldMaintainAspectRatio = false, shouldResizeFromCenter = false, } = {}) => {
    const originalElementsArray = selectedElements.map((el) => originalElementsMap.get(el.id));
    // getCommonBoundingBox() uses getBoundTextElement() which returns null for
    // original elements from pointerDownState, so we have to find and add these
    // bound text elements manually. Additionally, the coordinates of bound text
    // elements aren't always up to date.
    const boundTextElements = originalElementsArray.reduce((acc, orig) => {
        if (!isLinearElement(orig)) {
            return acc;
        }
        const textId = getBoundTextElementId(orig);
        if (!textId) {
            return acc;
        }
        const text = originalElementsMap.get(textId) ?? null;
        if (!isBoundToContainer(text)) {
            return acc;
        }
        return [
            ...acc,
            {
                ...text,
                ...LinearElementEditor.getBoundTextElementPosition(orig, text, elementsMap),
            },
        ];
    }, []);
    const originalBoundingBox = getCommonBoundingBox(originalElementsArray.map((orig) => orig).concat(boundTextElements));
    const { minX, minY, maxX, maxY, midX, midY } = originalBoundingBox;
    const width = maxX - minX;
    const height = maxY - minY;
    const anchorsMap = {
        ne: [minX, maxY],
        se: [minX, minY],
        sw: [maxX, minY],
        nw: [maxX, maxY],
        e: [minX, minY + height / 2],
        w: [maxX, minY + height / 2],
        n: [minX + width / 2, maxY],
        s: [minX + width / 2, minY],
    };
    // anchor point must be on the opposite side of the dragged selection handle
    // or be the center of the selection if shouldResizeFromCenter
    const [anchorX, anchorY] = shouldResizeFromCenter
        ? [midX, midY]
        : anchorsMap[handleDirection];
    const resizeFromCenterScale = shouldResizeFromCenter ? 2 : 1;
    const scale = Math.max(Math.abs(pointerX - anchorX) / width || 0, Math.abs(pointerY - anchorY) / height || 0) * resizeFromCenterScale;
    let nextWidth = handleDirection.includes("e") || handleDirection.includes("w")
        ? Math.abs(pointerX - anchorX) * resizeFromCenterScale
        : width;
    let nextHeight = handleDirection.includes("n") || handleDirection.includes("s")
        ? Math.abs(pointerY - anchorY) * resizeFromCenterScale
        : height;
    if (shouldMaintainAspectRatio) {
        nextWidth = width * scale * Math.sign(pointerX - anchorX);
        nextHeight = height * scale * Math.sign(pointerY - anchorY);
    }
    const flipConditionsMap = {
        ne: [pointerX < anchorX, pointerY > anchorY],
        se: [pointerX < anchorX, pointerY < anchorY],
        sw: [pointerX > anchorX, pointerY < anchorY],
        nw: [pointerX > anchorX, pointerY > anchorY],
        // e.g. when resizing from the "e" side, we do not need to consider changes in the `y` direction
        //      and therefore, we do not need to flip in the `y` direction at all
        e: [pointerX < anchorX, false],
        w: [pointerX > anchorX, false],
        n: [false, pointerY > anchorY],
        s: [false, pointerY < anchorY],
    };
    const [flipByX, flipByY] = flipConditionsMap[handleDirection].map((condition) => condition);
    return {
        originalBoundingBox,
        nextWidth,
        nextHeight,
        flipByX,
        flipByY,
    };
};
export const resizeMultipleElements = (selectedElements, elementsMap, handleDirection, scene, { shouldMaintainAspectRatio = false, shouldResizeFromCenter = false, flipByX = false, flipByY = false, nextHeight, nextWidth, originalElementsMap, originalBoundingBox, } = {}) => {
    // in the case of just flipping, there is no need to specify the next width and height
    if (nextWidth === undefined &&
        nextHeight === undefined &&
        flipByX === undefined &&
        flipByY === undefined) {
        return;
    }
    // do not allow next width or height to be 0
    if (nextHeight === 0 || nextWidth === 0) {
        return;
    }
    if (!originalElementsMap) {
        originalElementsMap = elementsMap;
    }
    const targetElements = selectedElements.reduce((acc, element) => {
        const origElement = originalElementsMap.get(element.id);
        if (origElement) {
            acc.push({ orig: origElement, latest: element });
        }
        return acc;
    }, []);
    let boundingBox;
    if (originalBoundingBox) {
        boundingBox = originalBoundingBox;
    }
    else {
        const boundTextElements = targetElements.reduce((acc, { orig }) => {
            if (!isLinearElement(orig)) {
                return acc;
            }
            const textId = getBoundTextElementId(orig);
            if (!textId) {
                return acc;
            }
            const text = originalElementsMap.get(textId) ?? null;
            if (!isBoundToContainer(text)) {
                return acc;
            }
            return [
                ...acc,
                {
                    ...text,
                    ...LinearElementEditor.getBoundTextElementPosition(orig, text, elementsMap),
                },
            ];
        }, []);
        boundingBox = getCommonBoundingBox(targetElements.map(({ orig }) => orig).concat(boundTextElements));
    }
    const { minX, minY, maxX, maxY, midX, midY } = boundingBox;
    const width = maxX - minX;
    const height = maxY - minY;
    if (nextWidth === undefined && nextHeight === undefined) {
        nextWidth = width;
        nextHeight = height;
    }
    if (shouldMaintainAspectRatio) {
        if (nextWidth === undefined) {
            nextWidth = nextHeight * (width / height);
        }
        else if (nextHeight === undefined) {
            nextHeight = nextWidth * (height / width);
        }
        else if (Math.abs(nextWidth / nextHeight - width / height) > 0.001) {
            nextWidth = nextHeight * (width / height);
        }
    }
    if (nextWidth && nextHeight) {
        let scaleX = handleDirection.includes("e") || handleDirection.includes("w")
            ? Math.abs(nextWidth) / width
            : 1;
        let scaleY = handleDirection.includes("n") || handleDirection.includes("s")
            ? Math.abs(nextHeight) / height
            : 1;
        let scale;
        if (handleDirection.length === 1) {
            scale =
                handleDirection.includes("e") || handleDirection.includes("w")
                    ? scaleX
                    : scaleY;
        }
        else {
            scale = Math.max(Math.abs(nextWidth) / width || 0, Math.abs(nextHeight) / height || 0);
        }
        const anchorsMap = {
            ne: [minX, maxY],
            se: [minX, minY],
            sw: [maxX, minY],
            nw: [maxX, maxY],
            e: [minX, minY + height / 2],
            w: [maxX, minY + height / 2],
            n: [minX + width / 2, maxY],
            s: [minX + width / 2, minY],
        };
        // anchor point must be on the opposite side of the dragged selection handle
        // or be the center of the selection if shouldResizeFromCenter
        const [anchorX, anchorY] = shouldResizeFromCenter
            ? [midX, midY]
            : anchorsMap[handleDirection];
        const keepAspectRatio = shouldMaintainAspectRatio ||
            targetElements.some((item) => item.latest.angle !== 0 ||
                isTextElement(item.latest) ||
                isInGroup(item.latest));
        if (keepAspectRatio) {
            scaleX = scale;
            scaleY = scale;
        }
        /**
         * to flip an element:
         * 1. determine over which axis is the element being flipped
         *    (could be x, y, or both) indicated by `flipFactorX` & `flipFactorY`
         * 2. shift element's position by the amount of width or height (or both) or
         *    mirror points in the case of linear & freedraw elemenets
         * 3. adjust element angle
         */
        const [flipFactorX, flipFactorY] = [flipByX ? -1 : 1, flipByY ? -1 : 1];
        const elementsAndUpdates = [];
        for (const { orig, latest } of targetElements) {
            // bounded text elements are updated along with their container elements
            if (isTextElement(orig) && isBoundToContainer(orig)) {
                continue;
            }
            const width = orig.width * scaleX;
            const height = orig.height * scaleY;
            const angle = normalizeRadians((orig.angle * flipFactorX * flipFactorY));
            const isLinearOrFreeDraw = isLinearElement(orig) || isFreeDrawElement(orig);
            const offsetX = orig.x - anchorX;
            const offsetY = orig.y - anchorY;
            const shiftX = flipByX && !isLinearOrFreeDraw ? width : 0;
            const shiftY = flipByY && !isLinearOrFreeDraw ? height : 0;
            const x = anchorX + flipFactorX * (offsetX * scaleX + shiftX);
            const y = anchorY + flipFactorY * (offsetY * scaleY + shiftY);
            const rescaledPoints = rescalePointsInElement(orig, width * flipFactorX, height * flipFactorY, false);
            const update = {
                x,
                y,
                width,
                height,
                angle,
                ...rescaledPoints,
            };
            if (isImageElement(orig)) {
                update.scale = [
                    orig.scale[0] * flipFactorX,
                    orig.scale[1] * flipFactorY,
                ];
            }
            if (isTextElement(orig)) {
                const metrics = measureFontSizeFromWidth(orig, elementsMap, width);
                if (!metrics) {
                    return;
                }
                update.fontSize = metrics.size;
            }
            const boundTextElement = originalElementsMap.get(getBoundTextElementId(orig) ?? "");
            if (boundTextElement) {
                if (keepAspectRatio) {
                    const newFontSize = boundTextElement.fontSize * scale;
                    if (newFontSize < MIN_FONT_SIZE) {
                        return;
                    }
                    update.boundTextFontSize = newFontSize;
                }
                else {
                    update.boundTextFontSize = boundTextElement.fontSize;
                }
            }
            elementsAndUpdates.push({
                element: latest,
                update,
            });
        }
        const elementsToUpdate = elementsAndUpdates.map(({ element }) => element);
        for (const { element, update: { boundTextFontSize, ...update }, } of elementsAndUpdates) {
            const { width, height, angle } = update;
            mutateElement(element, update, false);
            updateBoundElements(element, elementsMap, {
                simultaneouslyUpdated: elementsToUpdate,
                newSize: { width, height },
            });
            const boundTextElement = getBoundTextElement(element, elementsMap);
            if (boundTextElement && boundTextFontSize) {
                mutateElement(boundTextElement, {
                    fontSize: boundTextFontSize,
                    angle: isLinearElement(element) ? undefined : angle,
                }, false);
                handleBindTextResize(element, elementsMap, handleDirection, true);
            }
        }
        scene.triggerUpdate();
    }
};
