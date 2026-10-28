import { FONT_FAMILY, toGoogleFontFamily } from "@excalidraw/common";
import { vi } from "vitest";

import { Excalidraw, convertToExcalidrawElements } from "../../index";

import { API } from "../../tests/helpers/api";
import { Keyboard } from "../../tests/helpers/ui";
import { act, fireEvent, render, waitFor } from "../../tests/test-utils";

import type { GoogleFontsConfig } from "../../types";

type TextSpec = { text: string; fontFamily: string | number };

describe("FontWeightPicker", () => {
  beforeAll(() => {
    (global as any).ResizeObserver =
      (global as any).ResizeObserver ||
      class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** Opens the compact toolbar's text properties (Tt) popover. */
  const openTextProperties = async () => {
    const trigger = document.querySelector<HTMLButtonElement>(
      'button.properties-trigger[title="Text align"]',
    );
    expect(trigger).not.toBeNull();
    await act(async () => {
      trigger!.click();
    });
  };

  const renderWithSelection = async (
    texts: TextSpec[],
    googleFonts: Partial<GoogleFontsConfig> | undefined,
    options: {
      formFactor?: "phone" | "tablet" | "desktop";
      select?: boolean;
    } = {},
  ) => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const elements = convertToExcalidrawElements(
      texts.map(({ text, fontFamily }, index) => ({
        type: "text",
        text,
        x: 0,
        y: index * 50,
        fontFamily,
      })) as any,
    );

    const result = await render(
      <Excalidraw
        compressImageFile={async (file) => file}
        handleKeyboardGlobally={true}
        initialData={{ elements }}
        UIOptions={
          options.formFactor
            ? { getFormFactor: () => options.formFactor! }
            : undefined
        }
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

    if (options.formFactor) {
      act(() => {
        window.h.app.refreshEditorInterface();
        window.h.app.refresh();
      });
    }

    if (options.select !== false) {
      act(() => {
        API.setSelectedElements(window.h.elements as any);
      });
    }

    return result;
  };

  const google = (id: string) => toGoogleFontFamily(id) as unknown as string;

  it("is hidden for built-in fonts", async () => {
    const { queryByTestId } = await renderWithSelection(
      [{ text: "a", fontFamily: FONT_FAMILY.Excalifont }],
      {
        libraryFonts: [{ family: "Lato", weights: [400, 700], enabled: true }],
      },
    );

    expect(queryByTestId("font-family-show-fonts")).not.toBeNull();
    expect(queryByTestId("font-weight-picker")).toBeNull();
  });

  it("is hidden for single-weight and non-library fonts", async () => {
    const single = await renderWithSelection(
      [{ text: "a", fontFamily: google("Lato") }],
      {
        libraryFonts: [{ family: "Lato", weights: [400], enabled: true }],
      },
    );
    expect(single.queryByTestId("font-family-show-fonts")).not.toBeNull();
    expect(single.queryByTestId("font-weight-picker")).toBeNull();
    single.unmount();

    const missing = await renderWithSelection(
      [{ text: "a", fontFamily: google("Other") }],
      {
        libraryFonts: [{ family: "Lato", weights: [400, 700], enabled: true }],
      },
    );
    expect(missing.queryByTestId("font-family-show-fonts")).not.toBeNull();
    expect(missing.queryByTestId("font-weight-picker")).toBeNull();
  });

  it("is hidden when Google fonts can't be applied or the font is disabled", async () => {
    const blocked = await renderWithSelection(
      [{ text: "a", fontFamily: google("Lato") }],
      {
        canApplyGoogleFonts: false,
        libraryFonts: [{ family: "Lato", weights: [400, 700], enabled: true }],
      },
    );
    expect(blocked.queryByTestId("font-family-show-fonts")).not.toBeNull();
    expect(blocked.queryByTestId("font-weight-picker")).toBeNull();
    blocked.unmount();

    const disabled = await renderWithSelection(
      [{ text: "a", fontFamily: google("Lato") }],
      {
        libraryFonts: [{ family: "Lato", weights: [400, 700], enabled: false }],
      },
    );
    expect(disabled.queryByTestId("font-family-show-fonts")).not.toBeNull();
    expect(disabled.queryByTestId("font-weight-picker")).toBeNull();
  });

  it("lists only the added weights, in order", async () => {
    const { container, queryByTestId } = await renderWithSelection(
      [{ text: "a", fontFamily: google("Lato@700") }],
      {
        libraryFonts: [
          { family: "Lato", weights: [900, 400, 700], enabled: true },
        ],
      },
    );

    await waitFor(() => {
      expect(queryByTestId("font-weight-picker")).not.toBeNull();
    });
    expect(
      Array.from(
        container.querySelectorAll(
          "[data-testid^='font-weight-4'], [data-testid^='font-weight-7'], [data-testid^='font-weight-9']",
        ),
      ).map((el) => el.textContent),
    ).toEqual(["Regular", "Bold", "Black"]);
    expect(queryByTestId("font-weight-300")).toBeNull();
    expect(queryByTestId("font-weight-700")!.getAttribute("aria-pressed")).toBe(
      "true",
    );
  });

  it("applies to all selected text and is undoable", async () => {
    const { queryByTestId } = await renderWithSelection(
      [
        { text: "a", fontFamily: google("Lato") },
        { text: "b", fontFamily: google("Lato@300") },
      ],
      {
        libraryFonts: [
          { family: "Lato", weights: [300, 400, 700], enabled: true },
        ],
      },
    );

    // mixed weights: row shown, no active weight
    expect(queryByTestId("font-weight-picker")).not.toBeNull();
    expect(queryByTestId("font-weight-400")!.getAttribute("aria-pressed")).toBe(
      "false",
    );

    fireEvent.click(queryByTestId("font-weight-700")!);

    await waitFor(() => {
      expect(window.h.elements.map((el: any) => el.fontFamily)).toEqual([
        google("Lato@700"),
        google("Lato@700"),
      ]);
    });

    Keyboard.undo();

    await waitFor(() => {
      expect(window.h.elements.map((el: any) => el.fontFamily)).toEqual([
        google("Lato"),
        google("Lato@300"),
      ]);
    });
  });

  it("keeps the weight on family switch if the new family has it, else Regular", async () => {
    const { queryByTestId } = await renderWithSelection(
      [{ text: "a", fontFamily: google("Lato@700") }],
      {
        libraryFonts: [
          { family: "Lato", weights: [400, 700], enabled: true },
          { family: "Roboto", weights: [400, 700], enabled: true },
          { family: "Poppins", weights: [400, 500], enabled: true },
        ],
      },
    );

    const pick = async (family: string) => {
      await act(async () => {
        queryByTestId("font-family-show-fonts")!.click();
      });
      await waitFor(() => {
        expect(
          queryByTestId(`font-picker-item-google:${family}`),
        ).not.toBeNull();
      });
      fireEvent.click(queryByTestId(`font-picker-item-google:${family}`)!);
    };

    await pick("Roboto");
    await waitFor(() => {
      expect((window.h.elements[0] as any).fontFamily).toBe(
        google("Roboto@700"),
      );
    });

    await pick("Poppins");
    await waitFor(() => {
      expect((window.h.elements[0] as any).fontFamily).toBe(google("Poppins"));
    });
  });

  it("calls onEditWeights from More weights…", async () => {
    const onEditWeights = vi.fn();
    const { queryByTestId } = await renderWithSelection(
      [{ text: "a", fontFamily: google("Lato") }],
      {
        libraryFonts: [{ family: "Lato", weights: [400, 700], enabled: true }],
        onEditWeights,
      },
    );

    fireEvent.click(queryByTestId("font-weight-more")!);
    expect(onEditWeights).toHaveBeenCalledWith("Lato");
  });

  it("keeps arrow keys from nudging the selection", async () => {
    const { queryByTestId } = await renderWithSelection(
      [{ text: "a", fontFamily: google("Lato") }],
      {
        libraryFonts: [{ family: "Lato", weights: [400, 700], enabled: true }],
      },
    );
    const before = window.h.elements[0].x;
    const button = queryByTestId("font-weight-700")!;
    button.focus();
    fireEvent.keyDown(button, { key: "ArrowRight" });
    expect(window.h.elements[0].x).toBe(before);
  });

  it("keeps arrow keys from nudging in the compact Weight section", async () => {
    const { queryByTestId } = await renderWithSelection(
      [{ text: "a", fontFamily: google("Lato") }],
      {
        libraryFonts: [{ family: "Lato", weights: [400, 700], enabled: true }],
      },
      { formFactor: "tablet" },
    );
    await openTextProperties();
    await waitFor(() => {
      expect(queryByTestId("font-weight-700")).not.toBeNull();
    });
    const before = window.h.elements[0].x;
    const item = queryByTestId("font-weight-700")!;
    item.focus();
    fireEvent.keyDown(item, { key: "ArrowRight" });
    expect(window.h.elements[0].x).toBe(before);
  });

  it("uses the current item font when nothing is selected", async () => {
    const { queryByTestId } = await renderWithSelection(
      [{ text: "a", fontFamily: FONT_FAMILY.Excalifont }],
      {
        libraryFonts: [{ family: "Lato", weights: [400, 700], enabled: true }],
      },
      { select: false },
    );

    expect(queryByTestId("font-weight-picker")).toBeNull();

    // choosing the text tool shows the panel for the current item
    act(() => {
      window.h.setState({
        currentItemFontFamily: google("Lato@700") as any,
      });
    });
    Keyboard.keyPress("t");

    await waitFor(() => {
      expect(queryByTestId("font-weight-picker")).not.toBeNull();
    });
    expect(queryByTestId("font-weight-700")!.getAttribute("aria-pressed")).toBe(
      "true",
    );

    fireEvent.click(queryByTestId("font-weight-400")!);
    await waitFor(() => {
      expect(window.h.state.currentItemFontFamily).toBe(google("Lato"));
    });
  });

  it("shows weights as numbers in the compact text properties", async () => {
    const { queryByTestId, queryAllByTestId } = await renderWithSelection(
      [{ text: "a", fontFamily: google("Lato@700") }],
      {
        libraryFonts: [{ family: "Lato", weights: [400, 700], enabled: true }],
        onEditWeights: vi.fn(),
      },
      { formFactor: "tablet" },
    );

    // no weight control beside the font family in the compact toolbar
    expect(queryByTestId("font-weight-picker")).toBeNull();

    await openTextProperties();
    await waitFor(() => {
      expect(queryAllByTestId("font-weight-picker")).toHaveLength(1);
    });
    // the same radio buttons as the font size section
    const bold = queryByTestId("font-weight-700") as HTMLInputElement;
    expect(bold.type).toBe("radio");
    expect(bold.checked).toBe(true);
    expect(bold.parentElement!.classList.contains("active")).toBe(true);
    expect(bold.parentElement!.getAttribute("title")).toBe("Bold");
    expect(queryByTestId("font-weight-400")!.parentElement!.textContent).toBe(
      "400",
    );

    fireEvent.click(queryByTestId("font-weight-400")!);
    await waitFor(() => {
      expect((window.h.elements[0] as any).fontFamily).toBe(google("Lato"));
    });

    // the compact section has no "More weights…" link
    expect(queryByTestId("font-weight-more")).toBeNull();
  });
});
