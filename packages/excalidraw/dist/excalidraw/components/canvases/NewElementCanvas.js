import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useRef } from "react";
import { renderNewElementScene } from "../../renderer/renderNewElementScene";
import { isRenderThrottlingEnabled } from "../../reactUtils";
const NewElementCanvas = (props) => {
    const canvasRef = useRef(null);
    useEffect(() => {
        if (!canvasRef.current) {
            return;
        }
        renderNewElementScene({
            canvas: canvasRef.current,
            scale: props.scale,
            newElement: props.appState.newElement,
            elementsMap: props.elementsMap,
            allElementsMap: props.allElementsMap,
            rc: props.rc,
            renderConfig: props.renderConfig,
            appState: props.appState,
        }, isRenderThrottlingEnabled());
    });
    return (_jsx("canvas", { className: "excalidraw__canvas", style: {
            width: props.appState.width,
            height: props.appState.height,
        }, width: props.appState.width * props.scale, height: props.appState.height * props.scale, ref: canvasRef }));
};
export default NewElementCanvas;
