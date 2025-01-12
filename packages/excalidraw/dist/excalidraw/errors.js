export class CanvasError extends Error {
    constructor(message = "Couldn't export canvas.", name = "CANVAS_ERROR") {
        super();
        this.name = name;
        this.message = message;
    }
}
export class AbortError extends DOMException {
    constructor(message = "Request Aborted") {
        super(message, "AbortError");
    }
}
export class ImageSceneDataError extends Error {
    code;
    constructor(message = "Image Scene Data Error", code = "IMAGE_SCENE_DATA_ERROR") {
        super(message);
        this.name = "EncodingError";
        this.code = code;
    }
}
export class InvalidFractionalIndexError extends Error {
    code = "ELEMENT_HAS_INVALID_INDEX";
}
export class WorkerUrlNotDefinedError extends Error {
    code;
    constructor(message = "Worker URL is not defined!", code = "WORKER_URL_NOT_DEFINED") {
        super(message);
        this.name = "WorkerUrlNotDefinedError";
        this.code = code;
    }
}
export class WorkerInTheMainChunkError extends Error {
    code;
    constructor(message = "Worker has to be in a separate chunk!", code = "WORKER_IN_THE_MAIN_CHUNK") {
        super(message);
        this.name = "WorkerInTheMainChunkError";
        this.code = code;
    }
}
/**
 * Use this for generic, handled errors, so you can check against them
 * and rethrow if needed
 */
export class ExcalidrawError extends Error {
    constructor(message) {
        super(message);
        this.name = "ExcalidrawError";
    }
}
