import { pointFrom, pointRotateRads } from "../../../math";
import { bindOrUnbindLinearElements, updateBoundElements, } from "../../element/binding";
import { mutateElement } from "../../element/mutateElement";
import { getBoundTextElement } from "../../element/textElement";
import { isFrameLikeElement, isLinearElement, isTextElement, } from "../../element/typeChecks";
import { getSelectedGroupIds, getElementsInGroup, isInGroup, } from "../../groups";
export const SMALLEST_DELTA = 0.01;
export const isPropertyEditable = (element, property) => {
    if (property === "height" && isTextElement(element)) {
        return false;
    }
    if (property === "width" && isTextElement(element)) {
        return false;
    }
    if (property === "angle" && isFrameLikeElement(element)) {
        return false;
    }
    return true;
};
export const getStepSizedValue = (value, stepSize) => {
    const v = value + stepSize / 2;
    return v - (v % stepSize);
};
export const getElementsInAtomicUnit = (atomicUnit, elementsMap, originalElementsMap) => {
    return Object.keys(atomicUnit)
        .map((id) => ({
        original: (originalElementsMap ?? elementsMap).get(id),
        latest: elementsMap.get(id),
    }))
        .filter((el) => el.original !== undefined && el.latest !== undefined);
};
export const newOrigin = (x1, y1, w1, h1, w2, h2, angle) => {
    /**
     * The formula below is the result of solving
     *   rotate(x1, y1, cx1, cy1, angle) = rotate(x2, y2, cx2, cy2, angle)
     * where rotate is the function defined in math.ts
     *
     * This is so that the new origin (x2, y2),
     * when rotated against the new center (cx2, cy2),
     * coincides with (x1, y1) rotated against (cx1, cy1)
     *
     * The reason for doing this computation is so the element's top left corner
     * on the canvas remains fixed after any changes in its dimension.
     */
    return {
        x: x1 +
            (w1 - w2) / 2 +
            ((w2 - w1) / 2) * Math.cos(angle) +
            ((h1 - h2) / 2) * Math.sin(angle),
        y: y1 +
            (h1 - h2) / 2 +
            ((w2 - w1) / 2) * Math.sin(angle) +
            ((h2 - h1) / 2) * Math.cos(angle),
    };
};
export const moveElement = (newTopLeftX, newTopLeftY, originalElement, elementsMap, elements, scene, originalElementsMap, shouldInformMutation = true) => {
    const latestElement = elementsMap.get(originalElement.id);
    if (!latestElement) {
        return;
    }
    const [cx, cy] = [
        originalElement.x + originalElement.width / 2,
        originalElement.y + originalElement.height / 2,
    ];
    const [topLeftX, topLeftY] = pointRotateRads(pointFrom(originalElement.x, originalElement.y), pointFrom(cx, cy), originalElement.angle);
    const changeInX = newTopLeftX - topLeftX;
    const changeInY = newTopLeftY - topLeftY;
    const [x, y] = pointRotateRads(pointFrom(newTopLeftX, newTopLeftY), pointFrom(cx + changeInX, cy + changeInY), -originalElement.angle);
    mutateElement(latestElement, {
        x,
        y,
    }, shouldInformMutation);
    updateBindings(latestElement, elementsMap, elements, scene);
    const boundTextElement = getBoundTextElement(originalElement, originalElementsMap);
    if (boundTextElement) {
        const latestBoundTextElement = elementsMap.get(boundTextElement.id);
        latestBoundTextElement &&
            mutateElement(latestBoundTextElement, {
                x: boundTextElement.x + changeInX,
                y: boundTextElement.y + changeInY,
            }, shouldInformMutation);
    }
};
export const getAtomicUnits = (targetElements, appState) => {
    const selectedGroupIds = getSelectedGroupIds(appState);
    const _atomicUnits = selectedGroupIds.map((gid) => {
        return getElementsInGroup(targetElements, gid).reduce((acc, el) => {
            acc[el.id] = true;
            return acc;
        }, {});
    });
    targetElements
        .filter((el) => !isInGroup(el))
        .forEach((el) => {
        _atomicUnits.push({
            [el.id]: true,
        });
    });
    return _atomicUnits;
};
export const updateBindings = (latestElement, elementsMap, elements, scene, options) => {
    if (isLinearElement(latestElement)) {
        bindOrUnbindLinearElements([latestElement], elementsMap, elements, scene, true, [], options?.zoom);
    }
    else {
        updateBoundElements(latestElement, elementsMap, options);
    }
};
