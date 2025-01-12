import { throttleRAF } from "../utils";
import { bootstrapCanvas, getNormalizedCanvasDimensions } from "./helpers";
import { renderElement } from "./renderElement";
const _renderNewElementScene = ({ canvas, rc, newElement, elementsMap, allElementsMap, scale, appState, renderConfig, }) => {
    if (canvas) {
        const [normalizedWidth, normalizedHeight] = getNormalizedCanvasDimensions(canvas, scale);
        const context = bootstrapCanvas({
            canvas,
            scale,
            normalizedWidth,
            normalizedHeight,
        });
        // Apply zoom
        context.save();
        context.scale(appState.zoom.value, appState.zoom.value);
        if (newElement && newElement.type !== "selection") {
            renderElement(newElement, elementsMap, allElementsMap, rc, context, renderConfig, appState);
        }
        else {
            context.clearRect(0, 0, normalizedWidth, normalizedHeight);
        }
    }
};
export const renderNewElementSceneThrottled = throttleRAF((config) => {
    _renderNewElementScene(config);
}, { trailing: true });
export const renderNewElementScene = (renderConfig, throttle) => {
    if (throttle) {
        renderNewElementSceneThrottled(renderConfig);
        return;
    }
    _renderNewElementScene(renderConfig);
};
