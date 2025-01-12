import { jsx as _jsx } from "react/jsx-runtime";
import StatsDragInput from "./DragInput";
import { getStepSizedValue } from "./utils";
import { getNormalizedGridStep } from "../../scene";
const STEP_SIZE = 5;
const CanvasGrid = ({ property, scene, appState, setAppState, }) => {
    return (_jsx(StatsDragInput, { label: "Grid step", sensitivity: 8, elements: [], dragInputCallback: ({ nextValue, instantChange, shouldChangeByStepSize, setInputValue, }) => {
            setAppState((state) => {
                let nextGridStep;
                if (nextValue) {
                    nextGridStep = nextValue;
                }
                else if (instantChange) {
                    nextGridStep = shouldChangeByStepSize
                        ? getStepSizedValue(state.gridStep + STEP_SIZE * Math.sign(instantChange), STEP_SIZE)
                        : state.gridStep + instantChange;
                }
                if (!nextGridStep) {
                    setInputValue(state.gridStep);
                    return null;
                }
                nextGridStep = getNormalizedGridStep(nextGridStep);
                setInputValue(nextGridStep);
                return {
                    gridStep: nextGridStep,
                };
            });
        }, scene: scene, value: appState.gridStep, property: property, appState: appState }));
};
export default CanvasGrid;
