import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@excalidraw/excalidraw/tests/test-utils";

import ExcalidrawApp from "../App";

const { h } = window;

describe("EditorPreferencesDialog", () => {
  it("opens from the Preferences menu and updates editorPreferences live", async () => {
    await render(<ExcalidrawApp />);

    fireEvent.click(document.querySelector(".dropdown-menu-button")!);

    const preferencesTrigger = document.querySelector(
      ".dropdown-menu__submenu-trigger",
    ) as HTMLElement;

    fireEvent.pointerMove(preferencesTrigger);
    fireEvent.click(preferencesTrigger);

    fireEvent.click(await screen.findByTestId("editor-preferences-menu-item"));

    await waitFor(() => {
      expect(screen.getByText("Editor Preferences")).not.toBeNull();
    });

    const gapInput = screen.getByTestId(
      "editor-preferences-arrange-gap",
    ) as HTMLInputElement;

    expect(gapInput.value).toBe("10");

    fireEvent.change(gapInput, { target: { value: "48" } });

    await waitFor(() => {
      expect(
        (
          screen.getByTestId(
            "editor-preferences-arrange-gap",
          ) as HTMLInputElement
        ).value,
      ).toBe("48");
      expect(h.app.props.editorPreferences?.arrange?.gap).toBe(48);
    });

    fireEvent.change(screen.getByTestId("editor-preferences-normalise-mode"), {
      target: { value: "first" },
    });

    await waitFor(() => {
      expect(h.app.props.editorPreferences?.normalise?.mode).toBe("first");
    });

    fireEvent.click(
      screen.getByTestId("editor-preferences-smartzoom-respect-ui"),
    );

    await waitFor(() => {
      expect(h.app.props.editorPreferences?.smartZoom?.respectUIElements).toBe(
        true,
      );
    });
  });
});
