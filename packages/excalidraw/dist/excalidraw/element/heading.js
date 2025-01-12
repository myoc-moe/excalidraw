import { pointFrom, pointRotateRads, pointScaleFromOrigin, radiansToDegrees, triangleIncludesPoint, } from "../../math";
import { getCenterForBounds } from "./bounds";
export const HEADING_RIGHT = [1, 0];
export const HEADING_DOWN = [0, 1];
export const HEADING_LEFT = [-1, 0];
export const HEADING_UP = [0, -1];
export const headingForDiamond = (a, b) => {
    const angle = radiansToDegrees(Math.atan2(b[1] - a[1], b[0] - a[0]));
    if (angle >= 315 || angle < 45) {
        return HEADING_UP;
    }
    else if (angle >= 45 && angle < 135) {
        return HEADING_RIGHT;
    }
    else if (angle >= 135 && angle < 225) {
        return HEADING_DOWN;
    }
    return HEADING_LEFT;
};
export const vectorToHeading = (vec) => {
    const [x, y] = vec;
    const absX = Math.abs(x);
    const absY = Math.abs(y);
    if (x > absY) {
        return HEADING_RIGHT;
    }
    else if (x <= -absY) {
        return HEADING_LEFT;
    }
    else if (y > absX) {
        return HEADING_DOWN;
    }
    return HEADING_UP;
};
export const compareHeading = (a, b) => a[0] === b[0] && a[1] === b[1];
// Gets the heading for the point by creating a bounding box around the rotated
// close fitting bounding box, then creating 4 search cones around the center of
// the external bbox.
export const headingForPointFromElement = (element, aabb, p) => {
    const SEARCH_CONE_MULTIPLIER = 2;
    const midPoint = getCenterForBounds(aabb);
    if (element.type === "diamond") {
        if (p[0] < element.x) {
            return HEADING_LEFT;
        }
        else if (p[1] < element.y) {
            return HEADING_UP;
        }
        else if (p[0] > element.x + element.width) {
            return HEADING_RIGHT;
        }
        else if (p[1] > element.y + element.height) {
            return HEADING_DOWN;
        }
        const top = pointRotateRads(pointScaleFromOrigin(pointFrom(element.x + element.width / 2, element.y), midPoint, SEARCH_CONE_MULTIPLIER), midPoint, element.angle);
        const right = pointRotateRads(pointScaleFromOrigin(pointFrom(element.x + element.width, element.y + element.height / 2), midPoint, SEARCH_CONE_MULTIPLIER), midPoint, element.angle);
        const bottom = pointRotateRads(pointScaleFromOrigin(pointFrom(element.x + element.width / 2, element.y + element.height), midPoint, SEARCH_CONE_MULTIPLIER), midPoint, element.angle);
        const left = pointRotateRads(pointScaleFromOrigin(pointFrom(element.x, element.y + element.height / 2), midPoint, SEARCH_CONE_MULTIPLIER), midPoint, element.angle);
        if (triangleIncludesPoint([top, right, midPoint], p)) {
            return headingForDiamond(top, right);
        }
        else if (triangleIncludesPoint([right, bottom, midPoint], p)) {
            return headingForDiamond(right, bottom);
        }
        else if (triangleIncludesPoint([bottom, left, midPoint], p)) {
            return headingForDiamond(bottom, left);
        }
        return headingForDiamond(left, top);
    }
    const topLeft = pointScaleFromOrigin(pointFrom(aabb[0], aabb[1]), midPoint, SEARCH_CONE_MULTIPLIER);
    const topRight = pointScaleFromOrigin(pointFrom(aabb[2], aabb[1]), midPoint, SEARCH_CONE_MULTIPLIER);
    const bottomLeft = pointScaleFromOrigin(pointFrom(aabb[0], aabb[3]), midPoint, SEARCH_CONE_MULTIPLIER);
    const bottomRight = pointScaleFromOrigin(pointFrom(aabb[2], aabb[3]), midPoint, SEARCH_CONE_MULTIPLIER);
    return triangleIncludesPoint([topLeft, topRight, midPoint], p)
        ? HEADING_UP
        : triangleIncludesPoint([topRight, bottomRight, midPoint], p)
            ? HEADING_RIGHT
            : triangleIncludesPoint([bottomRight, bottomLeft, midPoint], p)
                ? HEADING_DOWN
                : HEADING_LEFT;
};
export const flipHeading = (h) => [
    h[0] === 0 ? 0 : h[0] > 0 ? -1 : 1,
    h[1] === 0 ? 0 : h[1] > 0 ? -1 : 1,
];
