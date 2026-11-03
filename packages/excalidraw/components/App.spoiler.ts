import {
  CURSOR_TYPE,
  DRAGGING_THRESHOLD,
  Emitter,
  SPOILER_REVEAL_DOUBLE_CLICK_TIMEOUT,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";
import {
  isImageSpoilerHidden,
  isInitializedImageElement,
  isPointInSpoilerButton,
  ShapeCache,
} from "@excalidraw/element";
import { pointDistance, pointFrom } from "@excalidraw/math";

import type {
  ExcalidrawElement,
  FileId,
  InitializedExcalidrawImageElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { t } from "../i18n";

import type { StaticCanvasSpoilerConfig } from "../scene/types";
import type { SpoilerVisibility } from "../types";
import type App from "./App";
import type { ContextMenuItems } from "./ContextMenu";

type ClientPoint = { clientX: number; clientY: number };

/**
 * MyOC: the view state of spoilered files, and the "Show spoiler" button of a
 * hidden image (hit test, hover, press and click). The state lives outside
 * `appState`, so it never reaches the store, history, `onChange`, local
 * storage or exported JSON. No method calls `setState`.
 */
export class AppSpoilers {
  /** mutated in place, so the identity stays stable for the static canvas */
  private readonly map = new Map<FileId, SpoilerVisibility>();
  /** visibility given to files marked from now on */
  private defaultVisibility: SpoilerVisibility = "hidden";
  /** fires on each change of the map, with no App render */
  public readonly emitter = new Emitter<[]>();

  /** the image whose "Show spoiler" button is under the pointer */
  private hoveredElementId: ExcalidrawElement["id"] | null = null;
  /** the last pointer position on the canvas while no button is pressed, so
      that the hover follows a zoom, a pan or a state change with no move.
      `hoverable` is false over the scroll bars or during an edit. */
  private lastPointer: (ClientPoint & { hoverable: boolean }) | null = null;
  /** the button under the last pointer down. A click shows the file only
      when it ends on the same button with no drag. */
  private buttonPointerDown: {
    elementId: ExcalidrawElement["id"];
    clientX: number;
    clientY: number;
  } | null = null;
  /** the last click that showed a file, so that its double-click does not
      act on the shown image */
  private lastReveal: {
    elementId: ExcalidrawElement["id"];
    time: number;
  } | null = null;

  private renderConfig: StaticCanvasSpoilerConfig | null = null;

  constructor(
    private app: App,
    private opts: {
      /** after each change of the map, for the App guards (crop mode, GIF
          playback) */
      onChange: (changedFileIds: ReadonlySet<FileId>) => void;
    },
  ) {}

  // ---------------------------------------------------------------------------
  // state
  // ---------------------------------------------------------------------------

  /** the live map. Read-only for callers: change it with the API methods. */
  get files(): ReadonlyMap<FileId, SpoilerVisibility> {
    return this.map;
  }

  isFileHidden = (fileId: FileId) => this.map.get(fileId) === "hidden";

  /** true for an image whose file is hidden. False for an element with no
      file id. */
  isImageSpoilerHidden = (element: ExcalidrawElement | null | undefined) =>
    isImageSpoilerHidden(element, this);

  /** The spoiler input of the static render config. The same object while
      the label does not change, so the static canvas does not render again
      on each App render. */
  getRenderConfig = (label: string): StaticCanvasSpoilerConfig => {
    if (this.renderConfig?.overlay?.label !== label) {
      this.renderConfig = {
        isFileHidden: this.isFileHidden,
        overlay: { label, getHoveredElementId: this.getHoveredElementId },
      };
    }
    return this.renderConfig;
  };

  // ---------------------------------------------------------------------------
  // API
  // ---------------------------------------------------------------------------

  getFiles = (): ReadonlyMap<FileId, SpoilerVisibility> => new Map(this.map);

  markFile = (fileId: FileId, spoilered: boolean) => {
    if (spoilered) {
      if (this.map.has(fileId)) {
        return;
      }
      this.map.set(fileId, this.defaultVisibility);
    } else {
      if (!this.map.delete(fileId)) {
        return;
      }
      this.resetDefaultIfNoneShown();
    }
    this.onFilesChanged(new Set([fileId]));
  };

  setFileVisibility = (fileId: FileId, visibility: SpoilerVisibility) => {
    this.setMarkedFilesVisibility([fileId], visibility);
  };

  /** Also sets the default when no file is marked. The reset rule does not
      apply here. */
  setAllFilesVisibility = (visibility: SpoilerVisibility) => {
    this.defaultVisibility = visibility;
    const changed = new Set<FileId>();
    for (const [fileId, current] of this.map) {
      if (current !== visibility) {
        this.map.set(fileId, visibility);
        changed.add(fileId);
      }
    }
    if (changed.size) {
      this.onFilesChanged(changed);
    }
  };

  /** Sets many marked files at once. One repaint and one
      `onSpoileredFilesChange` call, and none when nothing changes. Unmarked
      files are skipped. */
  private setMarkedFilesVisibility = (
    fileIds: Iterable<FileId>,
    visibility: SpoilerVisibility,
  ) => {
    const changed = new Set<FileId>();
    for (const fileId of fileIds) {
      const current = this.map.get(fileId);
      if (current !== undefined && current !== visibility) {
        this.map.set(fileId, visibility);
        changed.add(fileId);
      }
    }
    if (!changed.size) {
      return;
    }
    this.resetDefaultIfNoneShown();
    this.onFilesChanged(changed);
  };

  /** a map with no shown entry left resets the default for new marks */
  private resetDefaultIfNoneShown = () => {
    for (const visibility of this.map.values()) {
      if (visibility === "shown") {
        return;
      }
    }
    this.defaultVisibility = "hidden";
  };

  /** Clears the render caches of the affected files only, repaints the
      static canvas once and notifies the host. */
  private onFilesChanged = (changedFileIds: ReadonlySet<FileId>) => {
    for (const element of this.app.scene.getElementsIncludingDeleted()) {
      if (
        isInitializedImageElement(element) &&
        changedFileIds.has(element.fileId)
      ) {
        ShapeCache.delete(element);
      }
    }
    for (const fileId of changedFileIds) {
      if (this.isFileHidden(fileId)) {
        this.endCrossFade(fileId);
      }
    }
    // the button under a still pointer can come or go. The repaint below
    // draws the new hover state too.
    this.refreshHover({ repaint: false });
    this.app.imagePlaceholderUpdateEmitter.trigger();
    this.emitter.trigger();
    this.app.props.onSpoileredFilesChange?.(this.getFiles());

    this.opts.onChange(changedFileIds);
  };

  /** A hidden file draws no cross-fade. Ending it here keeps the image cache
      out of the render path, and the file shows with no stale thumbnail
      later. */
  endCrossFade = (fileId: FileId) => {
    const cacheEntry = this.app.imageCache.get(fileId);
    if (cacheEntry?.transitionStart !== undefined) {
      delete cacheEntry.placeholderImage;
      delete cacheEntry.transitionStart;
    }
  };

  // ---------------------------------------------------------------------------
  // the "Show spoiler" button
  // ---------------------------------------------------------------------------

  /** The hidden image whose "Show spoiler" button is at `scenePointer` and is
      not covered there by another element. The top hit element at the point
      must be the image itself. */
  getButtonAtPosition = (scenePointer: {
    x: number;
    y: number;
  }): InitializedExcalidrawImageElement | null => {
    if (!this.map.size) {
      return null;
    }
    const label = t("labels.showSpoiler");
    const zoom = this.app.state.zoom.value;
    const isHiddenImage = (
      element: ExcalidrawElement | null,
    ): element is InitializedExcalidrawImageElement =>
      !!element &&
      isInitializedImageElement(element) &&
      this.isImageSpoilerHidden(element);

    // cheap check first: the pointer is on a drawn button
    if (
      !this.app.visibleElements.some(
        (element) =>
          isHiddenImage(element) &&
          isPointInSpoilerButton(element, scenePointer, zoom, label),
      )
    ) {
      return null;
    }

    const topElement = this.app.getElementAtPosition(
      scenePointer.x,
      scenePointer.y,
      { includeBoundTextElement: true, includeLockedElements: true },
    );
    return isHiddenImage(topElement) &&
      isPointInSpoilerButton(topElement, scenePointer, zoom, label)
      ? topElement
      : null;
  };

  getHoveredElementId = () => this.hoveredElementId;

  /** From a pointer move. `hoverable` is false when the pointer cannot hover
      a button (over a scroll bar, or while an element is edited). The move
      handler sets the cursor. */
  updateHover = (pointer: ClientPoint, hoverable: boolean) => {
    this.lastPointer = {
      clientX: pointer.clientX,
      clientY: pointer.clientY,
      hoverable,
    };
    this.setHoveredElementId(this.getButtonAtLastPointer(), true);
  };

  /** Computes the hover again from the last pointer position, after a zoom, a
      pan or a state change with no pointer move, and sets the cursor when the
      hover changes. Repaints only when the pointer enters or leaves a button:
      the element canvas cache key holds the hover state, so only that
      element draws again. */
  refreshHover = ({ repaint }: { repaint: boolean }) => {
    const hoveredId = this.getButtonAtLastPointer();
    if (this.setHoveredElementId(hoveredId, repaint)) {
      if (hoveredId) {
        this.app.cursor.set(CURSOR_TYPE.POINTER);
      } else {
        this.app.cursor.applyForTool();
      }
    }
  };

  private getButtonAtLastPointer = () => {
    const pointer = this.lastPointer;
    return pointer?.hoverable && this.isHoverIdle()
      ? this.getButtonAtPosition(
          viewportCoordsToSceneCoords(pointer, this.app.state),
        )?.id ?? null
      : null;
  };

  /** the pointer left the canvas */
  onPointerLeave = () => {
    this.lastPointer = null;
    this.setHoveredElementId(null, true);
  };

  private setHoveredElementId = (
    hoveredId: ExcalidrawElement["id"] | null,
    repaint: boolean,
  ) => {
    if (hoveredId === this.hoveredElementId) {
      return false;
    }
    this.hoveredElementId = hoveredId;
    if (repaint) {
      this.app.imagePlaceholderUpdateEmitter.trigger();
    }
    return true;
  };

  private isHoverIdle = () => {
    const { state } = this.app;
    return (
      !state.newElement &&
      !state.selectionElement &&
      !state.selectedElementsAreBeingDragged &&
      !state.multiElement
    );
  };

  /** Called before every early return of the pointer down (pans in view
      mode, with the hand tool or the space key), so that the click can check
      where the press started. A press starts a gesture: the hover follows
      the next pointer move, not a zoom or pan during the press. */
  onPointerDown = (
    event: ClientPoint,
    scenePointer: { x: number; y: number },
  ) => {
    this.lastPointer = null;
    const image = this.getButtonAtPosition(scenePointer);
    this.buttonPointerDown = image
      ? {
          elementId: image.id,
          clientX: event.clientX,
          clientY: event.clientY,
        }
      : null;
  };

  /** a press on a "Show spoiler" button selects but never moves */
  isButtonPressed = () => this.buttonPointerDown !== null;

  /** Shows the file when the click starts and ends on the same button, with
      no drag (pan, box selection). Returns true when it handled the click. */
  handleClick = (
    event: ClientPoint & { preventDefault(): void; stopPropagation(): void },
    scenePointer: { x: number; y: number },
  ) => {
    const pointerDown = this.buttonPointerDown;
    this.buttonPointerDown = null;
    const image = this.getButtonAtPosition(scenePointer);
    if (
      !image ||
      pointerDown?.elementId !== image.id ||
      pointDistance(
        pointFrom(pointerDown.clientX, pointerDown.clientY),
        pointFrom(event.clientX, event.clientY),
      ) >= DRAGGING_THRESHOLD
    ) {
      return false;
    }
    event.preventDefault();
    event.stopPropagation();
    this.lastReveal = { elementId: image.id, time: performance.now() };
    this.setFileVisibility(image.fileId, "shown");
    this.setHoveredElementId(null, true);
    return true;
  };

  /** true when a click of this double-click showed the file of the image
      under the pointer. The double-click then does nothing to that image (no
      smart zoom, no crop). */
  isDoubleClickOfReveal = (event: ClientPoint) => {
    const reveal = this.lastReveal;
    if (
      !reveal ||
      performance.now() - reveal.time > SPOILER_REVEAL_DOUBLE_CLICK_TIMEOUT
    ) {
      return false;
    }
    const { x, y } = viewportCoordsToSceneCoords(event, this.app.state);
    return (
      this.app.getElementAtPosition(x, y, {
        includeBoundTextElement: true,
        includeLockedElements: true,
      })?.id === reveal.elementId
    );
  };

  // ---------------------------------------------------------------------------
  // context menu
  // ---------------------------------------------------------------------------

  /** "Show spoiler" or "Hide spoiler" for the selected images with a marked
      file. The label is "Hide spoiler" when any of them is shown. The item
      sets all of them to the same target. */
  getContextMenuItems = (
    hitElement?: NonDeletedExcalidrawElement | null,
  ): ContextMenuItems => {
    if (!this.map.size) {
      return [];
    }

    const { state } = this.app;
    const candidates =
      hitElement && !state.selectedElementIds[hitElement.id]
        ? [hitElement]
        : this.app.scene.getSelectedElements(state);

    const fileIds = new Set<FileId>();
    for (const element of candidates) {
      if (isInitializedImageElement(element) && this.map.has(element.fileId)) {
        fileIds.add(element.fileId);
      }
    }
    if (!fileIds.size) {
      return [];
    }

    const anyShown = [...fileIds].some(
      (fileId) => this.map.get(fileId) === "shown",
    );
    const target: SpoilerVisibility = anyShown ? "hidden" : "shown";
    return [
      {
        key: "toggleSpoiler",
        label: t(anyShown ? "labels.hideSpoiler" : "labels.showSpoiler"),
        onSelect: () => this.setMarkedFilesVisibility(fileIds, target),
      },
    ];
  };
}
