import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState, memo } from "react";
import { getCommonBounds } from "../../element/bounds";
import { t } from "../../i18n";
import { CloseIcon } from "../icons";
import { Island } from "../Island";
import { throttle } from "lodash";
import Dimension from "./Dimension";
import Angle from "./Angle";
import FontSize from "./FontSize";
import MultiDimension from "./MultiDimension";
import { elementsAreInSameGroup } from "../../groups";
import MultiAngle from "./MultiAngle";
import MultiFontSize from "./MultiFontSize";
import Position from "./Position";
import MultiPosition from "./MultiPosition";
import Collapsible from "./Collapsible";
import { useExcalidrawAppState, useExcalidrawSetAppState } from "../App";
import { getAtomicUnits } from "./utils";
import { STATS_PANELS } from "../../constants";
import { isElbowArrow, isImageElement } from "../../element/typeChecks";
import CanvasGrid from "./CanvasGrid";
import clsx from "clsx";
import "./Stats.scss";
import { isGridModeEnabled } from "../../snapping";
import { getUncroppedWidthAndHeight } from "../../element/cropElement";
import { round } from "../../../math";
const STATS_TIMEOUT = 50;
export const Stats = (props) => {
    const appState = useExcalidrawAppState();
    const sceneNonce = props.app.scene.getSceneNonce() || 1;
    const selectedElements = props.app.scene.getSelectedElements({
        selectedElementIds: appState.selectedElementIds,
        includeBoundTextElement: false,
    });
    const gridModeEnabled = isGridModeEnabled(props.app);
    return (_jsx(StatsInner, { ...props, appState: appState, sceneNonce: sceneNonce, selectedElements: selectedElements, gridModeEnabled: gridModeEnabled }));
};
const StatsRow = ({ children, columns = 1, heading, style, ...rest }) => (_jsx("div", { className: clsx("exc-stats__row", { "exc-stats__row--heading": heading }), style: {
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        ...style,
    }, ...rest, children: children }));
StatsRow.displayName = "StatsRow";
const StatsRows = ({ children, order, style, ...rest }) => (_jsx("div", { className: "exc-stats__rows", style: { order, ...style }, ...rest, children: children }));
StatsRows.displayName = "StatsRows";
Stats.StatsRow = StatsRow;
Stats.StatsRows = StatsRows;
export const StatsInner = memo(({ app, onClose, renderCustomStats, selectedElements, appState, sceneNonce, gridModeEnabled, }) => {
    const scene = app.scene;
    const elements = scene.getNonDeletedElements();
    const elementsMap = scene.getNonDeletedElementsMap();
    const setAppState = useExcalidrawSetAppState();
    const singleElement = selectedElements.length === 1 ? selectedElements[0] : null;
    const multipleElements = selectedElements.length > 1 ? selectedElements : null;
    const cropMode = appState.croppingElementId && isImageElement(singleElement);
    const unCroppedDimension = cropMode
        ? getUncroppedWidthAndHeight(singleElement)
        : null;
    const [sceneDimension, setSceneDimension] = useState({
        width: 0,
        height: 0,
    });
    const throttledSetSceneDimension = useMemo(() => throttle((elements) => {
        const boundingBox = getCommonBounds(elements);
        setSceneDimension({
            width: Math.round(boundingBox[2]) - Math.round(boundingBox[0]),
            height: Math.round(boundingBox[3]) - Math.round(boundingBox[1]),
        });
    }, STATS_TIMEOUT), []);
    useEffect(() => {
        throttledSetSceneDimension(elements);
    }, [sceneNonce, elements, throttledSetSceneDimension]);
    useEffect(() => () => throttledSetSceneDimension.cancel(), [throttledSetSceneDimension]);
    const atomicUnits = useMemo(() => {
        return getAtomicUnits(selectedElements, appState);
    }, [selectedElements, appState]);
    return (_jsx("div", { className: "exc-stats", children: _jsxs(Island, { padding: 3, children: [_jsxs("div", { className: "title", children: [_jsx("h2", { children: t("stats.title") }), _jsx("div", { className: "close", onClick: onClose, children: CloseIcon })] }), _jsxs(Collapsible, { label: _jsx("h3", { children: t("stats.generalStats") }), open: !!(appState.stats.panels & STATS_PANELS.generalStats), openTrigger: () => setAppState((state) => {
                        return {
                            stats: {
                                open: true,
                                panels: state.stats.panels ^ STATS_PANELS.generalStats,
                            },
                        };
                    }), children: [_jsxs(StatsRows, { children: [_jsx(StatsRow, { heading: true, children: t("stats.scene") }), _jsxs(StatsRow, { columns: 2, children: [_jsx("div", { children: t("stats.shapes") }), _jsx("div", { children: elements.length })] }), _jsxs(StatsRow, { columns: 2, children: [_jsx("div", { children: t("stats.width") }), _jsx("div", { children: sceneDimension.width })] }), _jsxs(StatsRow, { columns: 2, children: [_jsx("div", { children: t("stats.height") }), _jsx("div", { children: sceneDimension.height })] }), gridModeEnabled && (_jsxs(_Fragment, { children: [_jsx(StatsRow, { heading: true, children: "Canvas" }), _jsx(StatsRow, { children: _jsx(CanvasGrid, { property: "gridStep", scene: scene, appState: appState, setAppState: setAppState }) })] }))] }), renderCustomStats?.(elements, appState)] }), selectedElements.length > 0 && (_jsx("div", { id: "elementStats", style: {
                        marginTop: 12,
                    }, children: _jsx(Collapsible, { label: _jsx("h3", { children: t("stats.elementProperties") }), open: !!(appState.stats.panels & STATS_PANELS.elementProperties), openTrigger: () => setAppState((state) => {
                            return {
                                stats: {
                                    open: true,
                                    panels: state.stats.panels ^ STATS_PANELS.elementProperties,
                                },
                            };
                        }), children: _jsxs(StatsRows, { children: [singleElement && (_jsxs(_Fragment, { children: [cropMode && (_jsx(StatsRow, { heading: true, children: t("labels.unCroppedDimension") })), appState.croppingElementId &&
                                            isImageElement(singleElement) &&
                                            unCroppedDimension && (_jsxs(StatsRow, { columns: 2, children: [_jsx("div", { children: t("stats.width") }), _jsx("div", { children: round(unCroppedDimension.width, 2) })] })), appState.croppingElementId &&
                                            isImageElement(singleElement) &&
                                            unCroppedDimension && (_jsxs(StatsRow, { columns: 2, children: [_jsx("div", { children: t("stats.height") }), _jsx("div", { children: round(unCroppedDimension.height, 2) })] })), _jsx(StatsRow, { heading: true, "data-testid": "stats-element-type", children: appState.croppingElementId
                                                ? t("labels.imageCropping")
                                                : t(`element.${singleElement.type}`) }), _jsx(StatsRow, { children: _jsx(Position, { element: singleElement, property: "x", elementsMap: elementsMap, scene: scene, appState: appState }) }), _jsx(StatsRow, { children: _jsx(Position, { element: singleElement, property: "y", elementsMap: elementsMap, scene: scene, appState: appState }) }), _jsx(StatsRow, { children: _jsx(Dimension, { property: "width", element: singleElement, scene: scene, appState: appState }) }), _jsx(StatsRow, { children: _jsx(Dimension, { property: "height", element: singleElement, scene: scene, appState: appState }) }), !isElbowArrow(singleElement) && (_jsx(StatsRow, { children: _jsx(Angle, { property: "angle", element: singleElement, scene: scene, appState: appState }) })), _jsx(StatsRow, { children: _jsx(FontSize, { property: "fontSize", element: singleElement, scene: scene, appState: appState }) })] })), multipleElements && (_jsxs(_Fragment, { children: [elementsAreInSameGroup(multipleElements) && (_jsx(StatsRow, { heading: true, children: t("element.group") })), _jsxs(StatsRow, { columns: 2, style: { margin: "0.3125rem 0" }, children: [_jsx("div", { children: t("stats.shapes") }), _jsx("div", { children: selectedElements.length })] }), _jsx(StatsRow, { children: _jsx(MultiPosition, { property: "x", elements: multipleElements, elementsMap: elementsMap, atomicUnits: atomicUnits, scene: scene, appState: appState }) }), _jsx(StatsRow, { children: _jsx(MultiPosition, { property: "y", elements: multipleElements, elementsMap: elementsMap, atomicUnits: atomicUnits, scene: scene, appState: appState }) }), _jsx(StatsRow, { children: _jsx(MultiDimension, { property: "width", elements: multipleElements, elementsMap: elementsMap, atomicUnits: atomicUnits, scene: scene, appState: appState }) }), _jsx(StatsRow, { children: _jsx(MultiDimension, { property: "height", elements: multipleElements, elementsMap: elementsMap, atomicUnits: atomicUnits, scene: scene, appState: appState }) }), _jsx(StatsRow, { children: _jsx(MultiAngle, { property: "angle", elements: multipleElements, scene: scene, appState: appState }) }), _jsx(StatsRow, { children: _jsx(MultiFontSize, { property: "fontSize", elements: multipleElements, scene: scene, appState: appState, elementsMap: elementsMap }) })] }))] }) }) }))] }) }));
}, (prev, next) => {
    return (prev.sceneNonce === next.sceneNonce &&
        prev.selectedElements === next.selectedElements &&
        prev.appState.stats.panels === next.appState.stats.panels &&
        prev.gridModeEnabled === next.gridModeEnabled &&
        prev.appState.gridStep === next.appState.gridStep &&
        prev.appState.croppingElementId === next.appState.croppingElementId);
});
