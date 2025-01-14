import { jsx as _jsx } from "react/jsx-runtime";
import StatsDragInput from "./DragInput";
import { mutateElement } from "../../element/mutateElement";
import { getStepSizedValue } from "./utils";
import { fontSizeIcon } from "../icons";
import { isTextElement, redrawTextBoundingBox } from "../../element";
import { hasBoundTextElement } from "../../element/typeChecks";
import { getBoundTextElement } from "../../element/textElement";
const MIN_FONT_SIZE = 4;
const STEP_SIZE = 4;
const handleFontSizeChange = ({ accumulatedChange, originalElements, shouldChangeByStepSize, nextValue, scene, }) => {
    const elementsMap = scene.getNonDeletedElementsMap();
    const origElement = originalElements[0];
    if (origElement) {
        const latestElement = elementsMap.get(origElement.id);
        if (!latestElement || !isTextElement(latestElement)) {
            return;
        }
        let nextFontSize;
        if (nextValue !== undefined) {
            nextFontSize = Math.max(Math.round(nextValue), MIN_FONT_SIZE);
        }
        else if (origElement.type === "text") {
            const originalFontSize = Math.round(origElement.fontSize);
            const changeInFontSize = Math.round(accumulatedChange);
            nextFontSize = Math.max(originalFontSize + changeInFontSize, MIN_FONT_SIZE);
            if (shouldChangeByStepSize) {
                nextFontSize = getStepSizedValue(nextFontSize, STEP_SIZE);
            }
        }
        if (nextFontSize) {
            mutateElement(latestElement, {
                fontSize: nextFontSize,
            });
            redrawTextBoundingBox(latestElement, scene.getContainerElement(latestElement), scene.getNonDeletedElementsMap());
        }
    }
};
const FontSize = ({ element, scene, appState, property }) => {
    const _element = isTextElement(element)
        ? element
        : hasBoundTextElement(element)
            ? getBoundTextElement(element, scene.getNonDeletedElementsMap())
            : null;
    if (!_element) {
        return null;
    }
    return (_jsx(StatsDragInput, { label: "F", value: Math.round(_element.fontSize * 10) / 10, elements: [_element], dragInputCallback: handleFontSizeChange, icon: fontSizeIcon, appState: appState, scene: scene, property: property }));
};
export default FontSize;
