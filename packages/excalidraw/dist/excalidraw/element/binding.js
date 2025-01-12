import * as GA from "../../math/ga/ga";
import * as GAPoint from "../../math/ga/gapoints";
import * as GADirection from "../../math/ga/gadirections";
import * as GALine from "../../math/ga/galines";
import * as GATransform from "../../math/ga/gatransforms";
import { getCenterForBounds, getElementAbsoluteCoords } from "./bounds";
import { isPointOnShape } from "../../utils/collision";
import { getElementAtPosition } from "../scene";
import { isArrowElement, isBindableElement, isBindingElement, isBoundToContainer, isElbowArrow, isFixedPointBinding, isFrameLikeElement, isLinearElement, isRectangularElement, isTextElement, } from "./typeChecks";
import { mutateElement } from "./mutateElement";
import { LinearElementEditor } from "./linearElementEditor";
import { arrayToMap, tupleToCoors } from "../utils";
import { KEYS } from "../keys";
import { getBoundTextElement, handleBindTextResize } from "./textElement";
import { aabbForElement, getElementShape, pointInsideBounds } from "../shapes";
import { compareHeading, HEADING_DOWN, HEADING_LEFT, HEADING_RIGHT, HEADING_UP, headingForPointFromElement, vectorToHeading, } from "./heading";
import { lineSegment, pointFrom, pointRotateRads, vectorFromPoint, pointFromPair, pointDistanceSq, clamp, } from "../../math";
import { segmentIntersectRectangleElement } from "../../utils/geometry/shape";
export const shouldEnableBindingForPointerEvent = (event) => {
    return !event[KEYS.CTRL_OR_CMD];
};
export const isBindingEnabled = (appState) => {
    return appState.isBindingEnabled;
};
export const FIXED_BINDING_DISTANCE = 5;
export const BINDING_HIGHLIGHT_THICKNESS = 10;
export const BINDING_HIGHLIGHT_OFFSET = 4;
const getNonDeletedElements = (scene, ids) => {
    const result = [];
    ids.forEach((id) => {
        const element = scene.getNonDeletedElement(id);
        if (element != null) {
            result.push(element);
        }
    });
    return result;
};
export const bindOrUnbindLinearElement = (linearElement, startBindingElement, endBindingElement, elementsMap, scene) => {
    const boundToElementIds = new Set();
    const unboundFromElementIds = new Set();
    bindOrUnbindLinearElementEdge(linearElement, startBindingElement, endBindingElement, "start", boundToElementIds, unboundFromElementIds, elementsMap);
    bindOrUnbindLinearElementEdge(linearElement, endBindingElement, startBindingElement, "end", boundToElementIds, unboundFromElementIds, elementsMap);
    const onlyUnbound = Array.from(unboundFromElementIds).filter((id) => !boundToElementIds.has(id));
    getNonDeletedElements(scene, onlyUnbound).forEach((element) => {
        mutateElement(element, {
            boundElements: element.boundElements?.filter((element) => element.type !== "arrow" || element.id !== linearElement.id),
        });
    });
};
const bindOrUnbindLinearElementEdge = (linearElement, bindableElement, otherEdgeBindableElement, startOrEnd, 
// Is mutated
boundToElementIds, 
// Is mutated
unboundFromElementIds, elementsMap) => {
    // "keep" is for method chaining convenience, a "no-op", so just bail out
    if (bindableElement === "keep") {
        return;
    }
    // null means break the bind, so nothing to consider here
    if (bindableElement === null) {
        const unbound = unbindLinearElement(linearElement, startOrEnd);
        if (unbound != null) {
            unboundFromElementIds.add(unbound);
        }
        return;
    }
    // While complext arrows can do anything, simple arrow with both ends trying
    // to bind to the same bindable should not be allowed, start binding takes
    // precedence
    if (isLinearElementSimple(linearElement)) {
        if (otherEdgeBindableElement == null ||
            (otherEdgeBindableElement === "keep"
                ? // TODO: Refactor - Needlessly complex
                    !isLinearElementSimpleAndAlreadyBoundOnOppositeEdge(linearElement, bindableElement, startOrEnd)
                : startOrEnd === "start" ||
                    otherEdgeBindableElement.id !== bindableElement.id)) {
            bindLinearElement(linearElement, bindableElement, startOrEnd, elementsMap);
            boundToElementIds.add(bindableElement.id);
        }
    }
    else {
        bindLinearElement(linearElement, bindableElement, startOrEnd, elementsMap);
        boundToElementIds.add(bindableElement.id);
    }
};
const getOriginalBindingIfStillCloseOfLinearElementEdge = (linearElement, edge, elementsMap, zoom) => {
    const coors = getLinearElementEdgeCoors(linearElement, edge, elementsMap);
    const elementId = edge === "start"
        ? linearElement.startBinding?.elementId
        : linearElement.endBinding?.elementId;
    if (elementId) {
        const element = elementsMap.get(elementId);
        if (isBindableElement(element) &&
            bindingBorderTest(element, coors, elementsMap, zoom)) {
            return element;
        }
    }
    return null;
};
const getOriginalBindingsIfStillCloseToArrowEnds = (linearElement, elementsMap, zoom) => ["start", "end"].map((edge) => getOriginalBindingIfStillCloseOfLinearElementEdge(linearElement, edge, elementsMap, zoom));
const getBindingStrategyForDraggingArrowEndpoints = (selectedElement, isBindingEnabled, draggingPoints, elementsMap, elements, zoom) => {
    const startIdx = 0;
    const endIdx = selectedElement.points.length - 1;
    const startDragged = draggingPoints.findIndex((i) => i === startIdx) > -1;
    const endDragged = draggingPoints.findIndex((i) => i === endIdx) > -1;
    const start = startDragged
        ? isBindingEnabled
            ? getElligibleElementForBindingElement(selectedElement, "start", elementsMap, elements, zoom)
            : null // If binding is disabled and start is dragged, break all binds
        : // We have to update the focus and gap of the binding, so let's rebind
            getElligibleElementForBindingElement(selectedElement, "start", elementsMap, elements, zoom);
    const end = endDragged
        ? isBindingEnabled
            ? getElligibleElementForBindingElement(selectedElement, "end", elementsMap, elements, zoom)
            : null // If binding is disabled and end is dragged, break all binds
        : // We have to update the focus and gap of the binding, so let's rebind
            getElligibleElementForBindingElement(selectedElement, "end", elementsMap, elements, zoom);
    return [start, end];
};
const getBindingStrategyForDraggingArrowOrJoints = (selectedElement, elementsMap, elements, isBindingEnabled, zoom) => {
    const [startIsClose, endIsClose] = getOriginalBindingsIfStillCloseToArrowEnds(selectedElement, elementsMap, zoom);
    const start = startIsClose
        ? isBindingEnabled
            ? getElligibleElementForBindingElement(selectedElement, "start", elementsMap, elements, zoom)
            : null
        : null;
    const end = endIsClose
        ? isBindingEnabled
            ? getElligibleElementForBindingElement(selectedElement, "end", elementsMap, elements, zoom)
            : null
        : null;
    return [start, end];
};
export const bindOrUnbindLinearElements = (selectedElements, elementsMap, elements, scene, isBindingEnabled, draggingPoints, zoom) => {
    selectedElements.forEach((selectedElement) => {
        const [start, end] = draggingPoints?.length
            ? // The arrow edge points are dragged (i.e. start, end)
                getBindingStrategyForDraggingArrowEndpoints(selectedElement, isBindingEnabled, draggingPoints ?? [], elementsMap, elements, zoom)
            : // The arrow itself (the shaft) or the inner joins are dragged
                getBindingStrategyForDraggingArrowOrJoints(selectedElement, elementsMap, elements, isBindingEnabled, zoom);
        bindOrUnbindLinearElement(selectedElement, start, end, elementsMap, scene);
    });
};
export const getSuggestedBindingsForArrows = (selectedElements, elementsMap, zoom) => {
    // HOT PATH: Bail out if selected elements list is too large
    if (selectedElements.length > 50) {
        return [];
    }
    return (selectedElements
        .filter(isLinearElement)
        .flatMap((element) => getOriginalBindingsIfStillCloseToArrowEnds(element, elementsMap, zoom))
        .filter((element) => element !== null)
        // Filter out bind candidates which are in the
        // same selection / group with the arrow
        //
        // TODO: Is it worth turning the list into a set to avoid dupes?
        .filter((element) => selectedElements.filter((selected) => selected.id === element?.id)
        .length === 0));
};
export const maybeBindLinearElement = (linearElement, appState, pointerCoords, elementsMap, elements) => {
    if (appState.startBoundElement != null) {
        bindLinearElement(linearElement, appState.startBoundElement, "start", elementsMap);
    }
    const hoveredElement = getHoveredElementForBinding(pointerCoords, elements, elementsMap, appState.zoom, isElbowArrow(linearElement) && isElbowArrow(linearElement));
    if (hoveredElement !== null) {
        if (!isLinearElementSimpleAndAlreadyBoundOnOppositeEdge(linearElement, hoveredElement, "end")) {
            bindLinearElement(linearElement, hoveredElement, "end", elementsMap);
        }
    }
};
const normalizePointBinding = (binding, hoveredElement) => {
    let gap = binding.gap;
    const maxGap = maxBindingGap(hoveredElement, hoveredElement.width, hoveredElement.height);
    if (gap > maxGap) {
        gap = BINDING_HIGHLIGHT_THICKNESS + BINDING_HIGHLIGHT_OFFSET;
    }
    return {
        ...binding,
        gap,
    };
};
export const bindLinearElement = (linearElement, hoveredElement, startOrEnd, elementsMap) => {
    if (!isArrowElement(linearElement)) {
        return;
    }
    const binding = {
        elementId: hoveredElement.id,
        ...normalizePointBinding(calculateFocusAndGap(linearElement, hoveredElement, startOrEnd, elementsMap), hoveredElement),
        ...(isElbowArrow(linearElement)
            ? calculateFixedPointForElbowArrowBinding(linearElement, hoveredElement, startOrEnd, elementsMap)
            : { fixedPoint: null }),
    };
    mutateElement(linearElement, {
        [startOrEnd === "start" ? "startBinding" : "endBinding"]: binding,
    });
    const boundElementsMap = arrayToMap(hoveredElement.boundElements || []);
    if (!boundElementsMap.has(linearElement.id)) {
        mutateElement(hoveredElement, {
            boundElements: (hoveredElement.boundElements || []).concat({
                id: linearElement.id,
                type: "arrow",
            }),
        });
    }
    // update bound elements to make sure the binding tips are in sync with
    // the normalized gap from above
    if (!isElbowArrow(linearElement)) {
        updateBoundElements(hoveredElement, elementsMap);
    }
};
// Don't bind both ends of a simple segment
const isLinearElementSimpleAndAlreadyBoundOnOppositeEdge = (linearElement, bindableElement, startOrEnd) => {
    const otherBinding = linearElement[startOrEnd === "start" ? "endBinding" : "startBinding"];
    return isLinearElementSimpleAndAlreadyBound(linearElement, otherBinding?.elementId, bindableElement);
};
export const isLinearElementSimpleAndAlreadyBound = (linearElement, alreadyBoundToId, bindableElement) => {
    return (alreadyBoundToId === bindableElement.id &&
        isLinearElementSimple(linearElement));
};
const isLinearElementSimple = (linearElement) => linearElement.points.length < 3;
const unbindLinearElement = (linearElement, startOrEnd) => {
    const field = startOrEnd === "start" ? "startBinding" : "endBinding";
    const binding = linearElement[field];
    if (binding == null) {
        return null;
    }
    mutateElement(linearElement, { [field]: null });
    return binding.elementId;
};
export const getHoveredElementForBinding = (pointerCoords, elements, elementsMap, zoom, fullShape) => {
    const hoveredElement = getElementAtPosition(elements, (element) => isBindableElement(element, false) &&
        bindingBorderTest(element, pointerCoords, elementsMap, zoom, 
        // disable fullshape snapping for frame elements so we
        // can bind to frame children
        fullShape && !isFrameLikeElement(element)));
    return hoveredElement;
};
const calculateFocusAndGap = (linearElement, hoveredElement, startOrEnd, elementsMap) => {
    const direction = startOrEnd === "start" ? -1 : 1;
    const edgePointIndex = direction === -1 ? 0 : linearElement.points.length - 1;
    const adjacentPointIndex = edgePointIndex - direction;
    const edgePoint = LinearElementEditor.getPointAtIndexGlobalCoordinates(linearElement, edgePointIndex, elementsMap);
    const adjacentPoint = LinearElementEditor.getPointAtIndexGlobalCoordinates(linearElement, adjacentPointIndex, elementsMap);
    return {
        focus: determineFocusDistance(hoveredElement, adjacentPoint, edgePoint, elementsMap),
        gap: Math.max(1, distanceToBindableElement(hoveredElement, edgePoint, elementsMap)),
    };
};
// Supports translating, rotating and scaling `changedElement` with bound
// linear elements.
// Because scaling involves moving the focus points as well, it is
// done before the `changedElement` is updated, and the `newSize` is passed
// in explicitly.
export const updateBoundElements = (changedElement, elementsMap, options) => {
    const { newSize, simultaneouslyUpdated, changedElements, zoom } = options ?? {};
    const simultaneouslyUpdatedElementIds = getSimultaneouslyUpdatedElementIds(simultaneouslyUpdated);
    if (!isBindableElement(changedElement)) {
        return;
    }
    boundElementsVisitor(elementsMap, changedElement, (element) => {
        if (!isLinearElement(element) || element.isDeleted) {
            return;
        }
        // In case the boundElements are stale
        if (!doesNeedUpdate(element, changedElement)) {
            return;
        }
        const bindings = {
            startBinding: maybeCalculateNewGapWhenScaling(changedElement, element.startBinding, newSize),
            endBinding: maybeCalculateNewGapWhenScaling(changedElement, element.endBinding, newSize),
        };
        // `linearElement` is being moved/scaled already, just update the binding
        if (simultaneouslyUpdatedElementIds.has(element.id)) {
            mutateElement(element, bindings);
            return;
        }
        const updates = bindableElementsVisitor(elementsMap, element, (bindableElement, bindingProp) => {
            if (bindableElement &&
                isBindableElement(bindableElement) &&
                (bindingProp === "startBinding" || bindingProp === "endBinding") &&
                changedElement.id === element[bindingProp]?.elementId) {
                const point = updateBoundPoint(element, bindingProp, bindings[bindingProp], bindableElement, elementsMap);
                if (point) {
                    return {
                        index: bindingProp === "startBinding" ? 0 : element.points.length - 1,
                        point,
                    };
                }
            }
            return null;
        }).filter((update) => update !== null);
        LinearElementEditor.movePoints(element, updates, elementsMap, {
            ...(changedElement.id === element.startBinding?.elementId
                ? { startBinding: bindings.startBinding }
                : {}),
            ...(changedElement.id === element.endBinding?.elementId
                ? { endBinding: bindings.endBinding }
                : {}),
        }, {
            changedElements,
            zoom,
        });
        const boundText = getBoundTextElement(element, elementsMap);
        if (boundText && !boundText.isDeleted) {
            handleBindTextResize(element, elementsMap, false);
        }
    });
};
const doesNeedUpdate = (boundElement, changedElement) => {
    return (boundElement.startBinding?.elementId === changedElement.id ||
        boundElement.endBinding?.elementId === changedElement.id);
};
const getSimultaneouslyUpdatedElementIds = (simultaneouslyUpdated) => {
    return new Set((simultaneouslyUpdated || []).map((element) => element.id));
};
export const getHeadingForElbowArrowSnap = (p, otherPoint, bindableElement, aabb, elementsMap, origPoint, zoom) => {
    const otherPointHeading = vectorToHeading(vectorFromPoint(otherPoint, p));
    if (!bindableElement || !aabb) {
        return otherPointHeading;
    }
    const distance = getDistanceForBinding(origPoint, bindableElement, elementsMap, zoom);
    if (!distance) {
        return vectorToHeading(vectorFromPoint(p, pointFrom(bindableElement.x + bindableElement.width / 2, bindableElement.y + bindableElement.height / 2)));
    }
    const pointHeading = headingForPointFromElement(bindableElement, aabb, p);
    return pointHeading;
};
const getDistanceForBinding = (point, bindableElement, elementsMap, zoom) => {
    const distance = distanceToBindableElement(bindableElement, point, elementsMap);
    const bindDistance = maxBindingGap(bindableElement, bindableElement.width, bindableElement.height, zoom);
    return distance > bindDistance ? null : distance;
};
export const bindPointToSnapToElementOutline = (p, otherPoint, bindableElement, elementsMap) => {
    const aabb = bindableElement && aabbForElement(bindableElement);
    if (bindableElement && aabb) {
        // TODO: Dirty hacks until tangents are properly calculated
        const heading = headingForPointFromElement(bindableElement, aabb, p);
        const intersections = [
            ...(intersectElementWithLine(bindableElement, pointFrom(p[0], p[1] - 2 * bindableElement.height), pointFrom(p[0], p[1] + 2 * bindableElement.height), FIXED_BINDING_DISTANCE, elementsMap) ?? []),
            ...(intersectElementWithLine(bindableElement, pointFrom(p[0] - 2 * bindableElement.width, p[1]), pointFrom(p[0] + 2 * bindableElement.width, p[1]), FIXED_BINDING_DISTANCE, elementsMap) ?? []),
        ];
        const isVertical = compareHeading(heading, HEADING_LEFT) ||
            compareHeading(heading, HEADING_RIGHT);
        const dist = Math.abs(distanceToBindableElement(bindableElement, p, elementsMap));
        const isInner = isVertical
            ? dist < bindableElement.width * -0.1
            : dist < bindableElement.height * -0.1;
        intersections.sort((a, b) => pointDistanceSq(a, p) - pointDistanceSq(b, p));
        return isInner
            ? headingToMidBindPoint(otherPoint, bindableElement, aabb)
            : intersections.filter((i) => isVertical
                ? Math.abs(p[1] - i[1]) < 0.1
                : Math.abs(p[0] - i[0]) < 0.1)[0] ?? p;
    }
    return p;
};
const headingToMidBindPoint = (p, bindableElement, aabb) => {
    const center = getCenterForBounds(aabb);
    const heading = vectorToHeading(vectorFromPoint(p, center));
    switch (true) {
        case compareHeading(heading, HEADING_UP):
            return pointRotateRads(pointFrom((aabb[0] + aabb[2]) / 2 + 0.1, aabb[1]), center, bindableElement.angle);
        case compareHeading(heading, HEADING_RIGHT):
            return pointRotateRads(pointFrom(aabb[2], (aabb[1] + aabb[3]) / 2 + 0.1), center, bindableElement.angle);
        case compareHeading(heading, HEADING_DOWN):
            return pointRotateRads(pointFrom((aabb[0] + aabb[2]) / 2 - 0.1, aabb[3]), center, bindableElement.angle);
        default:
            return pointRotateRads(pointFrom(aabb[0], (aabb[1] + aabb[3]) / 2 - 0.1), center, bindableElement.angle);
    }
};
export const avoidRectangularCorner = (element, p) => {
    const center = pointFrom(element.x + element.width / 2, element.y + element.height / 2);
    const nonRotatedPoint = pointRotateRads(p, center, -element.angle);
    if (nonRotatedPoint[0] < element.x && nonRotatedPoint[1] < element.y) {
        // Top left
        if (nonRotatedPoint[1] - element.y > -FIXED_BINDING_DISTANCE) {
            return pointRotateRads(pointFrom(element.x - FIXED_BINDING_DISTANCE, element.y), center, element.angle);
        }
        return pointRotateRads(pointFrom(element.x, element.y - FIXED_BINDING_DISTANCE), center, element.angle);
    }
    else if (nonRotatedPoint[0] < element.x &&
        nonRotatedPoint[1] > element.y + element.height) {
        // Bottom left
        if (nonRotatedPoint[0] - element.x > -FIXED_BINDING_DISTANCE) {
            return pointRotateRads(pointFrom(element.x, element.y + element.height + FIXED_BINDING_DISTANCE), center, element.angle);
        }
        return pointRotateRads(pointFrom(element.x - FIXED_BINDING_DISTANCE, element.y + element.height), center, element.angle);
    }
    else if (nonRotatedPoint[0] > element.x + element.width &&
        nonRotatedPoint[1] > element.y + element.height) {
        // Bottom right
        if (nonRotatedPoint[0] - element.x <
            element.width + FIXED_BINDING_DISTANCE) {
            return pointRotateRads(pointFrom(element.x + element.width, element.y + element.height + FIXED_BINDING_DISTANCE), center, element.angle);
        }
        return pointRotateRads(pointFrom(element.x + element.width + FIXED_BINDING_DISTANCE, element.y + element.height), center, element.angle);
    }
    else if (nonRotatedPoint[0] > element.x + element.width &&
        nonRotatedPoint[1] < element.y) {
        // Top right
        if (nonRotatedPoint[0] - element.x <
            element.width + FIXED_BINDING_DISTANCE) {
            return pointRotateRads(pointFrom(element.x + element.width, element.y - FIXED_BINDING_DISTANCE), center, element.angle);
        }
        return pointRotateRads(pointFrom(element.x + element.width + FIXED_BINDING_DISTANCE, element.y), center, element.angle);
    }
    return p;
};
export const snapToMid = (element, p, tolerance = 0.05) => {
    const { x, y, width, height, angle } = element;
    const center = pointFrom(x + width / 2 - 0.1, y + height / 2 - 0.1);
    const nonRotated = pointRotateRads(p, center, -angle);
    // snap-to-center point is adaptive to element size, but we don't want to go
    // above and below certain px distance
    const verticalThrehsold = clamp(tolerance * height, 5, 80);
    const horizontalThrehsold = clamp(tolerance * width, 5, 80);
    if (nonRotated[0] <= x + width / 2 &&
        nonRotated[1] > center[1] - verticalThrehsold &&
        nonRotated[1] < center[1] + verticalThrehsold) {
        // LEFT
        return pointRotateRads(pointFrom(x - FIXED_BINDING_DISTANCE, center[1]), center, angle);
    }
    else if (nonRotated[1] <= y + height / 2 &&
        nonRotated[0] > center[0] - horizontalThrehsold &&
        nonRotated[0] < center[0] + horizontalThrehsold) {
        // TOP
        return pointRotateRads(pointFrom(center[0], y - FIXED_BINDING_DISTANCE), center, angle);
    }
    else if (nonRotated[0] >= x + width / 2 &&
        nonRotated[1] > center[1] - verticalThrehsold &&
        nonRotated[1] < center[1] + verticalThrehsold) {
        // RIGHT
        return pointRotateRads(pointFrom(x + width + FIXED_BINDING_DISTANCE, center[1]), center, angle);
    }
    else if (nonRotated[1] >= y + height / 2 &&
        nonRotated[0] > center[0] - horizontalThrehsold &&
        nonRotated[0] < center[0] + horizontalThrehsold) {
        // DOWN
        return pointRotateRads(pointFrom(center[0], y + height + FIXED_BINDING_DISTANCE), center, angle);
    }
    return p;
};
const updateBoundPoint = (linearElement, startOrEnd, binding, bindableElement, elementsMap) => {
    if (binding == null ||
        // We only need to update the other end if this is a 2 point line element
        (binding.elementId !== bindableElement.id &&
            linearElement.points.length > 2)) {
        return null;
    }
    const direction = startOrEnd === "startBinding" ? -1 : 1;
    const edgePointIndex = direction === -1 ? 0 : linearElement.points.length - 1;
    if (isElbowArrow(linearElement) && isFixedPointBinding(binding)) {
        const fixedPoint = normalizeFixedPoint(binding.fixedPoint) ??
            calculateFixedPointForElbowArrowBinding(linearElement, bindableElement, startOrEnd === "startBinding" ? "start" : "end", elementsMap).fixedPoint;
        const globalMidPoint = pointFrom(bindableElement.x + bindableElement.width / 2, bindableElement.y + bindableElement.height / 2);
        const global = pointFrom(bindableElement.x + fixedPoint[0] * bindableElement.width, bindableElement.y + fixedPoint[1] * bindableElement.height);
        const rotatedGlobal = pointRotateRads(global, globalMidPoint, bindableElement.angle);
        return LinearElementEditor.pointFromAbsoluteCoords(linearElement, rotatedGlobal, elementsMap);
    }
    const adjacentPointIndex = edgePointIndex - direction;
    const adjacentPoint = LinearElementEditor.getPointAtIndexGlobalCoordinates(linearElement, adjacentPointIndex, elementsMap);
    const focusPointAbsolute = determineFocusPoint(bindableElement, binding.focus, adjacentPoint, elementsMap);
    let newEdgePoint;
    // The linear element was not originally pointing inside the bound shape,
    // we can point directly at the focus point
    if (binding.gap === 0) {
        newEdgePoint = focusPointAbsolute;
    }
    else {
        const intersections = intersectElementWithLine(bindableElement, adjacentPoint, focusPointAbsolute, binding.gap, elementsMap);
        if (!intersections || intersections.length === 0) {
            // This should never happen, since focusPoint should always be
            // inside the element, but just in case, bail out
            newEdgePoint = focusPointAbsolute;
        }
        else {
            // Guaranteed to intersect because focusPoint is always inside the shape
            newEdgePoint = intersections[0];
        }
    }
    return LinearElementEditor.pointFromAbsoluteCoords(linearElement, newEdgePoint, elementsMap);
};
export const calculateFixedPointForElbowArrowBinding = (linearElement, hoveredElement, startOrEnd, elementsMap) => {
    const bounds = [
        hoveredElement.x,
        hoveredElement.y,
        hoveredElement.x + hoveredElement.width,
        hoveredElement.y + hoveredElement.height,
    ];
    const edgePointIndex = startOrEnd === "start" ? 0 : linearElement.points.length - 1;
    const globalPoint = LinearElementEditor.getPointAtIndexGlobalCoordinates(linearElement, edgePointIndex, elementsMap);
    const otherGlobalPoint = LinearElementEditor.getPointAtIndexGlobalCoordinates(linearElement, edgePointIndex, elementsMap);
    const snappedPoint = bindPointToSnapToElementOutline(globalPoint, otherGlobalPoint, hoveredElement, elementsMap);
    const globalMidPoint = pointFrom(bounds[0] + (bounds[2] - bounds[0]) / 2, bounds[1] + (bounds[3] - bounds[1]) / 2);
    const nonRotatedSnappedGlobalPoint = pointRotateRads(snappedPoint, globalMidPoint, -hoveredElement.angle);
    return {
        fixedPoint: normalizeFixedPoint([
            (nonRotatedSnappedGlobalPoint[0] - hoveredElement.x) /
                hoveredElement.width,
            (nonRotatedSnappedGlobalPoint[1] - hoveredElement.y) /
                hoveredElement.height,
        ]),
    };
};
const maybeCalculateNewGapWhenScaling = (changedElement, currentBinding, newSize) => {
    if (currentBinding == null || newSize == null) {
        return currentBinding;
    }
    const { width: newWidth, height: newHeight } = newSize;
    const { width, height } = changedElement;
    const newGap = Math.max(1, Math.min(maxBindingGap(changedElement, newWidth, newHeight), currentBinding.gap *
        (newWidth < newHeight ? newWidth / width : newHeight / height)));
    return { ...currentBinding, gap: newGap };
};
const getElligibleElementForBindingElement = (linearElement, startOrEnd, elementsMap, elements, zoom) => {
    return getHoveredElementForBinding(getLinearElementEdgeCoors(linearElement, startOrEnd, elementsMap), elements, elementsMap, zoom);
};
const getLinearElementEdgeCoors = (linearElement, startOrEnd, elementsMap) => {
    const index = startOrEnd === "start" ? 0 : -1;
    return tupleToCoors(LinearElementEditor.getPointAtIndexGlobalCoordinates(linearElement, index, elementsMap));
};
// We need to:
// 1: Update elements not selected to point to duplicated elements
// 2: Update duplicated elements to point to other duplicated elements
export const fixBindingsAfterDuplication = (sceneElements, oldElements, oldIdToDuplicatedId, 
// There are three copying mechanisms: Copy-paste, duplication and alt-drag.
// Only when alt-dragging the new "duplicates" act as the "old", while
// the "old" elements act as the "new copy" - essentially working reverse
// to the other two.
duplicatesServeAsOld) => {
    // First collect all the binding/bindable elements, so we only update
    // each once, regardless of whether they were duplicated or not.
    const allBoundElementIds = new Set();
    const allBindableElementIds = new Set();
    const shouldReverseRoles = duplicatesServeAsOld === "duplicatesServeAsOld";
    const duplicateIdToOldId = new Map([...oldIdToDuplicatedId].map(([key, value]) => [value, key]));
    oldElements.forEach((oldElement) => {
        const { boundElements } = oldElement;
        if (boundElements != null && boundElements.length > 0) {
            boundElements.forEach((boundElement) => {
                if (shouldReverseRoles && !oldIdToDuplicatedId.has(boundElement.id)) {
                    allBoundElementIds.add(boundElement.id);
                }
            });
            allBindableElementIds.add(oldIdToDuplicatedId.get(oldElement.id));
        }
        if (isBindingElement(oldElement)) {
            if (oldElement.startBinding != null) {
                const { elementId } = oldElement.startBinding;
                if (shouldReverseRoles && !oldIdToDuplicatedId.has(elementId)) {
                    allBindableElementIds.add(elementId);
                }
            }
            if (oldElement.endBinding != null) {
                const { elementId } = oldElement.endBinding;
                if (shouldReverseRoles && !oldIdToDuplicatedId.has(elementId)) {
                    allBindableElementIds.add(elementId);
                }
            }
            if (oldElement.startBinding != null || oldElement.endBinding != null) {
                allBoundElementIds.add(oldIdToDuplicatedId.get(oldElement.id));
            }
        }
    });
    // Update the linear elements
    sceneElements.filter(({ id }) => allBoundElementIds.has(id)).forEach((element) => {
        const { startBinding, endBinding } = element;
        mutateElement(element, {
            startBinding: newBindingAfterDuplication(startBinding, oldIdToDuplicatedId),
            endBinding: newBindingAfterDuplication(endBinding, oldIdToDuplicatedId),
        });
    });
    // Update the bindable shapes
    sceneElements
        .filter(({ id }) => allBindableElementIds.has(id))
        .forEach((bindableElement) => {
        const oldElementId = duplicateIdToOldId.get(bindableElement.id);
        const boundElements = sceneElements.find(({ id }) => id === oldElementId)?.boundElements;
        if (boundElements && boundElements.length > 0) {
            mutateElement(bindableElement, {
                boundElements: boundElements.map((boundElement) => oldIdToDuplicatedId.has(boundElement.id)
                    ? {
                        id: oldIdToDuplicatedId.get(boundElement.id),
                        type: boundElement.type,
                    }
                    : boundElement),
            });
        }
    });
};
const newBindingAfterDuplication = (binding, oldIdToDuplicatedId) => {
    if (binding == null) {
        return null;
    }
    return {
        ...binding,
        elementId: oldIdToDuplicatedId.get(binding.elementId) ?? binding.elementId,
    };
};
export const fixBindingsAfterDeletion = (sceneElements, deletedElements) => {
    const elements = arrayToMap(sceneElements);
    for (const element of deletedElements) {
        BoundElement.unbindAffected(elements, element, mutateElement);
        BindableElement.unbindAffected(elements, element, mutateElement);
    }
};
const newBoundElements = (boundElements, idsToRemove, elementsToAdd = []) => {
    if (!boundElements) {
        return null;
    }
    const nextBoundElements = boundElements.filter((boundElement) => !idsToRemove.has(boundElement.id));
    nextBoundElements.push(...elementsToAdd.map((x) => ({ id: x.id, type: x.type })));
    return nextBoundElements;
};
export const bindingBorderTest = (element, { x, y }, elementsMap, zoom, fullShape) => {
    const threshold = maxBindingGap(element, element.width, element.height, zoom);
    const shape = getElementShape(element, elementsMap);
    return (isPointOnShape(pointFrom(x, y), shape, threshold) ||
        (fullShape === true &&
            pointInsideBounds(pointFrom(x, y), aabbForElement(element))));
};
export const maxBindingGap = (element, elementWidth, elementHeight, zoom) => {
    const zoomValue = zoom?.value && zoom.value < 1 ? zoom.value : 1;
    // Aligns diamonds with rectangles
    const shapeRatio = element.type === "diamond" ? 1 / Math.sqrt(2) : 1;
    const smallerDimension = shapeRatio * Math.min(elementWidth, elementHeight);
    return Math.max(16, 
    // bigger bindable boundary for bigger elements
    Math.min(0.25 * smallerDimension, 32), 
    // keep in sync with the zoomed highlight
    BINDING_HIGHLIGHT_THICKNESS / zoomValue + BINDING_HIGHLIGHT_OFFSET);
};
export const distanceToBindableElement = (element, point, elementsMap) => {
    switch (element.type) {
        case "rectangle":
        case "image":
        case "text":
        case "iframe":
        case "embeddable":
        case "frame":
        case "magicframe":
            return distanceToRectangle(element, point, elementsMap);
        case "diamond":
            return distanceToDiamond(element, point, elementsMap);
        case "ellipse":
            return distanceToEllipse(element, point, elementsMap);
    }
};
const distanceToRectangle = (element, p, elementsMap) => {
    const [, pointRel, hwidth, hheight] = pointRelativeToElement(element, p, elementsMap);
    return Math.max(GAPoint.distanceToLine(pointRel, GALine.equation(0, 1, -hheight)), GAPoint.distanceToLine(pointRel, GALine.equation(1, 0, -hwidth)));
};
const distanceToDiamond = (element, point, elementsMap) => {
    const [, pointRel, hwidth, hheight] = pointRelativeToElement(element, point, elementsMap);
    const side = GALine.equation(hheight, hwidth, -hheight * hwidth);
    return GAPoint.distanceToLine(pointRel, side);
};
const distanceToEllipse = (element, point, elementsMap) => {
    const [pointRel, tangent] = ellipseParamsForTest(element, point, elementsMap);
    return -GALine.sign(tangent) * GAPoint.distanceToLine(pointRel, tangent);
};
const ellipseParamsForTest = (element, point, elementsMap) => {
    const [, pointRel, hwidth, hheight] = pointRelativeToElement(element, point, elementsMap);
    const [px, py] = GAPoint.toTuple(pointRel);
    // We're working in positive quadrant, so start with `t = 45deg`, `tx=cos(t)`
    let tx = 0.707;
    let ty = 0.707;
    const a = hwidth;
    const b = hheight;
    // This is a numerical method to find the params tx, ty at which
    // the ellipse has the closest point to the given point
    [0, 1, 2, 3].forEach((_) => {
        const xx = a * tx;
        const yy = b * ty;
        const ex = ((a * a - b * b) * tx ** 3) / a;
        const ey = ((b * b - a * a) * ty ** 3) / b;
        const rx = xx - ex;
        const ry = yy - ey;
        const qx = px - ex;
        const qy = py - ey;
        const r = Math.hypot(ry, rx);
        const q = Math.hypot(qy, qx);
        tx = Math.min(1, Math.max(0, ((qx * r) / q + ex) / a));
        ty = Math.min(1, Math.max(0, ((qy * r) / q + ey) / b));
        const t = Math.hypot(ty, tx);
        tx /= t;
        ty /= t;
    });
    const closestPoint = GA.point(a * tx, b * ty);
    const tangent = GALine.orthogonalThrough(pointRel, closestPoint);
    return [pointRel, tangent];
};
// Returns:
//   1. the point relative to the elements (x, y) position
//   2. the point relative to the element's center with positive (x, y)
//   3. half element width
//   4. half element height
//
// Note that for linear elements the (x, y) position is not at the
// top right corner of their boundary.
//
// Rectangles, diamonds and ellipses are symmetrical over axes,
// and other elements have a rectangular boundary,
// so we only need to perform hit tests for the positive quadrant.
const pointRelativeToElement = (element, pointTuple, elementsMap) => {
    const point = GAPoint.from(pointTuple);
    const [x1, y1, x2, y2] = getElementAbsoluteCoords(element, elementsMap);
    const center = coordsCenter(x1, y1, x2, y2);
    // GA has angle orientation opposite to `rotate`
    const rotate = GATransform.rotation(center, element.angle);
    const pointRotated = GATransform.apply(rotate, point);
    const pointRelToCenter = GA.sub(pointRotated, GADirection.from(center));
    const pointRelToCenterAbs = GAPoint.abs(pointRelToCenter);
    const elementPos = GA.offset(element.x, element.y);
    const pointRelToPos = GA.sub(pointRotated, elementPos);
    const halfWidth = (x2 - x1) / 2;
    const halfHeight = (y2 - y1) / 2;
    return [pointRelToPos, pointRelToCenterAbs, halfWidth, halfHeight];
};
const relativizationToElementCenter = (element, elementsMap) => {
    const [x1, y1, x2, y2] = getElementAbsoluteCoords(element, elementsMap);
    const center = coordsCenter(x1, y1, x2, y2);
    // GA has angle orientation opposite to `rotate`
    const rotate = GATransform.rotation(center, element.angle);
    const translate = GA.reverse(GATransform.translation(GADirection.from(center)));
    return GATransform.compose(rotate, translate);
};
const coordsCenter = (x1, y1, x2, y2) => {
    return GA.point((x1 + x2) / 2, (y1 + y2) / 2);
};
// The focus distance is the oriented ratio between the size of
// the `element` and the "focus image" of the element on which
// all focus points lie, so it's a number between -1 and 1.
// The line going through `a` and `b` is a tangent to the "focus image"
// of the element.
const determineFocusDistance = (element, 
// Point on the line, in absolute coordinates
a, 
// Another point on the line, in absolute coordinates (closer to element)
b, elementsMap) => {
    const relateToCenter = relativizationToElementCenter(element, elementsMap);
    const aRel = GATransform.apply(relateToCenter, GAPoint.from(a));
    const bRel = GATransform.apply(relateToCenter, GAPoint.from(b));
    const line = GALine.through(aRel, bRel);
    const q = element.height / element.width;
    const hwidth = element.width / 2;
    const hheight = element.height / 2;
    const n = line[2];
    const m = line[3];
    const c = line[1];
    const mabs = Math.abs(m);
    const nabs = Math.abs(n);
    let ret;
    switch (element.type) {
        case "rectangle":
        case "image":
        case "text":
        case "iframe":
        case "embeddable":
        case "frame":
        case "magicframe":
            ret = c / (hwidth * (nabs + q * mabs));
            break;
        case "diamond":
            ret = mabs < nabs ? c / (nabs * hwidth) : c / (mabs * hheight);
            break;
        case "ellipse":
            ret = c / (hwidth * Math.sqrt(n ** 2 + q ** 2 * m ** 2));
            break;
    }
    return ret || 0;
};
const determineFocusPoint = (element, 
// The oriented, relative distance from the center of `element` of the
// returned focusPoint
focus, adjecentPoint, elementsMap) => {
    if (focus === 0) {
        const [x1, y1, x2, y2] = getElementAbsoluteCoords(element, elementsMap);
        const center = coordsCenter(x1, y1, x2, y2);
        return pointFromPair(GAPoint.toTuple(center));
    }
    const relateToCenter = relativizationToElementCenter(element, elementsMap);
    const adjecentPointRel = GATransform.apply(relateToCenter, GAPoint.from(adjecentPoint));
    const reverseRelateToCenter = GA.reverse(relateToCenter);
    let point;
    switch (element.type) {
        case "rectangle":
        case "image":
        case "text":
        case "diamond":
        case "iframe":
        case "embeddable":
        case "frame":
        case "magicframe":
            point = findFocusPointForRectangulars(element, focus, adjecentPointRel);
            break;
        case "ellipse":
            point = findFocusPointForEllipse(element, focus, adjecentPointRel);
            break;
    }
    return pointFromPair(GAPoint.toTuple(GATransform.apply(reverseRelateToCenter, point)));
};
// Returns 2 or 0 intersection points between line going through `a` and `b`
// and the `element`, in ascending order of distance from `a`.
const intersectElementWithLine = (element, 
// Point on the line, in absolute coordinates
a, 
// Another point on the line, in absolute coordinates
b, 
// If given, the element is inflated by this value
gap = 0, elementsMap) => {
    if (isRectangularElement(element)) {
        return segmentIntersectRectangleElement(element, lineSegment(a, b), gap);
    }
    const relateToCenter = relativizationToElementCenter(element, elementsMap);
    const aRel = GATransform.apply(relateToCenter, GAPoint.from(a));
    const bRel = GATransform.apply(relateToCenter, GAPoint.from(b));
    const line = GALine.through(aRel, bRel);
    const reverseRelateToCenter = GA.reverse(relateToCenter);
    const intersections = getSortedElementLineIntersections(element, line, aRel, gap);
    return intersections.map((point) => pointFromPair(GAPoint.toTuple(GATransform.apply(reverseRelateToCenter, point))));
};
const getSortedElementLineIntersections = (element, 
// Relative to element center
line, 
// Relative to element center
nearPoint, gap = 0) => {
    let intersections;
    switch (element.type) {
        case "rectangle":
        case "image":
        case "text":
        case "diamond":
        case "iframe":
        case "embeddable":
        case "frame":
        case "magicframe":
            const corners = getCorners(element);
            intersections = corners
                .flatMap((point, i) => {
                const edge = [point, corners[(i + 1) % 4]];
                return intersectSegment(line, offsetSegment(edge, gap));
            })
                .concat(corners.flatMap((point) => getCircleIntersections(point, gap, line)));
            break;
        case "ellipse":
            intersections = getEllipseIntersections(element, gap, line);
            break;
    }
    if (intersections.length < 2) {
        // Ignore the "edge" case of only intersecting with a single corner
        return [];
    }
    const sortedIntersections = intersections.sort((i1, i2) => GAPoint.distance(i1, nearPoint) - GAPoint.distance(i2, nearPoint));
    return [
        sortedIntersections[0],
        sortedIntersections[sortedIntersections.length - 1],
    ];
};
const getCorners = (element, scale = 1) => {
    const hx = (scale * element.width) / 2;
    const hy = (scale * element.height) / 2;
    switch (element.type) {
        case "rectangle":
        case "image":
        case "text":
        case "iframe":
        case "embeddable":
        case "frame":
        case "magicframe":
            return [
                GA.point(hx, hy),
                GA.point(hx, -hy),
                GA.point(-hx, -hy),
                GA.point(-hx, hy),
            ];
        case "diamond":
            return [
                GA.point(0, hy),
                GA.point(hx, 0),
                GA.point(0, -hy),
                GA.point(-hx, 0),
            ];
    }
};
// Returns intersection of `line` with `segment`, with `segment` moved by
// `gap` in its polar direction.
// If intersection coincides with second segment point returns empty array.
const intersectSegment = (line, segment) => {
    const [a, b] = segment;
    const aDist = GAPoint.distanceToLine(a, line);
    const bDist = GAPoint.distanceToLine(b, line);
    if (aDist * bDist >= 0) {
        // The intersection is outside segment `(a, b)`
        return [];
    }
    return [GAPoint.intersect(line, GALine.through(a, b))];
};
const offsetSegment = (segment, distance) => {
    const [a, b] = segment;
    const offset = GATransform.translationOrthogonal(GADirection.fromTo(a, b), distance);
    return [GATransform.apply(offset, a), GATransform.apply(offset, b)];
};
const getEllipseIntersections = (element, gap, line) => {
    const a = element.width / 2 + gap;
    const b = element.height / 2 + gap;
    const m = line[2];
    const n = line[3];
    const c = line[1];
    const squares = a * a * m * m + b * b * n * n;
    const discr = squares - c * c;
    if (squares === 0 || discr <= 0) {
        return [];
    }
    const discrRoot = Math.sqrt(discr);
    const xn = -a * a * m * c;
    const yn = -b * b * n * c;
    return [
        GA.point((xn + a * b * n * discrRoot) / squares, (yn - a * b * m * discrRoot) / squares),
        GA.point((xn - a * b * n * discrRoot) / squares, (yn + a * b * m * discrRoot) / squares),
    ];
};
const getCircleIntersections = (center, radius, line) => {
    if (radius === 0) {
        return GAPoint.distanceToLine(line, center) === 0 ? [center] : [];
    }
    const m = line[2];
    const n = line[3];
    const c = line[1];
    const [a, b] = GAPoint.toTuple(center);
    const r = radius;
    const squares = m * m + n * n;
    const discr = r * r * squares - (m * a + n * b + c) ** 2;
    if (squares === 0 || discr <= 0) {
        return [];
    }
    const discrRoot = Math.sqrt(discr);
    const xn = a * n * n - b * m * n - m * c;
    const yn = b * m * m - a * m * n - n * c;
    return [
        GA.point((xn + n * discrRoot) / squares, (yn - m * discrRoot) / squares),
        GA.point((xn - n * discrRoot) / squares, (yn + m * discrRoot) / squares),
    ];
};
// The focus point is the tangent point of the "focus image" of the
// `element`, where the tangent goes through `point`.
const findFocusPointForEllipse = (ellipse, 
// Between -1 and 1 (not 0) the relative size of the "focus image" of
// the element on which the focus point lies
relativeDistance, 
// The point for which we're trying to find the focus point, relative
// to the ellipse center.
point) => {
    const relativeDistanceAbs = Math.abs(relativeDistance);
    const a = (ellipse.width * relativeDistanceAbs) / 2;
    const b = (ellipse.height * relativeDistanceAbs) / 2;
    const orientation = Math.sign(relativeDistance);
    const [px, pyo] = GAPoint.toTuple(point);
    // The calculation below can't handle py = 0
    const py = pyo === 0 ? 0.0001 : pyo;
    const squares = px ** 2 * b ** 2 + py ** 2 * a ** 2;
    // Tangent mx + ny + 1 = 0
    const m = (-px * b ** 2 +
        orientation * py * Math.sqrt(Math.max(0, squares - a ** 2 * b ** 2))) /
        squares;
    let n = (-m * px - 1) / py;
    if (n === 0) {
        // if zero {-0, 0}, fall back to a same-sign value in the similar range
        n = (Object.is(n, -0) ? -1 : 1) * 0.01;
    }
    const x = -(a ** 2 * m) / (n ** 2 * b ** 2 + m ** 2 * a ** 2);
    return GA.point(x, (-m * x - 1) / n);
};
const findFocusPointForRectangulars = (element, 
// Between -1 and 1 for how far away should the focus point be relative
// to the size of the element. Sign determines orientation.
relativeDistance, 
// The point for which we're trying to find the focus point, relative
// to the element center.
point) => {
    const relativeDistanceAbs = Math.abs(relativeDistance);
    const orientation = Math.sign(relativeDistance);
    const corners = getCorners(element, relativeDistanceAbs);
    let maxDistance = 0;
    let tangentPoint = null;
    corners.forEach((corner) => {
        const distance = orientation * GALine.through(point, corner)[1];
        if (distance > maxDistance) {
            maxDistance = distance;
            tangentPoint = corner;
        }
    });
    return tangentPoint;
};
export const bindingProperties = new Set([
    "boundElements",
    "frameId",
    "containerId",
    "startBinding",
    "endBinding",
]);
/**
 * Tries to visit each bound element (does not have to be found).
 */
const boundElementsVisitor = (elements, element, visit) => {
    if (isBindableElement(element)) {
        // create new instance so that possible mutations won't play a role in visiting order
        const boundElements = element.boundElements?.slice() ?? [];
        // last added text should be the one we keep (~previous are duplicates)
        boundElements.forEach(({ id }) => {
            visit(elements.get(id), "boundElements", id);
        });
    }
};
/**
 * Tries to visit each bindable element (does not have to be found).
 */
const bindableElementsVisitor = (elements, element, visit) => {
    const result = [];
    if (element.frameId) {
        const id = element.frameId;
        result.push(visit(elements.get(id), "frameId", id));
    }
    if (isBoundToContainer(element)) {
        const id = element.containerId;
        result.push(visit(elements.get(id), "containerId", id));
    }
    if (isArrowElement(element)) {
        if (element.startBinding) {
            const id = element.startBinding.elementId;
            result.push(visit(elements.get(id), "startBinding", id));
        }
        if (element.endBinding) {
            const id = element.endBinding.elementId;
            result.push(visit(elements.get(id), "endBinding", id));
        }
    }
    return result;
};
/**
 * Bound element containing bindings to `frameId`, `containerId`, `startBinding` or `endBinding`.
 */
export class BoundElement {
    /**
     * Unbind the affected non deleted bindable elements (removing element from `boundElements`).
     * - iterates non deleted bindable elements (`containerId` | `startBinding.elementId` | `endBinding.elementId`) of the current element
     * - prepares updates to unbind each bindable element's `boundElements` from the current element
     */
    static unbindAffected(elements, boundElement, updateElementWith) {
        if (!boundElement) {
            return;
        }
        bindableElementsVisitor(elements, boundElement, (bindableElement) => {
            // bindable element is deleted, this is fine
            if (!bindableElement || bindableElement.isDeleted) {
                return;
            }
            boundElementsVisitor(elements, bindableElement, (_, __, boundElementId) => {
                if (boundElementId === boundElement.id) {
                    updateElementWith(bindableElement, {
                        boundElements: newBoundElements(bindableElement.boundElements, new Set([boundElementId])),
                    });
                }
            });
        });
    }
    /**
     * Rebind the next affected non deleted bindable elements (adding element to `boundElements`).
     * - iterates non deleted bindable elements (`containerId` | `startBinding.elementId` | `endBinding.elementId`) of the current element
     * - prepares updates to rebind each bindable element's `boundElements` to the current element
     *
     * NOTE: rebind expects that affected elements were previously unbound with `BoundElement.unbindAffected`
     */
    static rebindAffected = (elements, boundElement, updateElementWith) => {
        // don't try to rebind element that is deleted
        if (!boundElement || boundElement.isDeleted) {
            return;
        }
        bindableElementsVisitor(elements, boundElement, (bindableElement, bindingProp) => {
            // unbind from bindable elements, as bindings from non deleted elements into deleted elements are incorrect
            if (!bindableElement || bindableElement.isDeleted) {
                updateElementWith(boundElement, { [bindingProp]: null });
                return;
            }
            // frame bindings are unidirectional, there is nothing to rebind
            if (bindingProp === "frameId") {
                return;
            }
            if (bindableElement.boundElements?.find((x) => x.id === boundElement.id)) {
                return;
            }
            if (isArrowElement(boundElement)) {
                // rebind if not found!
                updateElementWith(bindableElement, {
                    boundElements: newBoundElements(bindableElement.boundElements, new Set(), new Array(boundElement)),
                });
            }
            if (isTextElement(boundElement)) {
                if (!bindableElement.boundElements?.find((x) => x.type === "text")) {
                    // rebind only if there is no other text bound already
                    updateElementWith(bindableElement, {
                        boundElements: newBoundElements(bindableElement.boundElements, new Set(), new Array(boundElement)),
                    });
                }
                else {
                    // unbind otherwise
                    updateElementWith(boundElement, { [bindingProp]: null });
                }
            }
        });
    };
}
/**
 * Bindable element containing bindings to `boundElements`.
 */
export class BindableElement {
    /**
     * Unbind the affected non deleted bound elements (resetting `containerId`, `startBinding`, `endBinding` to `null`).
     * - iterates through non deleted `boundElements` of the current element
     * - prepares updates to unbind each bound element from the current element
     */
    static unbindAffected(elements, bindableElement, updateElementWith) {
        if (!bindableElement) {
            return;
        }
        boundElementsVisitor(elements, bindableElement, (boundElement) => {
            // bound element is deleted, this is fine
            if (!boundElement || boundElement.isDeleted) {
                return;
            }
            bindableElementsVisitor(elements, boundElement, (_, bindingProp, bindableElementId) => {
                // making sure there is an element to be unbound
                if (bindableElementId === bindableElement.id) {
                    updateElementWith(boundElement, { [bindingProp]: null });
                }
            });
        });
    }
    /**
     * Rebind the affected non deleted bound elements (for now setting only `containerId`, as we cannot rebind arrows atm).
     * - iterates through non deleted `boundElements` of the current element
     * - prepares updates to rebind each bound element to the current element or unbind it from `boundElements` in case of conflicts
     *
     * NOTE: rebind expects that affected elements were previously unbound with `BindaleElement.unbindAffected`
     */
    static rebindAffected = (elements, bindableElement, updateElementWith) => {
        // don't try to rebind element that is deleted (i.e. updated as deleted)
        if (!bindableElement || bindableElement.isDeleted) {
            return;
        }
        boundElementsVisitor(elements, bindableElement, (boundElement, _, boundElementId) => {
            // unbind from bindable elements, as bindings from non deleted elements into deleted elements are incorrect
            if (!boundElement || boundElement.isDeleted) {
                updateElementWith(bindableElement, {
                    boundElements: newBoundElements(bindableElement.boundElements, new Set([boundElementId])),
                });
                return;
            }
            if (isTextElement(boundElement)) {
                const boundElements = bindableElement.boundElements?.slice() ?? [];
                // check if this is the last element in the array, if not, there is an previously bound text which should be unbound
                if (boundElements.reverse().find((x) => x.type === "text")?.id ===
                    boundElement.id) {
                    if (boundElement.containerId !== bindableElement.id) {
                        // rebind if not bound already!
                        updateElementWith(boundElement, {
                            containerId: bindableElement.id,
                        });
                    }
                }
                else {
                    if (boundElement.containerId !== null) {
                        // unbind if not unbound already
                        updateElementWith(boundElement, {
                            containerId: null,
                        });
                    }
                    // unbind from boundElements as the element got bound to some other element in the meantime
                    updateElementWith(bindableElement, {
                        boundElements: newBoundElements(bindableElement.boundElements, new Set([boundElement.id])),
                    });
                }
            }
        });
    };
}
export const getGlobalFixedPointForBindableElement = (fixedPointRatio, element) => {
    const [fixedX, fixedY] = normalizeFixedPoint(fixedPointRatio);
    return pointRotateRads(pointFrom(element.x + element.width * fixedX, element.y + element.height * fixedY), pointFrom(element.x + element.width / 2, element.y + element.height / 2), element.angle);
};
const getGlobalFixedPoints = (arrow, elementsMap) => {
    const startElement = arrow.startBinding &&
        elementsMap.get(arrow.startBinding.elementId);
    const endElement = arrow.endBinding &&
        elementsMap.get(arrow.endBinding.elementId);
    const startPoint = startElement && arrow.startBinding
        ? getGlobalFixedPointForBindableElement(arrow.startBinding.fixedPoint, startElement)
        : pointFrom(arrow.x + arrow.points[0][0], arrow.y + arrow.points[0][1]);
    const endPoint = endElement && arrow.endBinding
        ? getGlobalFixedPointForBindableElement(arrow.endBinding.fixedPoint, endElement)
        : pointFrom(arrow.x + arrow.points[arrow.points.length - 1][0], arrow.y + arrow.points[arrow.points.length - 1][1]);
    return [startPoint, endPoint];
};
export const getArrowLocalFixedPoints = (arrow, elementsMap) => {
    const [startPoint, endPoint] = getGlobalFixedPoints(arrow, elementsMap);
    return [
        LinearElementEditor.pointFromAbsoluteCoords(arrow, startPoint, elementsMap),
        LinearElementEditor.pointFromAbsoluteCoords(arrow, endPoint, elementsMap),
    ];
};
export const normalizeFixedPoint = (fixedPoint) => {
    // Do not allow a precise 0.5 for fixed point ratio
    // to avoid jumping arrow heading due to floating point imprecision
    if (fixedPoint && (fixedPoint[0] === 0.5 || fixedPoint[1] === 0.5)) {
        return fixedPoint.map((ratio) => ratio === 0.5 ? 0.5001 : ratio);
    }
    return fixedPoint;
};
