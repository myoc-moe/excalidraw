import throttle from "lodash.throttle";
import { isNonDeletedElement } from "../element";
import { isFrameLikeElement } from "../element/typeChecks";
import { getSelectedElements } from "./selection";
import { randomInteger } from "../random";
import { syncInvalidIndices, syncMovedIndices, validateFractionalIndices, } from "../fractionalIndex";
import { arrayToMap } from "../utils";
import { toBrandedType } from "../utils";
import { ENV } from "../constants";
import { getElementsInGroup } from "../groups";
const getNonDeletedElements = (allElements) => {
    const elementsMap = new Map();
    const elements = [];
    for (const element of allElements) {
        if (!element.isDeleted) {
            elements.push(element);
            elementsMap.set(element.id, element);
        }
    }
    return { elementsMap, elements };
};
const validateIndicesThrottled = throttle((elements) => {
    if (import.meta.env.DEV ||
        import.meta.env.MODE === ENV.TEST ||
        window?.DEBUG_FRACTIONAL_INDICES) {
        validateFractionalIndices(elements, {
            // throw only in dev & test, to remain functional on `DEBUG_FRACTIONAL_INDICES`
            shouldThrow: import.meta.env.DEV || import.meta.env.MODE === ENV.TEST,
            includeBoundTextValidation: true,
        });
    }
}, 1000 * 60, { leading: true, trailing: false });
const hashSelectionOpts = (opts) => {
    const keys = ["includeBoundTextElement", "includeElementsInFrames"];
    let hash = "";
    for (const key of keys) {
        hash += `${key}:${opts[key] ? "1" : "0"}`;
    }
    return hash;
};
const isIdKey = (elementKey) => {
    if (typeof elementKey === "string") {
        return true;
    }
    return false;
};
class Scene {
    // ---------------------------------------------------------------------------
    // static methods/props
    // ---------------------------------------------------------------------------
    static sceneMapByElement = new WeakMap();
    static sceneMapById = new Map();
    static mapElementToScene(elementKey, scene) {
        if (isIdKey(elementKey)) {
            // for cases where we don't have access to the element object
            // (e.g. restore serialized appState with id references)
            this.sceneMapById.set(elementKey, scene);
        }
        else {
            this.sceneMapByElement.set(elementKey, scene);
            // if mapping element objects, also cache the id string when later
            // looking up by id alone
            this.sceneMapById.set(elementKey.id, scene);
        }
    }
    /**
     * @deprecated pass down `app.scene` and use it directly
     */
    static getScene(elementKey) {
        if (isIdKey(elementKey)) {
            return this.sceneMapById.get(elementKey) || null;
        }
        return this.sceneMapByElement.get(elementKey) || null;
    }
    // ---------------------------------------------------------------------------
    // instance methods/props
    // ---------------------------------------------------------------------------
    callbacks = new Set();
    nonDeletedElements = [];
    nonDeletedElementsMap = toBrandedType(new Map());
    // ideally all elements within the scene should be wrapped around with `Ordered` type, but right now there is no real benefit doing so
    elements = [];
    nonDeletedFramesLikes = [];
    frames = [];
    elementsMap = toBrandedType(new Map());
    selectedElementsCache = {
        selectedElementIds: null,
        elements: null,
        cache: new Map(),
    };
    /**
     * Random integer regenerated each scene update.
     *
     * Does not relate to elements versions, it's only a renderer
     * cache-invalidation nonce at the moment.
     */
    sceneNonce;
    getSceneNonce() {
        return this.sceneNonce;
    }
    getNonDeletedElementsMap() {
        return this.nonDeletedElementsMap;
    }
    getElementsIncludingDeleted() {
        return this.elements;
    }
    getElementsMapIncludingDeleted() {
        return this.elementsMap;
    }
    getNonDeletedElements() {
        return this.nonDeletedElements;
    }
    getFramesIncludingDeleted() {
        return this.frames;
    }
    getSelectedElements(opts) {
        const hash = hashSelectionOpts(opts);
        const elements = opts?.elements || this.nonDeletedElements;
        if (this.selectedElementsCache.elements === elements &&
            this.selectedElementsCache.selectedElementIds === opts.selectedElementIds) {
            const cached = this.selectedElementsCache.cache.get(hash);
            if (cached) {
                return cached;
            }
        }
        else if (opts?.elements == null) {
            // if we're operating on latest scene elements and the cache is not
            //  storing the latest elements, clear the cache
            this.selectedElementsCache.cache.clear();
        }
        const selectedElements = getSelectedElements(elements, { selectedElementIds: opts.selectedElementIds }, opts);
        // cache only if we're not using custom elements
        if (opts?.elements == null) {
            this.selectedElementsCache.selectedElementIds = opts.selectedElementIds;
            this.selectedElementsCache.elements = this.nonDeletedElements;
            this.selectedElementsCache.cache.set(hash, selectedElements);
        }
        return selectedElements;
    }
    getNonDeletedFramesLikes() {
        return this.nonDeletedFramesLikes;
    }
    getElement(id) {
        return this.elementsMap.get(id) || null;
    }
    getNonDeletedElement(id) {
        const element = this.getElement(id);
        if (element && isNonDeletedElement(element)) {
            return element;
        }
        return null;
    }
    /**
     * A utility method to help with updating all scene elements, with the added
     * performance optimization of not renewing the array if no change is made.
     *
     * Maps all current excalidraw elements, invoking the callback for each
     * element. The callback should either return a new mapped element, or the
     * original element if no changes are made. If no changes are made to any
     * element, this results in a no-op. Otherwise, the newly mapped elements
     * are set as the next scene's elements.
     *
     * @returns whether a change was made
     */
    mapElements(iteratee) {
        let didChange = false;
        const newElements = this.elements.map((element) => {
            const nextElement = iteratee(element);
            if (nextElement !== element) {
                didChange = true;
            }
            return nextElement;
        });
        if (didChange) {
            this.replaceAllElements(newElements);
        }
        return didChange;
    }
    replaceAllElements(nextElements) {
        const _nextElements = 
        // ts doesn't like `Array.isArray` of `instanceof Map`
        nextElements instanceof Array
            ? nextElements
            : Array.from(nextElements.values());
        const nextFrameLikes = [];
        validateIndicesThrottled(_nextElements);
        this.elements = syncInvalidIndices(_nextElements);
        this.elementsMap.clear();
        this.elements.forEach((element) => {
            if (isFrameLikeElement(element)) {
                nextFrameLikes.push(element);
            }
            this.elementsMap.set(element.id, element);
            Scene.mapElementToScene(element, this);
        });
        const nonDeletedElements = getNonDeletedElements(this.elements);
        this.nonDeletedElements = nonDeletedElements.elements;
        this.nonDeletedElementsMap = nonDeletedElements.elementsMap;
        this.frames = nextFrameLikes;
        this.nonDeletedFramesLikes = getNonDeletedElements(this.frames).elements;
        this.triggerUpdate();
    }
    triggerUpdate() {
        this.sceneNonce = randomInteger();
        for (const callback of Array.from(this.callbacks)) {
            callback();
        }
    }
    onUpdate(cb) {
        if (this.callbacks.has(cb)) {
            throw new Error();
        }
        this.callbacks.add(cb);
        return () => {
            if (!this.callbacks.has(cb)) {
                throw new Error();
            }
            this.callbacks.delete(cb);
        };
    }
    destroy() {
        this.elements = [];
        this.nonDeletedElements = [];
        this.nonDeletedFramesLikes = [];
        this.frames = [];
        this.elementsMap.clear();
        this.selectedElementsCache.selectedElementIds = null;
        this.selectedElementsCache.elements = null;
        this.selectedElementsCache.cache.clear();
        Scene.sceneMapById.forEach((scene, elementKey) => {
            if (scene === this) {
                Scene.sceneMapById.delete(elementKey);
            }
        });
        // done not for memory leaks, but to guard against possible late fires
        // (I guess?)
        this.callbacks.clear();
    }
    insertElementAtIndex(element, index) {
        if (!Number.isFinite(index) || index < 0) {
            throw new Error("insertElementAtIndex can only be called with index >= 0");
        }
        const nextElements = [
            ...this.elements.slice(0, index),
            element,
            ...this.elements.slice(index),
        ];
        syncMovedIndices(nextElements, arrayToMap([element]));
        this.replaceAllElements(nextElements);
    }
    insertElementsAtIndex(elements, index) {
        if (!elements.length) {
            return;
        }
        if (!Number.isFinite(index) || index < 0) {
            throw new Error("insertElementAtIndex can only be called with index >= 0");
        }
        const nextElements = [
            ...this.elements.slice(0, index),
            ...elements,
            ...this.elements.slice(index),
        ];
        syncMovedIndices(nextElements, arrayToMap(elements));
        this.replaceAllElements(nextElements);
    }
    insertElement = (element) => {
        const index = element.frameId
            ? this.getElementIndex(element.frameId)
            : this.elements.length;
        this.insertElementAtIndex(element, index);
    };
    insertElements = (elements) => {
        if (!elements.length) {
            return;
        }
        const index = elements[0]?.frameId
            ? this.getElementIndex(elements[0].frameId)
            : this.elements.length;
        this.insertElementsAtIndex(elements, index);
    };
    getElementIndex(elementId) {
        return this.elements.findIndex((element) => element.id === elementId);
    }
    getContainerElement = (element) => {
        if (!element) {
            return null;
        }
        if (element.containerId) {
            return this.getElement(element.containerId) || null;
        }
        return null;
    };
    getElementsFromId = (id) => {
        const elementsMap = this.getNonDeletedElementsMap();
        // first check if the id is an element
        const el = elementsMap.get(id);
        if (el) {
            return [el];
        }
        // then, check if the id is a group
        return getElementsInGroup(elementsMap, id);
    };
}
export default Scene;
