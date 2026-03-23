import React from "react";

import { KEYS } from "@excalidraw/common";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import { render, waitFor } from "./test-utils";

describe("shortcuts", () => {
  it("Delete shortcut should delete the selected element", async () => {
    await render(
      <Excalidraw
        initialData={{ elements: [API.createElement({ type: "rectangle" })] }}
        handleKeyboardGlobally
      />,
    );

    expect(window.h.elements.length).toBe(1);
    API.setSelectedElements([window.h.elements[0]]);

    Keyboard.keyPress(KEYS.DELETE);

    await waitFor(() => {
      expect(window.h.elements[0].isDeleted).toBe(true);
    });
  });
});
