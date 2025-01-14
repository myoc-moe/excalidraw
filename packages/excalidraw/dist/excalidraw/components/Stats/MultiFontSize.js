import { jsx as _jsx } from "react/jsx-runtime";
import { isTextElement, redrawTextBoundingBox } from "../../element";
import { mutateElement } from "../../element/mutateElement";
import { hasBoundTextElement } from "../../element/typeChecks";
import { isInGroup } from "../../groups";
import { fontSizeIcon } from "../icons";
import StatsDragInput from "./DragInput";
import { getStepSizedValue } from "./utils";
import { getBoundTextElement } from "../../element/textElement";
const MIN_FONT_SIZE = 4;
const STEP_SIZE = 4;
const getApplicableTextElements = (elements, elementsMap) => elements.reduce((acc, el) => {
    if (!el || isInGroup(el)) {
        return acc;
    }
    if (isTextElement(el)) {
        acc.push(el);
        return acc;
    }
    if (hasBoundTextElement(el)) {
        const boundTextElement = getBoundTextElement(el, elementsMap);
        if (boundTextElement) {
            acc.push(boundTextElement);
            return acc;
        }
    }
    return acc;
}, []);
const handleFontSizeChange = ({ accumulatedChange, originalElements, shouldChangeByStepSize, nextValue, scene, }) => {
    const elementsMap = scene.getNonDeletedElementsMap();
    const latestTextElements = originalElements.map((el) => elementsMap.get(el.id));
    let nextFontSize;
    if (nextValue) {
        nextFontSize = Math.max(Math.round(nextValue), MIN_FONT_SIZE);
        for (const textElement of latestTextElements) {
            mutateElement(textElement, {
                fontSize: nextFontSize,
            }, false);
            redrawTextBoundingBox(textElement, scene.getContainerElement(textElement), elementsMap, false);
        }
        scene.triggerUpdate();
    }
    else {
        const originalTextElements = originalElements;
        for (let i = 0; i < latestTextElements.length; i++) {
            const latestElement = latestTextElements[i];
            const originalElement = originalTextElements[i];
            const originalFontSize = Math.round(originalElement.fontSize);
            const changeInFontSize = Math.round(accumulatedChange);
            let nextFontSize = Math.max(originalFontSize + changeInFontSize, MIN_FONT_SIZE);
            if (shouldChangeByStepSize) {
                nextFontSize = getStepSizedValue(nextFontSize, STEP_SIZE);
            }
            mutateElement(latestElement, {
                fontSize: nextFontSize,
            }, false);
            redrawTextBoundingBox(latestElement, scene.getContainerElement(latestElement), elementsMap, false);
        }
        scene.triggerUpdate();
    }
};
const MultiFontSize = ({ elements, scene, appState, property, elementsMap, }) => {
    const latestTextElements = getApplicableTextElements(elements, elementsMap);
    if (!latestTextElements.length) {
        return null;
    }
    const fontSizes = latestTextElements.map((textEl) => Math.round(textEl.fontSize * 10) / 10);
    const value = new Set(fontSizes).size === 1 ? fontSizes[0] : "Mixed";
    const editable = fontSizes.length > 0;
    return (_jsx(StatsDragInput, { label: "F", icon: fontSizeIcon, elements: latestTextElements, dragInputCallback: handleFontSizeChange, value: value, editable: editable, scene: scene, property: property, appState: appState }));
};
export default MultiFontSize;
