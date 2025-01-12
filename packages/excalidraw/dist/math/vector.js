/**
 * Create a vector from the x and y coordiante elements.
 *
 * @param x The X aspect of the vector
 * @param y T Y aspect of the vector
 * @returns The constructed vector with X and Y as the coordinates
 */
export function vector(x, y, originX = 0, originY = 0) {
    return [x - originX, y - originY];
}
/**
 * Turn a point into a vector with the origin point.
 *
 * @param p The point to turn into a vector
 * @param origin The origin point in a given coordiante system
 * @returns The created vector from the point and the origin
 */
export function vectorFromPoint(p, origin = [0, 0]) {
    return vector(p[0] - origin[0], p[1] - origin[1]);
}
/**
 * Cross product is a binary operation on two vectors in 2D space.
 * It results in a vector that is perpendicular to both vectors.
 *
 * @param a One of the vectors to use for the directed area calculation
 * @param b The other vector to use for the directed area calculation
 * @returns The directed area value for the two vectos
 */
export function vectorCross(a, b) {
    return a[0] * b[1] - b[0] * a[1];
}
/**
 * Dot product is defined as the sum of the products of the
 * two vectors.
 *
 * @param a One of the vectors for which the sum of products is calculated
 * @param b The other vector for which the sum of products is calculated
 * @returns The sum of products of the two vectors
 */
export function vectorDot(a, b) {
    return a[0] * b[0] + a[1] * b[1];
}
/**
 * Determines if the value has the shape of a Vector.
 *
 * @param v The value to test
 * @returns TRUE if the value has the shape and components of a Vectors
 */
export function isVector(v) {
    return (Array.isArray(v) &&
        v.length === 2 &&
        typeof v[0] === "number" &&
        !isNaN(v[0]) &&
        typeof v[1] === "number" &&
        !isNaN(v[1]));
}
/**
 * Add two vectors by adding their coordinates.
 *
 * @param a One of the vectors to add
 * @param b The other vector to add
 * @returns The sum vector of the two provided vectors
 */
export function vectorAdd(a, b) {
    return [a[0] + b[0], a[1] + b[1]];
}
/**
 * Add two vectors by adding their coordinates.
 *
 * @param start One of the vectors to add
 * @param end The other vector to add
 * @returns The sum vector of the two provided vectors
 */
export function vectorSubtract(start, end) {
    return [start[0] - end[0], start[1] - end[1]];
}
/**
 * Scale vector by a scalar.
 *
 * @param v The vector to scale
 * @param scalar The scalar to multiply the vector components with
 * @returns The new scaled vector
 */
export function vectorScale(v, scalar) {
    return vector(v[0] * scalar, v[1] * scalar);
}
/**
 * Calculates the sqare magnitude of a vector. Use this if you compare
 * magnitudes as it saves you an SQRT.
 *
 * @param v The vector to measure
 * @returns The scalar squared magnitude of the vector
 */
export function vectorMagnitudeSq(v) {
    return v[0] * v[0] + v[1] * v[1];
}
/**
 * Calculates the magnitude of a vector.
 *
 * @param v The vector to measure
 * @returns The scalar magnitude of the vector
 */
export function vectorMagnitude(v) {
    return Math.sqrt(vectorMagnitudeSq(v));
}
/**
 * Normalize the vector (i.e. make the vector magnitue equal 1).
 *
 * @param v The vector to normalize
 * @returns The new normalized vector
 */
export const vectorNormalize = (v) => {
    const m = vectorMagnitude(v);
    return vector(v[0] / m, v[1] / m);
};
/**
 * Project the first vector onto the second vector
 */
export const vectorProjection = (a, b) => {
    return vectorScale(b, vectorDot(a, b) / vectorDot(b, b));
};
