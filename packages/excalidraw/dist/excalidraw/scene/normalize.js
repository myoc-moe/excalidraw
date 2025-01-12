import { clamp, round } from "../../math";
import { MAX_ZOOM, MIN_ZOOM } from "../constants";
export const getNormalizedZoom = (zoom) => {
    return clamp(round(zoom, 6), MIN_ZOOM, MAX_ZOOM);
};
export const getNormalizedGridSize = (gridStep) => {
    return clamp(Math.round(gridStep), 1, 100);
};
export const getNormalizedGridStep = (gridStep) => {
    return clamp(Math.round(gridStep), 1, 100);
};
