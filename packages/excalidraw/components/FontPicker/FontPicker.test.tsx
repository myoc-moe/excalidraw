import { KEYS, toGoogleFontFamily } from "@excalidraw/common";
import { vi } from "vitest";

import { Excalidraw, convertToExcalidrawElements } from "../../index";

import { Keyboard } from "../../tests/helpers/ui";
import { act, fireEvent, render, waitFor } from "../../tests/test-utils";

import type { GoogleFontsConfig } from "../../types";

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

  const sceneElements = (...families: string[]) =>
    convertToExcalidrawElements(
      families.map((family, index) => ({
        type: "text",
        text: `Text ${index}`,
        x: 0,
        y: index * 50,
        fontFamily: toGoogleFontFamily(family),
      })) as any,
    );

  const openPicker = async (
    googleFonts?: Partial<GoogleFontsConfig>,
    elements: ReturnType<typeof sceneElements> = [],
  ) => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("offline"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await render(
      <Excalidraw
        compressImageFile={async (file) => file}
        handleKeyboardGlobally={true}
        initialData={{ elements }}
        googleFonts={
          googleFonts && {
            libraryFonts: [],
            canApplyGoogleFonts: true,
            addToLibrary: "unavailable",
            ...googleFonts,
          }
        }
      />,
    );

    Keyboard.keyPress(KEYS.T);
    const trigger = result.queryByTestId("font-family-show-fonts");
    expect(trigger).not.toBeNull();
    await act(async () => {
      trigger!.click();
    });

    return { ...result, fetchMock };
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the host upgrade action", async () => {
    const { queryByText } = await openPicker({
      upgradeAction: <button type="button">Upgrade for more fonts</button>,
    });

    expect(queryByText("Upgrade for more fonts")).not.toBeNull();
  });

  it("orders sections and keeps the host order of My fonts", async () => {
    const { container } = await openPicker(
      {
        libraryFonts: [
          { family: "Zebra Sans", weights: [400], enabled: true },
          { family: "Apple Serif", weights: [400], enabled: true },
        ],
      },
      sceneElements("Scene Font"),
    );

    await waitFor(() => {
      expect(
        Array.from(
          container.querySelectorAll(".dropdown-menu-group-title"),
        ).map((el) => el.textContent),
      ).toEqual(["In this scene", "My fonts", "Built-in"]);
    });

    const labels = Array.from(
      container.querySelectorAll("[data-testid^='font-picker-item-']"),
    ).map((el) => el.getAttribute("data-testid"));
    expect(labels.indexOf("font-picker-item-google:Scene Font")).toBe(0);
    expect(labels.indexOf("font-picker-item-google:Zebra Sans")).toBe(1);
    expect(labels.indexOf("font-picker-item-google:Apple Serif")).toBe(2);
  });

  it("does not allow selecting disabled library fonts", async () => {
    const { queryByTestId } = await openPicker({
      libraryFonts: [
        { family: "Locked Font", weights: [400], enabled: false },
        { family: "Open Font", weights: [400], enabled: true },
      ],
    });

    expect(
      (
        queryByTestId(
          "font-picker-item-google:Locked Font",
        ) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (queryByTestId("font-picker-item-google:Open Font") as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it("labels weighted scene fonts by family and weight with distinct test ids", async () => {
    const { queryByTestId, queryByText } = await openPicker(
      {
        libraryFonts: [{ family: "Montserrat", weights: [400], enabled: true }],
      },
      sceneElements("Montserrat@700"),
    );

    expect(
      queryByTestId("font-picker-item-google:Montserrat@700"),
    ).not.toBeNull();
    expect(queryByTestId("font-picker-item-google:Montserrat")).not.toBeNull();
    expect(queryByText("Montserrat 700")).not.toBeNull();
    expect(queryByText("Montserrat@700")).toBeNull();
  });

  it("shows the Add button for a scene font missing from the library", async () => {
    const onAddToLibrary = vi.fn();
    const { queryByTestId } = await openPicker(
      { addToLibrary: "available", onAddToLibrary },
      sceneElements("Scene Font"),
    );

    const add = queryByTestId("font-picker-add-google:Scene Font");
    expect(add).not.toBeNull();
    expect(add!.getAttribute("data-locked")).toBeNull();
    fireEvent.click(add!);
    expect(onAddToLibrary).toHaveBeenCalledWith("Scene Font");
  });

  it("shows a locked Add button that still calls onAddToLibrary", async () => {
    const onAddToLibrary = vi.fn();
    const { queryByTestId } = await openPicker(
      { addToLibrary: "locked", onAddToLibrary },
      sceneElements("Scene Font"),
    );

    const add = queryByTestId("font-picker-add-google:Scene Font");
    expect(add!.getAttribute("data-locked")).toBe("true");
    fireEvent.click(add!);
    expect(onAddToLibrary).toHaveBeenCalledWith("Scene Font");
  });

  it("hides the Add button when adding is unavailable or the font is in the library", async () => {
    const unavailable = await openPicker(
      { addToLibrary: "unavailable" },
      sceneElements("Scene Font"),
    );
    expect(
      unavailable.queryByTestId("font-picker-add-google:Scene Font"),
    ).toBeNull();
    unavailable.unmount();

    const inLibrary = await openPicker(
      {
        addToLibrary: "available",
        libraryFonts: [{ family: "Scene Font", weights: [400], enabled: true }],
      },
      sceneElements("Scene Font"),
    );
    expect(
      inLibrary.queryByTestId("font-picker-add-google:Scene Font"),
    ).toBeNull();
  });

  it("calls onBrowse from the Browse row and shows the empty prompt", async () => {
    const onBrowse = vi.fn();
    const { queryByTestId, queryByText } = await openPicker({ onBrowse });

    expect(queryByText(/font library is empty/i)).not.toBeNull();
    fireEvent.click(queryByTestId("font-picker-browse")!);
    expect(onBrowse).toHaveBeenCalledTimes(1);
  });

  it("does not show the empty prompt when the library has fonts", async () => {
    const { queryByText, queryByTestId } = await openPicker({
      onBrowse: () => {},
      libraryFonts: [{ family: "Open Font", weights: [400], enabled: true }],
    });

    expect(queryByTestId("font-picker-browse")).not.toBeNull();
    expect(queryByText(/font library is empty/i)).toBeNull();
  });

  it("does not let plans that cannot apply Google fonts select a scene Google font", async () => {
    const { queryByTestId } = await openPicker(
      { addToLibrary: "locked", canApplyGoogleFonts: false },
      sceneElements("Existing Google Font"),
    );
    const before = window.h.state.currentItemFontFamily;

    const item = queryByTestId(
      "font-picker-item-google:Existing Google Font",
    ) as HTMLButtonElement;
    expect(item).not.toBeNull();
    expect(item.disabled).toBe(true);
    fireEvent.click(item);
    expect(window.h.state.currentItemFontFamily).toBe(before);
  });

  it("lets plans that can apply Google fonts select a scene font outside the library", async () => {
    const { queryByTestId } = await openPicker(
      { addToLibrary: "available", canApplyGoogleFonts: true },
      sceneElements("Existing Google Font"),
    );

    const item = queryByTestId(
      "font-picker-item-google:Existing Google Font",
    ) as HTMLButtonElement;
    expect(item.disabled).toBe(false);
    fireEvent.click(item);
    expect(window.h.state.currentItemFontFamily).toBe(
      toGoogleFontFamily("Existing Google Font"),
    );
  });

  it("skips disabled entries with ArrowDown and Enter", async () => {
    const { container, queryByTestId } = await openPicker(
      {
        libraryFonts: [
          { family: "Disabled Font", weights: [400], enabled: false },
          { family: "Enabled Font", weights: [400], enabled: true },
        ],
      },
      sceneElements("Scene Font"),
    );

    const popover = container.querySelector(".properties-content")!;
    // start on the scene font; the next selectable entry is "Enabled Font"
    fireEvent.mouseMove(queryByTestId("font-picker-item-google:Scene Font")!);
    fireEvent.keyDown(popover, { key: KEYS.ARROW_DOWN });
    fireEvent.keyDown(popover, { key: KEYS.ENTER });

    expect(window.h.state.currentItemFontFamily).not.toBe(
      toGoogleFontFamily("Disabled Font"),
    );
    expect(window.h.state.currentItemFontFamily).toBe(
      toGoogleFontFamily("Enabled Font"),
    );
  });
});
