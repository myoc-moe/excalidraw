export const PRECISION = 10e-5;
export const clamp = (value, min, max) => {
    return Math.min(Math.max(value, min), max);
};
export const round = (value, precision, func = "round") => {
    const multiplier = Math.pow(10, precision);
    return Math[func]((value + Number.EPSILON) * multiplier) / multiplier;
};
export const roundToStep = (value, step, func = "round") => {
    const factor = 1 / step;
    return Math[func](value * factor) / factor;
};
export const average = (a, b) => (a + b) / 2;
export const isFiniteNumber = (value) => {
    return typeof value === "number" && Number.isFinite(value);
};
export const isCloseTo = (a, b, precision = PRECISION) => Math.abs(a - b) < precision;
