import { isElementInViewport } from "../element/sizeHelpers";
import { isImageElement } from "../element/typeChecks";
import { renderInteractiveSceneThrottled } from "../renderer/interactiveScene";
import { renderStaticSceneThrottled } from "../renderer/staticScene";
import { memoize, toBrandedType } from "../utils";
export class Renderer {
    scene;
    constructor(scene) {
        this.scene = scene;
    }
    getRenderableElements = (() => {
        const getVisibleCanvasElements = ({ elementsMap, zoom, offsetLeft, offsetTop, scrollX, scrollY, height, width, }) => {
            const visibleElements = [];
            for (const element of elementsMap.values()) {
                if (isElementInViewport(element, width, height, {
                    zoom,
                    offsetLeft,
                    offsetTop,
                    scrollX,
                    scrollY,
                }, elementsMap)) {
                    visibleElements.push(element);
                }
            }
            return visibleElements;
        };
        const getRenderableElements = ({ elements, editingTextElement, newElementId, pendingImageElementId, }) => {
            const elementsMap = toBrandedType(new Map());
            for (const element of elements) {
                if (isImageElement(element)) {
                    if (
                    // => not placed on canvas yet (but in elements array)
                    pendingImageElementId === element.id) {
                        continue;
                    }
                }
                if (newElementId === element.id) {
                    continue;
                }
                // we don't want to render text element that's being currently edited
                // (it's rendered on remote only)
                if (!editingTextElement ||
                    editingTextElement.type !== "text" ||
                    element.id !== editingTextElement.id) {
                    elementsMap.set(element.id, element);
                }
            }
            return elementsMap;
        };
        return memoize(({ zoom, offsetLeft, offsetTop, scrollX, scrollY, height, width, editingTextElement, newElementId, pendingImageElementId, 
        // cache-invalidation nonce
        sceneNonce: _sceneNonce, }) => {
            const elements = this.scene.getNonDeletedElements();
            const elementsMap = getRenderableElements({
                elements,
                editingTextElement,
                newElementId,
                pendingImageElementId,
            });
            const visibleElements = getVisibleCanvasElements({
                elementsMap,
                zoom,
                offsetLeft,
                offsetTop,
                scrollX,
                scrollY,
                height,
                width,
            });
            return { elementsMap, visibleElements };
        });
    })();
    // NOTE Doesn't destroy everything (scene, rc, etc.) because it may not be
    // safe to break TS contract here (for upstream cases)
    destroy() {
        renderInteractiveSceneThrottled.cancel();
        renderStaticSceneThrottled.cancel();
        this.getRenderableElements.clear();
    }
}
