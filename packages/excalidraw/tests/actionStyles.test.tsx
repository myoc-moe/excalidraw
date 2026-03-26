import React from "react";

import { CODES } from "@excalidraw/common";

import { copiedStyles } from "../actions/actionStyles";
import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { Keyboard, Pointer, UI } from "../tests/helpers/ui";
import {
  act,
  fireEvent,
  render,
  screen,
  togglePopover,
} from "../tests/test-utils";

const { h } = window;

const mouse = new Pointer("mouse");

describe("actionStyles", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  afterEach(async () => {
    // https://github.com/floating-ui/floating-ui/issues/1908#issuecomment-1301553793
    // affects node v16+
    await act(async () => {});
  });

  it("should not copy or paste styles via keyboard", async () => {
    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(20, 20);

    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(20, 20);

    // Change some styles of second rectangle
    togglePopover("Stroke");
    UI.clickOnTestId("color-red");
    togglePopover("Background");
    UI.clickOnTestId("color-blue");
    // Fill style
    fireEvent.click(screen.getByTitle("Cross-hatch"));
    // Stroke width
    fireEvent.click(screen.getByTitle("Bold"));
    // Stroke style
    fireEvent.click(screen.getByTitle("Dotted"));
    // Roughness
    fireEvent.click(screen.getByTitle("Cartoonist"));
    // Opacity
    fireEvent.change(screen.getByTestId("opacity"), {
      target: { value: "60" },
    });

    mouse.reset();

    API.setSelectedElements([h.elements[1]]);
    expect(copiedStyles).toBe("{}");

    Keyboard.withModifierKeys({ ctrl: true, alt: true }, () => {
      Keyboard.codeDown(CODES.C);
    });
    expect(copiedStyles).toBe("{}");

    mouse.reset();
    // Paste styles to first rectangle
    const originalFirstRect = {
      strokeColor: h.elements[0].strokeColor,
      backgroundColor: h.elements[0].backgroundColor,
      fillStyle: h.elements[0].fillStyle,
      strokeWidth: h.elements[0].strokeWidth,
      strokeStyle: h.elements[0].strokeStyle,
      roughness: h.elements[0].roughness,
      opacity: h.elements[0].opacity,
    };

    API.setSelectedElements([h.elements[0]]);
    Keyboard.withModifierKeys({ ctrl: true, alt: true }, () => {
      Keyboard.codeDown(CODES.V);
    });

    const firstRect = API.getSelectedElement();
    expect(firstRect.id).toBe(h.elements[0].id);
    expect(firstRect.strokeColor).toBe(originalFirstRect.strokeColor);
    expect(firstRect.backgroundColor).toBe(originalFirstRect.backgroundColor);
    expect(firstRect.fillStyle).toBe(originalFirstRect.fillStyle);
    expect(firstRect.strokeWidth).toBe(originalFirstRect.strokeWidth);
    expect(firstRect.strokeStyle).toBe(originalFirstRect.strokeStyle);
    expect(firstRect.roughness).toBe(originalFirstRect.roughness);
    expect(firstRect.opacity).toBe(originalFirstRect.opacity);
  });
});
