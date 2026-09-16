import fs from "fs";
import path from "path";

import React from "react";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { render } from "./test-utils";

const hintViewerStyles = fs.readFileSync(
  path.resolve(__dirname, "../components/HintViewer.scss"),
  "utf8",
);
const styles = fs.readFileSync(
  path.resolve(__dirname, "../css/styles.scss"),
  "utf8",
);

describe("hint viewer", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  it("MyOC regression: keeps multiline hints readable in a translucent badge", () => {
    const hint = document.querySelector<HTMLElement>(".HintViewer");
    const content = hint?.querySelector<HTMLElement>("span");

    expect(hint).not.toBeNull();
    expect(content).not.toBeNull();
    expect(hint).toHaveClass("HintViewer");
    expect(content?.textContent).toContain("\n");

    // MyOC regression: jsdom does not expose the imported SCSS rules through
    // CSSOM, so assert the merge-sensitive declarations from their source.
    expect(hintViewerStyles).toContain("color: #fff;");
    expect(hintViewerStyles).toContain("opacity: 0.6;");
    expect(hintViewerStyles).toContain(
      "background-color: rgb(0 0 0 / 55%);",
    );
    expect(hintViewerStyles).toContain("border-radius: 4px;");
    expect(hintViewerStyles).toContain("white-space: pre-line;");
    expect(styles).toContain(
      ".smart-zoom-button button.smart-zoom-button--key-held",
    );
    expect(styles).toContain(
      "animation: smart-zoom-key-pulse 1.4s ease-in-out infinite;",
    );
  });

  it("MyOC regression: keeps Smart Zoom and crop shortcuts separate for images", () => {
    const image = API.createElement({
      type: "image",
      width: 120,
      height: 90,
    });

    API.setElements([image]);
    API.setAppState({ selectedElementIds: { [image.id]: true } });

    const hint = document.querySelector<HTMLElement>(".HintViewer");
    const shortcuts = Array.from(hint?.querySelectorAll("kbd") ?? []).map(
      (shortcut) => shortcut.textContent,
    );

    expect(hint?.textContent).toContain(
      "double click to smart zoom, or press Enter to crop",
    );
    expect(shortcuts).toEqual(["double click", "Enter"]);
  });
});
