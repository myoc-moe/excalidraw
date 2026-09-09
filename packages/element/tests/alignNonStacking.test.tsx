import { KEYS, arrayToMap } from "@excalidraw/common";
import { getElementBounds } from "@excalidraw/element";
import {
  actionAlignBottom,
  actionAlignHorizontallyCentered,
  actionAlignLeft,
  actionAlignRight,
  actionAlignTop,
} from "@excalidraw/excalidraw/actions";
import { Excalidraw } from "@excalidraw/excalidraw";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { Keyboard } from "@excalidraw/excalidraw/tests/helpers/ui";
import {
  render,
  unmountComponent,
} from "@excalidraw/excalidraw/tests/test-utils";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { Radians } from "@excalidraw/math";

const setSelectedRectangles = (
  rectangles: Array<
    Pick<ExcalidrawElement, "id" | "x" | "y" | "width" | "height"> &
      Partial<Pick<ExcalidrawElement, "angle" | "groupIds">>
  >,
) => {
  const elements = rectangles.map((rectangle) =>
    API.createElement({ type: "rectangle", ...rectangle }),
  );
  API.setElements(elements);
  API.setSelectedElements(elements);
  return elements;
};

describe("non-stacking alignment", () => {
  beforeEach(async () => {
    unmountComponent();
    await render(
      <Excalidraw
        compressImageFile={async (file) => file}
        handleKeyboardGlobally
      />,
    );
  });

  it("MyOC regression: compacts left using every perpendicular blocker", () => {
    const [anchor, upper, lower, spanning] = setSelectedRectangles([
      { id: "anchor", x: 0, y: 0, width: 100, height: 200 },
      { id: "upper", x: 200, y: 0, width: 60, height: 100 },
      { id: "lower", x: 220, y: 100, width: 80, height: 100 },
      { id: "spanning", x: 400, y: 0, width: 40, height: 200 },
    ]);

    Keyboard.withModifierKeys({ ctrl: true, shift: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_LEFT);
    });

    expect(API.getElement(anchor).x).toBe(0);
    expect(API.getElement(upper).x).toBe(110);
    expect(API.getElement(lower).x).toBe(110);
    expect(API.getElement(spanning).x).toBe(200);
  });

  it("MyOC regression: mirrors collision-free placement from the right", () => {
    const [spanning, upper, lower, anchor] = setSelectedRectangles([
      { id: "spanning", x: 0, y: 0, width: 40, height: 200 },
      { id: "upper", x: 140, y: 0, width: 60, height: 100 },
      { id: "lower", x: 140, y: 100, width: 80, height: 100 },
      { id: "anchor", x: 300, y: 0, width: 100, height: 200 },
    ]);

    API.executeAction(actionAlignRight);

    expect(API.getElement(anchor).x).toBe(300);
    expect(API.getElement(upper).x).toBe(230);
    expect(API.getElement(lower).x).toBe(210);
    expect(API.getElement(spanning).x).toBe(160);
  });

  it("MyOC regression: compacts from the top and bottom", () => {
    const elements = setSelectedRectangles([
      { id: "a", x: 0, y: 0, width: 200, height: 100 },
      { id: "b", x: 0, y: 200, width: 100, height: 60 },
      { id: "c", x: 100, y: 220, width: 100, height: 80 },
      { id: "d", x: 0, y: 400, width: 200, height: 40 },
    ]);

    API.executeAction(actionAlignTop);
    expect(elements.map((element) => API.getElement(element).y)).toEqual([
      0, 110, 110, 200,
    ]);

    const bottomElements = setSelectedRectangles([
      { id: "a", x: 0, y: 0, width: 200, height: 100 },
      { id: "b", x: 0, y: 200, width: 100, height: 60 },
      { id: "c", x: 100, y: 220, width: 100, height: 80 },
      { id: "d", x: 0, y: 400, width: 200, height: 40 },
    ]);
    API.executeAction(actionAlignBottom);
    expect(bottomElements.map((element) => API.getElement(element).y)).toEqual([
      200, 330, 310, 400,
    ]);
  });

  it("MyOC regression: clamps a negative gap to zero", async () => {
    unmountComponent();
    await render(
      <Excalidraw
        compressImageFile={async (file) => file}
        editorPreferences={{ arrange: { gap: -20 } }}
      />,
    );
    const [anchor, next] = setSelectedRectangles([
      { id: "anchor", x: 0, y: 0, width: 100, height: 100 },
      { id: "next", x: 200, y: 0, width: 100, height: 100 },
    ]);

    API.executeAction(actionAlignLeft);

    expect(API.getElement(anchor).x).toBe(0);
    expect(API.getElement(next).x).toBe(100);
  });

  it("MyOC regression: uses rotated bounds and keeps groups intact", () => {
    const [anchor, groupedA, groupedB] = setSelectedRectangles([
      { id: "anchor", x: 0, y: 0, width: 100, height: 200 },
      {
        id: "grouped-a",
        x: 200,
        y: 0,
        width: 60,
        height: 60,
        angle: (Math.PI / 4) as Radians,
        groupIds: ["group"],
      },
      {
        id: "grouped-b",
        x: 260,
        y: 60,
        width: 40,
        height: 40,
        groupIds: ["group"],
      },
    ]);
    const originalDelta = {
      x: groupedB.x - groupedA.x,
      y: groupedB.y - groupedA.y,
    };

    API.executeAction(actionAlignLeft);

    const updatedElements = [anchor, groupedA, groupedB].map((element) =>
      API.getElement(element),
    );
    const elementsMap = arrayToMap(updatedElements);
    const anchorBounds = getElementBounds(API.getElement(anchor), elementsMap);
    const groupedBounds = [groupedA, groupedB].map((element) =>
      getElementBounds(API.getElement(element), elementsMap),
    );
    expect(Math.min(...groupedBounds.map(([x]) => x))).toBeCloseTo(
      anchorBounds[2] + 10,
    );
    expect(API.getElement(groupedB).x - API.getElement(groupedA).x).toBe(
      originalDelta.x,
    );
    expect(API.getElement(groupedB).y - API.getElement(groupedA).y).toBe(
      originalDelta.y,
    );
  });

  it("MyOC regression: moves bound text with its non-stacking container", () => {
    const standalone = API.createElement({
      type: "rectangle",
      id: "standalone",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    const container = API.createElement({
      type: "rectangle",
      id: "container",
      x: 200,
      y: 0,
      width: 100,
      height: 100,
      boundElements: [{ type: "text", id: "bound-text" }],
    });
    const boundText = API.createElement({
      type: "text",
      id: "bound-text",
      x: 220,
      y: 40,
      width: 60,
      height: 20,
      containerId: container.id,
    });
    API.setElements([standalone, container, boundText]);
    API.setSelectedElements([standalone, container]);

    API.executeAction(actionAlignLeft);

    expect(API.getElement(standalone).x).toBe(0);
    expect(API.getElement(container).x).toBe(110);
    expect(API.getElement(boundText).x).toBe(130);
    expect(API.getElement(boundText).y).toBe(40);
  });

  it("MyOC regression: stacking restores legacy edges and centers stay exact", async () => {
    unmountComponent();
    await render(
      <Excalidraw
        compressImageFile={async (file) => file}
        editorPreferences={{ align: { stacking: true } }}
      />,
    );
    let elements = setSelectedRectangles([
      { id: "a", x: 0, y: 0, width: 100, height: 100 },
      { id: "b", x: 200, y: 0, width: 100, height: 100 },
    ]);

    API.executeAction(actionAlignLeft);
    expect(elements.map((element) => API.getElement(element).x)).toEqual([
      0, 0,
    ]);

    elements = setSelectedRectangles([
      { id: "a", x: 0, y: 0, width: 100, height: 100 },
      { id: "b", x: 200, y: 0, width: 200, height: 100 },
    ]);
    API.executeAction(actionAlignHorizontallyCentered);
    expect(elements.map((element) => API.getElement(element).x)).toEqual([
      150, 100,
    ]);
  });
});
