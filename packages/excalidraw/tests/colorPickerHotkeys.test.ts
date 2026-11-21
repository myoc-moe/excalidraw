import { COLOR_PALETTE } from "@excalidraw/common";

import type { ColorPaletteCustom } from "@excalidraw/common";

import { colorPickerKeyNavHandler } from "../components/ColorPicker/keyboardNavHandlers";

const handlerArgs = (
  key: string,
  palette: ColorPaletteCustom,
  onChange: (color: string) => void,
  excludedColors?: readonly string[],
  eventInit: Partial<
    Record<"code" | "ctrlKey" | "altKey" | "shiftKey", string | boolean>
  > = {},
) => ({
  event: {
    key,
    code: "",
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    ...eventInit,
    preventDefault: () => {},
    stopPropagation: () => {},
  } as unknown as React.KeyboardEvent,
  activeColorPickerSection: null,
  palette,
  color: null,
  onChange,
  customColors: [],
  setActiveColorPickerSection: () => {},
  updateData: () => {},
  activeShade: 1,
  onEyeDropperToggle: () => {},
  onEscape: () => {},
  excludedColors,
});

describe("color picker hotkeys", () => {
  it("reports an excluded (hidden) entry's hotkey as handled without selecting it", () => {
    // regression: returning "unhandled" let the key escape the modal and hit
    // global shortcuts (`q` toggles the tool lock; see the integration
    // regression in bucketFill.test.tsx)
    const onChange = vi.fn();
    const palette = {
      transparent: COLOR_PALETTE.transparent,
      red: "#ff0000",
    } as ColorPaletteCustom;

    const handled = colorPickerKeyNavHandler(
      handlerArgs("q", palette, onChange, [COLOR_PALETTE.transparent]),
    );

    expect(handled).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("reports a hotkey past the end of a short custom palette as handled", () => {
    // a host-provided palette with fewer entries than hotkey bindings must
    // not leak the unbound keys either
    const onChange = vi.fn();
    const palette = { red: "#ff0000" } as ColorPaletteCustom;

    // `b` is the 15th binding — far past the single palette entry
    const handled = colorPickerKeyNavHandler(
      handlerArgs("b", palette, onChange),
    );

    expect(handled).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("still selects a present, non-excluded entry", () => {
    const onChange = vi.fn();
    const palette = {
      transparent: COLOR_PALETTE.transparent,
      red: "#ff0000",
    } as ColorPaletteCustom;

    const handled = colorPickerKeyNavHandler(
      handlerArgs("w", palette, onChange, [COLOR_PALETTE.transparent]),
    );

    expect(handled).toBe(true);
    expect(onChange).toHaveBeenCalledWith("#ff0000");
  });

  it("toggles the eye dropper on Shift+S", () => {
    const onChange = vi.fn();
    const onEyeDropperToggle = vi.fn();
    const palette = { red: "#ff0000" } as ColorPaletteCustom;

    const handled = colorPickerKeyNavHandler({
      ...handlerArgs("S", palette, onChange, undefined, {
        code: "KeyS",
        shiftKey: true,
      }),
      onEyeDropperToggle,
    });

    expect(handled).toBe(true);
    expect(onEyeDropperToggle).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps a palette hotkey that is also the user eye dropper key", () => {
    const onChange = vi.fn();
    const onEyeDropperToggle = vi.fn();
    const palette = {
      transparent: COLOR_PALETTE.transparent,
      red: "#ff0000",
    } as ColorPaletteCustom;

    const handled = colorPickerKeyNavHandler({
      ...handlerArgs("w", palette, onChange, undefined, { code: "KeyW" }),
      onEyeDropperToggle,
      keymap: { "editor:eyeDropperStroke": ["W"] },
    });

    expect(handled).toBe(true);
    expect(onChange).toHaveBeenCalledWith("#ff0000");
    expect(onEyeDropperToggle).not.toHaveBeenCalled();
  });

  it("toggles the eye dropper on a user key with Ctrl", () => {
    const onChange = vi.fn();
    const onEyeDropperToggle = vi.fn();
    const palette = { red: "#ff0000" } as ColorPaletteCustom;

    const handled = colorPickerKeyNavHandler({
      ...handlerArgs("j", palette, onChange, undefined, {
        code: "KeyJ",
        ctrlKey: true,
      }),
      onEyeDropperToggle,
      keymap: { "editor:eyeDropperStroke": ["Mod+J"] },
    });

    expect(handled).toBe(true);
    expect(onEyeDropperToggle).toHaveBeenCalledTimes(1);
  });
});
