import { getNonDeletedElements, getNormalizedDimensions, isInvisiblySmallElement, refreshTextDimensions, } from "../element";
import { isArrowElement, isElbowArrow, isFixedPointBinding, isLinearElement, isTextElement, isUsingAdaptiveRadius, } from "../element/typeChecks";
import { randomId } from "../random";
import { DEFAULT_FONT_FAMILY, DEFAULT_TEXT_ALIGN, DEFAULT_VERTICAL_ALIGN, FONT_FAMILY, ROUNDNESS, DEFAULT_SIDEBAR, DEFAULT_ELEMENT_PROPS, DEFAULT_GRID_SIZE, DEFAULT_GRID_STEP, } from "../constants";
import { getDefaultAppState } from "../appState";
import { LinearElementEditor } from "../element/linearElementEditor";
import { bumpVersion } from "../element/mutateElement";
import { getUpdatedTimestamp, updateActiveTool } from "../utils";
import { arrayToMap } from "../utils";
import { detectLineHeight, getContainerElement } from "../element/textElement";
import { normalizeLink } from "./url";
import { syncInvalidIndices } from "../fractionalIndex";
import { getSizeFromPoints } from "../points";
import { getLineHeight } from "../fonts";
import { normalizeFixedPoint } from "../element/binding";
import { getNormalizedGridSize, getNormalizedGridStep, getNormalizedZoom, } from "../scene";
import { isFiniteNumber, pointFrom } from "../../math";
export const AllowedExcalidrawActiveTools = {
    selection: true,
    text: true,
    rectangle: true,
    diamond: true,
    ellipse: true,
    line: true,
    image: true,
    arrow: true,
    freedraw: true,
    eraser: false,
    custom: true,
    frame: true,
    embeddable: true,
    hand: true,
    laser: false,
    magicframe: false,
};
const getFontFamilyByName = (fontFamilyName) => {
    if (Object.keys(FONT_FAMILY).includes(fontFamilyName)) {
        return FONT_FAMILY[fontFamilyName];
    }
    return DEFAULT_FONT_FAMILY;
};
const repairBinding = (element, binding) => {
    if (!binding) {
        return null;
    }
    return {
        ...binding,
        focus: binding.focus || 0,
        ...(isElbowArrow(element) && isFixedPointBinding(binding)
            ? {
                fixedPoint: normalizeFixedPoint(binding.fixedPoint ?? [0, 0]),
            }
            : {}),
    };
};
const restoreElementWithProperties = (element, extra) => {
    const base = {
        type: extra.type || element.type,
        // all elements must have version > 0 so getSceneVersion() will pick up
        // newly added elements
        version: element.version || 1,
        versionNonce: element.versionNonce ?? 0,
        index: element.index ?? null,
        isDeleted: element.isDeleted ?? false,
        id: element.id || randomId(),
        fillStyle: element.fillStyle || DEFAULT_ELEMENT_PROPS.fillStyle,
        strokeWidth: element.strokeWidth || DEFAULT_ELEMENT_PROPS.strokeWidth,
        strokeStyle: element.strokeStyle ?? DEFAULT_ELEMENT_PROPS.strokeStyle,
        roughness: element.roughness ?? DEFAULT_ELEMENT_PROPS.roughness,
        opacity: element.opacity == null ? DEFAULT_ELEMENT_PROPS.opacity : element.opacity,
        angle: element.angle || 0,
        x: extra.x ?? element.x ?? 0,
        y: extra.y ?? element.y ?? 0,
        strokeColor: element.strokeColor || DEFAULT_ELEMENT_PROPS.strokeColor,
        backgroundColor: element.backgroundColor || DEFAULT_ELEMENT_PROPS.backgroundColor,
        width: element.width || 0,
        height: element.height || 0,
        seed: element.seed ?? 1,
        groupIds: element.groupIds ?? [],
        frameId: element.frameId ?? null,
        roundness: element.roundness
            ? element.roundness
            : element.strokeSharpness === "round"
                ? {
                    // for old elements that would now use adaptive radius algo,
                    // use legacy algo instead
                    type: isUsingAdaptiveRadius(element.type)
                        ? ROUNDNESS.LEGACY
                        : ROUNDNESS.PROPORTIONAL_RADIUS,
                }
                : null,
        boundElements: element.boundElementIds
            ? element.boundElementIds.map((id) => ({ type: "arrow", id }))
            : element.boundElements ?? [],
        updated: element.updated ?? getUpdatedTimestamp(),
        link: element.link ? normalizeLink(element.link) : null,
        locked: element.locked ?? false,
    };
    if ("customData" in element || "customData" in extra) {
        base.customData =
            "customData" in extra ? extra.customData : element.customData;
    }
    return {
        // spread the original element properties to not lose unknown ones
        // for forward-compatibility
        ...element,
        // normalized properties
        ...base,
        ...getNormalizedDimensions(base),
        ...extra,
    };
};
const restoreElement = (element) => {
    switch (element.type) {
        case "text":
            let fontSize = element.fontSize;
            let fontFamily = element.fontFamily;
            if ("font" in element) {
                const [fontPx, _fontFamily] = element.font.split(" ");
                fontSize = parseFloat(fontPx);
                fontFamily = getFontFamilyByName(_fontFamily);
            }
            const text = (typeof element.text === "string" && element.text) || "";
            // line-height might not be specified either when creating elements
            // programmatically, or when importing old diagrams.
            // For the latter we want to detect the original line height which
            // will likely differ from our per-font fixed line height we now use,
            // to maintain backward compatibility.
            const lineHeight = element.lineHeight ||
                (element.height
                    ? // detect line-height from current element height and font-size
                        detectLineHeight(element)
                    : // no element height likely means programmatic use, so default
                        // to a fixed line height
                        getLineHeight(element.fontFamily));
            element = restoreElementWithProperties(element, {
                fontSize,
                fontFamily,
                text,
                textAlign: element.textAlign || DEFAULT_TEXT_ALIGN,
                verticalAlign: element.verticalAlign || DEFAULT_VERTICAL_ALIGN,
                containerId: element.containerId ?? null,
                originalText: element.originalText || text,
                autoResize: element.autoResize ?? true,
                lineHeight,
            });
            // if empty text, mark as deleted. We keep in array
            // for data integrity purposes (collab etc.)
            if (!text && !element.isDeleted) {
                element = { ...element, originalText: text, isDeleted: true };
                element = bumpVersion(element);
            }
            return element;
        case "freedraw": {
            return restoreElementWithProperties(element, {
                points: element.points,
                lastCommittedPoint: null,
                simulatePressure: element.simulatePressure,
                pressures: element.pressures,
            });
        }
        case "image":
            return restoreElementWithProperties(element, {
                status: element.status || "pending",
                fileId: element.fileId,
                scale: element.scale || [1, 1],
                crop: element.crop ?? null,
            });
        case "line":
        // @ts-ignore LEGACY type
        // eslint-disable-next-line no-fallthrough
        case "draw":
            const { startArrowhead = null, endArrowhead = null } = element;
            let x = element.x;
            let y = element.y;
            let points = // migrate old arrow model to new one
             !Array.isArray(element.points) || element.points.length < 2
                ? [pointFrom(0, 0), pointFrom(element.width, element.height)]
                : element.points;
            if (points[0][0] !== 0 || points[0][1] !== 0) {
                ({ points, x, y } = LinearElementEditor.getNormalizedPoints(element));
            }
            return restoreElementWithProperties(element, {
                type: element.type === "draw"
                    ? "line"
                    : element.type,
                startBinding: repairBinding(element, element.startBinding),
                endBinding: repairBinding(element, element.endBinding),
                lastCommittedPoint: null,
                startArrowhead,
                endArrowhead,
                points,
                x,
                y,
                ...getSizeFromPoints(points),
            });
        case "arrow": {
            const { startArrowhead = null, endArrowhead = "arrow" } = element;
            let x = element.x;
            let y = element.y;
            let points = // migrate old arrow model to new one
             !Array.isArray(element.points) || element.points.length < 2
                ? [pointFrom(0, 0), pointFrom(element.width, element.height)]
                : element.points;
            if (points[0][0] !== 0 || points[0][1] !== 0) {
                ({ points, x, y } = LinearElementEditor.getNormalizedPoints(element));
            }
            // TODO: Separate arrow from linear element
            return restoreElementWithProperties(element, {
                type: element.type,
                startBinding: repairBinding(element, element.startBinding),
                endBinding: repairBinding(element, element.endBinding),
                lastCommittedPoint: null,
                startArrowhead,
                endArrowhead,
                points,
                x,
                y,
                elbowed: element.elbowed,
                ...getSizeFromPoints(points),
            });
        }
        // generic elements
        case "ellipse":
        case "rectangle":
        case "diamond":
        case "iframe":
        case "embeddable":
            return restoreElementWithProperties(element, {});
        case "magicframe":
        case "frame":
            return restoreElementWithProperties(element, {
                name: element.name ?? null,
            });
        // Don't use default case so as to catch a missing an element type case.
        // We also don't want to throw, but instead return void so we filter
        // out these unsupported elements from the restored array.
    }
    return null;
};
/**
 * Repairs container element's boundElements array by removing duplicates and
 * fixing containerId of bound elements if not present. Also removes any
 * bound elements that do not exist in the elements array.
 *
 * NOTE mutates elements.
 */
const repairContainerElement = (container, elementsMap) => {
    if (container.boundElements) {
        // copy because we're not cloning on restore, and we don't want to mutate upstream
        const boundElements = container.boundElements.slice();
        // dedupe bindings & fix boundElement.containerId if not set already
        const boundIds = new Set();
        container.boundElements = boundElements.reduce((acc, binding) => {
            const boundElement = elementsMap.get(binding.id);
            if (boundElement && !boundIds.has(binding.id)) {
                boundIds.add(binding.id);
                if (boundElement.isDeleted) {
                    return acc;
                }
                acc.push(binding);
                if (isTextElement(boundElement) &&
                    // being slightly conservative here, preserving existing containerId
                    // if defined, lest boundElements is stale
                    !boundElement.containerId) {
                    boundElement.containerId =
                        container.id;
                }
            }
            return acc;
        }, []);
    }
};
/**
 * Repairs target bound element's container's boundElements array,
 * or removes contaienrId if container does not exist.
 *
 * NOTE mutates elements.
 */
const repairBoundElement = (boundElement, elementsMap) => {
    const container = boundElement.containerId
        ? elementsMap.get(boundElement.containerId)
        : null;
    if (!container) {
        boundElement.containerId = null;
        return;
    }
    if (boundElement.isDeleted) {
        return;
    }
    if (container.boundElements &&
        !container.boundElements.find((binding) => binding.id === boundElement.id)) {
        // copy because we're not cloning on restore, and we don't want to mutate upstream
        const boundElements = (container.boundElements || (container.boundElements = [])).slice();
        boundElements.push({ type: "text", id: boundElement.id });
        container.boundElements = boundElements;
    }
};
/**
 * Remove an element's frameId if its containing frame is non-existent
 *
 * NOTE mutates elements.
 */
const repairFrameMembership = (element, elementsMap) => {
    if (element.frameId) {
        const containingFrame = elementsMap.get(element.frameId);
        if (!containingFrame) {
            element.frameId = null;
        }
    }
};
export const restoreElements = (elements, 
/** NOTE doesn't serve for reconciliation */
localElements, opts) => {
    // used to detect duplicate top-level element ids
    const existingIds = new Set();
    const localElementsMap = localElements ? arrayToMap(localElements) : null;
    const restoredElements = syncInvalidIndices((elements || []).reduce((elements, element) => {
        // filtering out selection, which is legacy, no longer kept in elements,
        // and causing issues if retained
        if (element.type !== "selection" && !isInvisiblySmallElement(element)) {
            let migratedElement = restoreElement(element);
            if (migratedElement) {
                const localElement = localElementsMap?.get(element.id);
                if (localElement && localElement.version > migratedElement.version) {
                    migratedElement = bumpVersion(migratedElement, localElement.version);
                }
                if (existingIds.has(migratedElement.id)) {
                    migratedElement = { ...migratedElement, id: randomId() };
                }
                existingIds.add(migratedElement.id);
                elements.push(migratedElement);
            }
        }
        return elements;
    }, []));
    if (!opts?.repairBindings) {
        return restoredElements;
    }
    // repair binding. Mutates elements.
    const restoredElementsMap = arrayToMap(restoredElements);
    for (const element of restoredElements) {
        if (element.frameId) {
            repairFrameMembership(element, restoredElementsMap);
        }
        if (isTextElement(element) && element.containerId) {
            repairBoundElement(element, restoredElementsMap);
        }
        else if (element.boundElements) {
            repairContainerElement(element, restoredElementsMap);
        }
        if (opts.refreshDimensions && isTextElement(element)) {
            Object.assign(element, refreshTextDimensions(element, getContainerElement(element, restoredElementsMap), restoredElementsMap));
        }
        if (isLinearElement(element)) {
            if (element.startBinding &&
                (!restoredElementsMap.has(element.startBinding.elementId) ||
                    !isArrowElement(element))) {
                element.startBinding = null;
            }
            if (element.endBinding &&
                (!restoredElementsMap.has(element.endBinding.elementId) ||
                    !isArrowElement(element))) {
                element.endBinding = null;
            }
        }
    }
    return restoredElements;
};
const coalesceAppStateValue = (key, appState, defaultAppState) => {
    const value = appState[key];
    // NOTE the value! assertion is needed in TS 4.5.5 (fixed in newer versions)
    return value !== undefined ? value : defaultAppState[key];
};
const LegacyAppStateMigrations = {
    isSidebarDocked: (appState, defaultAppState) => {
        return [
            "defaultSidebarDockedPreference",
            appState.isSidebarDocked ??
                coalesceAppStateValue("defaultSidebarDockedPreference", appState, defaultAppState),
        ];
    },
};
export const restoreAppState = (appState, localAppState) => {
    appState = appState || {};
    const defaultAppState = getDefaultAppState();
    const nextAppState = {};
    // first, migrate all legacy AppState properties to new ones. We do it
    // in one go before migrate the rest of the properties in case the new ones
    // depend on checking any other key (i.e. they are coupled)
    for (const legacyKey of Object.keys(LegacyAppStateMigrations)) {
        if (legacyKey in appState) {
            const [nextKey, nextValue] = LegacyAppStateMigrations[legacyKey](appState, defaultAppState);
            nextAppState[nextKey] = nextValue;
        }
    }
    for (const [key, defaultValue] of Object.entries(defaultAppState)) {
        // if AppState contains a legacy key, prefer that one and migrate its
        // value to the new one
        const suppliedValue = appState[key];
        const localValue = localAppState ? localAppState[key] : undefined;
        nextAppState[key] =
            suppliedValue !== undefined
                ? suppliedValue
                : localValue !== undefined
                    ? localValue
                    : defaultValue;
    }
    return {
        ...nextAppState,
        cursorButton: localAppState?.cursorButton || "up",
        // reset on fresh restore so as to hide the UI button if penMode not active
        penDetected: localAppState?.penDetected ??
            (appState.penMode ? appState.penDetected ?? false : false),
        activeTool: {
            ...updateActiveTool(defaultAppState, nextAppState.activeTool.type &&
                AllowedExcalidrawActiveTools[nextAppState.activeTool.type]
                ? nextAppState.activeTool
                : { type: "selection" }),
            lastActiveTool: null,
            locked: nextAppState.activeTool.locked ?? false,
        },
        // Migrates from previous version where appState.zoom was a number
        zoom: {
            value: getNormalizedZoom(isFiniteNumber(appState.zoom)
                ? appState.zoom
                : appState.zoom?.value ?? defaultAppState.zoom.value),
        },
        openSidebar: 
        // string (legacy)
        typeof appState.openSidebar === "string"
            ? { name: DEFAULT_SIDEBAR.name }
            : nextAppState.openSidebar,
        gridSize: getNormalizedGridSize(isFiniteNumber(appState.gridSize) ? appState.gridSize : DEFAULT_GRID_SIZE),
        gridStep: getNormalizedGridStep(isFiniteNumber(appState.gridStep) ? appState.gridStep : DEFAULT_GRID_STEP),
        editingFrame: null,
    };
};
export const restore = (data, 
/**
 * Local AppState (`this.state` or initial state from localStorage) so that we
 * don't overwrite local state with default values (when values not
 * explicitly specified).
 * Supply `null` if you can't get access to it.
 */
localAppState, localElements, elementsConfig) => {
    return {
        elements: restoreElements(data?.elements, localElements, elementsConfig),
        appState: restoreAppState(data?.appState, localAppState || null),
        files: data?.files || {},
    };
};
const restoreLibraryItem = (libraryItem) => {
    const elements = restoreElements(getNonDeletedElements(libraryItem.elements), null);
    return elements.length ? { ...libraryItem, elements } : null;
};
export const restoreLibraryItems = (libraryItems = [], defaultStatus) => {
    const restoredItems = [];
    for (const item of libraryItems) {
        // migrate older libraries
        if (Array.isArray(item)) {
            const restoredItem = restoreLibraryItem({
                status: defaultStatus,
                elements: item,
                id: randomId(),
                created: Date.now(),
            });
            if (restoredItem) {
                restoredItems.push(restoredItem);
            }
        }
        else {
            const _item = item;
            const restoredItem = restoreLibraryItem({
                ..._item,
                id: _item.id || randomId(),
                status: _item.status || defaultStatus,
                created: _item.created || Date.now(),
            });
            if (restoredItem) {
                restoredItems.push(restoredItem);
            }
        }
    }
    return restoredItems;
};
