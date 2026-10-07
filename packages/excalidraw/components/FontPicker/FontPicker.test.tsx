import { KEYS, toGoogleFontFamily } from "@excalidraw/common";
import { vi } from "vitest";

import { Excalidraw, convertToExcalidrawElements } from "../../index";
import { Keyboard } from "../../tests/helpers/ui";
import { act, fireEvent, render, waitFor } from "../../tests/test-utils";

describe("FontPicker", () => {
  it("should be able to open font picker", async () => {
    (global as any).ResizeObserver =
      (global as any).ResizeObserver ||
      class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      };

    const { queryByTestId } = await render(
      <Excalidraw
        compressImageFile={async (file) => file}
        handleKeyboardGlobally={true}
      />,
    );

    Keyboard.keyPress(KEYS.T);

    const fontPickerTrigger = queryByTestId("font-family-show-fonts");

    expect(fontPickerTrigger).not.toBeNull();

    act(() => {
      fontPickerTrigger!.click();
    });
  });

  it("shows the host upgrade action when Google Fonts are unavailable", async () => {
    const { queryByTestId, queryByText } = await render(
      <Excalidraw
        handleKeyboardGlobally={true}
        googleFonts={{
          canBrowse: false,
          loadCatalog: async () => [],
          upgradeAction: <button type="button">Upgrade for more fonts</button>,
        }}
      />,
    );

    Keyboard.keyPress(KEYS.T);
    const fontPickerTrigger = queryByTestId("font-family-show-fonts");
    expect(fontPickerTrigger).not.toBeNull();
    await act(async () => {
      fontPickerTrigger!.click();
    });

    expect(queryByText("Upgrade for more fonts")).not.toBeNull();
  });

  it("loads the entitled font catalog lazily and searches beyond popular fonts", async () => {
    const popularFamilies = Array.from(
      { length: 20 },
      (_, index) => `Popular ${index}`,
    );
    const loadCatalog = vi.fn(async () => [
      ...popularFamilies,
      "Searchable Google Font",
    ]);
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("offline"));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const { container, queryByTestId, queryByText } = await render(
      <Excalidraw
        compressImageFile={async (file) => file}
        handleKeyboardGlobally={true}
        googleFonts={{ canBrowse: true, loadCatalog }}
      />,
    );

    Keyboard.keyPress(KEYS.T);
    const fontPickerTrigger = queryByTestId("font-family-show-fonts");
    expect(fontPickerTrigger).not.toBeNull();
    expect(loadCatalog).not.toHaveBeenCalled();

    await act(async () => {
      fontPickerTrigger!.click();
    });

    await waitFor(() => {
      expect(loadCatalog).toHaveBeenCalledTimes(1);
      expect(queryByText("Popular 0")).not.toBeNull();
    });
    expect(queryByText("Searchable Google Font")).toBeNull();

    const searchInput = container.querySelector(".QuickSearch__input");
    expect(searchInput).not.toBeNull();
    fireEvent.change(searchInput!, {
      target: { value: "Searchable Google Font" },
    });

    await waitFor(() => {
      expect(queryByText("Searchable Google Font")).not.toBeNull();
    });

    fetchMock.mockRestore();
    consoleError.mockRestore();
  });

  it("does not request or expose the catalog without host entitlement", async () => {
    const loadCatalog = vi.fn(async () => ["Premium Font"]);
    const { queryByTestId, queryByText } = await render(
      <Excalidraw
        compressImageFile={async (file) => file}
        handleKeyboardGlobally={true}
        googleFonts={{
          canBrowse: false,
          loadCatalog,
          upgradeAction: <button type="button">Upgrade for more fonts</button>,
        }}
      />,
    );

    Keyboard.keyPress(KEYS.T);
    const fontPickerTrigger = queryByTestId("font-family-show-fonts");
    expect(fontPickerTrigger).not.toBeNull();
    await act(async () => {
      fontPickerTrigger!.click();
    });

    expect(loadCatalog).not.toHaveBeenCalled();
    expect(queryByText("Premium Font")).toBeNull();
    expect(queryByText("Upgrade for more fonts")).not.toBeNull();
  });

  it("lets non-entitled editors reuse a Google font already in the scene", async () => {
    const fontFamily = toGoogleFontFamily("Existing Google Font");
    const elements = convertToExcalidrawElements([
      {
        type: "text",
        text: "Existing font text",
        x: 0,
        y: 0,
        fontFamily,
      },
    ] as any);
    const loadCatalog = vi.fn(async () => ["Premium Font"]);
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("offline"));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const { queryByTestId, queryByText } = await render(
      <Excalidraw
        compressImageFile={async (file) => file}
        handleKeyboardGlobally={true}
        initialData={{ elements }}
        googleFonts={{ canBrowse: false, loadCatalog }}
      />,
    );

    Keyboard.keyPress(KEYS.T);
    const fontPickerTrigger = queryByTestId("font-family-show-fonts");
    expect(fontPickerTrigger).not.toBeNull();
    await act(async () => {
      fontPickerTrigger!.click();
    });

    await waitFor(() => {
      expect(queryByText("Existing Google Font")).not.toBeNull();
    });
    expect(loadCatalog).not.toHaveBeenCalled();
    expect(queryByText("Premium Font")).toBeNull();

    fetchMock.mockRestore();
    consoleError.mockRestore();
  });
});
