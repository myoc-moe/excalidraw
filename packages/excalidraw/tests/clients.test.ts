import { THEME, UserIdleState } from "@excalidraw/common";

import {
  getClientColor,
  getNameInitial,
  renderRemoteCursors,
} from "../clients";

import type { InteractiveCanvasRenderConfig } from "../scene/types";
import type {
  AppState,
  Collaborator,
  InteractiveCanvasAppState,
  SocketId,
} from "../types";

describe("getClientInitials", () => {
  it("returns substring if one name provided", () => {
    expect(getNameInitial("Alan")).toBe("A");
  });

  it("returns initials", () => {
    expect(getNameInitial("John Doe")).toBe("J");
  });

  it("returns correct initials if many names provided", () => {
    expect(getNameInitial("John Alan Doe")).toBe("J");
  });

  it("returns single initial if 1 letter provided", () => {
    expect(getNameInitial("z")).toBe("Z");
  });

  it("trims trailing whitespace", () => {
    expect(getNameInitial("  q    ")).toBe("Q");
  });

  it('returns "?" if falsey value provided', () => {
    expect(getNameInitial("")).toBe("?");
    expect(getNameInitial(undefined)).toBe("?");
    expect(getNameInitial(null)).toBe("?");
  });

  it('returns "?" when value is blank', () => {
    expect(getNameInitial(" ")).toBe("?");
  });

  it("works with multibyte strings", () => {
    expect(getNameInitial("😀")).toBe("😀");
    // but doesn't work with emoji ZWJ sequences
    expect(getNameInitial("👨‍👩‍👦")).toBe("👨");
  });
});

describe("renderRemoteCursors", () => {
  const SOCKET_ID = "socket-1" as SocketId;
  const POINTER = { x: 100, y: 100 };
  const CANVAS_SIZE = 1000;

  type DrawCall = {
    op: "fill" | "stroke" | "fillText";
    fillStyle: string;
    strokeStyle: string;
    lineWidth: number;
    globalAlpha: number;
    text?: string;
  };

  // A minimal 2D context that records the paint state at every fill, stroke
  // and fillText, so the tests can assert what color, width and alpha each
  // part of the cursor was drawn with.
  const createRecordingContext = () => {
    const calls: DrawCall[] = [];
    const stack: Array<Record<string, unknown>> = [];
    const context: Record<string, any> = {
      fillStyle: "#000000",
      strokeStyle: "#000000",
      lineWidth: 1,
      globalAlpha: 1,
      lineJoin: "miter",
      font: "",
      save: () => {
        stack.push({
          fillStyle: context.fillStyle,
          strokeStyle: context.strokeStyle,
          lineWidth: context.lineWidth,
          globalAlpha: context.globalAlpha,
        });
      },
      restore: () => Object.assign(context, stack.pop()),
      beginPath: () => {},
      closePath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      arc: () => {},
      roundRect: () => {},
      fillRect: () => {},
      measureText: (text: string) => ({
        width: text.length * 7,
        actualBoundingBoxAscent: 9,
        actualBoundingBoxDescent: 3,
      }),
    };
    const record = (op: DrawCall["op"], text?: string) => {
      calls.push({
        op,
        fillStyle: context.fillStyle,
        strokeStyle: context.strokeStyle,
        lineWidth: context.lineWidth,
        globalAlpha: context.globalAlpha,
        text,
      });
    };
    context.fill = () => record("fill");
    context.stroke = () => record("stroke");
    context.fillText = (text: string) => record("fillText", text);
    return { context: context as unknown as CanvasRenderingContext2D, calls };
  };

  const createArgs = (
    collaborators: Array<[SocketId, Partial<Collaborator>]>,
    {
      username = "Alice",
      userState = UserIdleState.ACTIVE,
      button = "up",
      pointer = POINTER,
      theme = THEME.LIGHT,
    }: {
      username?: string;
      userState?: UserIdleState;
      button?: string;
      pointer?: { x: number; y: number };
      theme?: AppState["theme"];
    } = {},
  ) => ({
    renderConfig: {
      remotePointerViewportCoords: new Map([[SOCKET_ID, pointer]]),
      remotePointerUserStates: new Map([[SOCKET_ID, userState]]),
      remotePointerUsernames: new Map([[SOCKET_ID, username]]),
      remotePointerButton: new Map([[SOCKET_ID, button]]),
    } as unknown as InteractiveCanvasRenderConfig,
    appState: {
      collaborators: new Map(collaborators),
      offsetLeft: 0,
      offsetTop: 0,
      theme,
    } as unknown as InteractiveCanvasAppState,
    normalizedWidth: CANVAS_SIZE,
    normalizedHeight: CANVAS_SIZE,
  });

  const render = (
    collaborator: Partial<Collaborator> | undefined,
    options?: Parameters<typeof createArgs>[1],
  ) => {
    const { context, calls } = createRecordingContext();
    renderRemoteCursors({
      context,
      ...createArgs(collaborator ? [[SOCKET_ID, collaborator]] : [], options),
    });
    const fills = calls.filter((call) => call.op === "fill");
    const strokes = calls.filter((call) => call.op === "stroke");
    return {
      calls,
      // The arrow outline pass is the only 5px-wide draw.
      outline: calls.filter((call) => call.lineWidth === 5),
      arrowFill: fills.find((call) => call.lineWidth !== 5),
      arrowStroke: strokes.find((call) => call.lineWidth !== 5),
      // The name label is drawn after the arrow.
      labelFill: fills.at(-1),
      labelStroke: strokes.at(-1),
      nameText: calls.find((call) => call.op === "fillText"),
    };
  };

  const setHostColors = (colors: Record<string, string>) => {
    for (const [name, value] of Object.entries(colors)) {
      document.documentElement.style.setProperty(name, value);
    }
  };

  afterEach(() => {
    document.documentElement.removeAttribute("style");
  });

  describe("collaborator without custom cursor fields", () => {
    it("fills the arrow with the generated color and outlines it in white", () => {
      const { arrowFill, outline, nameText } = render({ id: "u1" as any });

      expect(arrowFill!.fillStyle).toBe(
        getClientColor(SOCKET_ID, { id: "u1" } as Collaborator),
      );
      expect(arrowFill!.lineWidth).toBe(1.5);
      expect(arrowFill!.globalAlpha).toBe(1);
      expect(outline.length).toBeGreaterThan(0);
      expect(outline.every((call) => call.fillStyle === "#ffffff")).toBe(true);
      expect(nameText!.fillStyle).toBe("#1e1e1e");
    });

    it("draws the same without a collaborator entry at all", () => {
      const { arrowFill, outline, nameText } = render(undefined);

      expect(arrowFill!.fillStyle).toBe(getClientColor(SOCKET_ID, undefined));
      expect(outline.length).toBeGreaterThan(0);
      expect(nameText!.text).toBe("Alice");
    });

    it("uses the host surface, divider and text colors when set", () => {
      setHostColors({
        "--mui-palette-background-paper": "rgb(10, 20, 30)",
        "--mui-palette-divider": "rgb(40, 50, 60)",
        "--mui-palette-text-primary": "rgb(70, 80, 90)",
      });
      const { arrowFill, outline, nameText } = render({});

      expect(arrowFill!.fillStyle).toBe("rgb(10, 20, 30)");
      expect(
        outline.every((call) => call.fillStyle === "rgb(40, 50, 60)"),
      ).toBe(true);
      expect(nameText!.fillStyle).toBe("rgb(70, 80, 90)");
    });

    it("ignores cursorStyle, thickness and secondary color without a borderColor", () => {
      const { arrowFill, outline } = render({
        cursorStyle: "outlined",
        cursorThickness: 6,
        cursorSecondaryColor: "#00ff00",
      });

      expect(arrowFill!.fillStyle).toBe(getClientColor(SOCKET_ID, undefined));
      expect(arrowFill!.lineWidth).toBe(1.5);
      expect(outline.length).toBeGreaterThan(0);
    });
  });

  describe("collaborator with a borderColor", () => {
    it("draws a solid cursor and name label with no separate outline", () => {
      const { arrowFill, arrowStroke, outline, labelFill, nameText } = render({
        borderColor: "#ff0000",
      });

      expect(outline).toHaveLength(0);
      expect(arrowFill!.fillStyle).toBe("#ff0000");
      expect(arrowStroke!.strokeStyle).toBe("#ff0000");
      expect(labelFill!.fillStyle).toBe("#ff0000");
      // the name text is the secondary color, white by default
      expect(nameText!.fillStyle).toBe("#ffffff");
    });

    it("draws the name text in the host surface color when there is one", () => {
      setHostColors({ "--mui-palette-background-paper": "rgb(1, 2, 3)" });
      const { nameText } = render({ borderColor: "#ff0000" });

      expect(nameText!.fillStyle).toBe("rgb(1, 2, 3)");
    });

    it("uses cursorSecondaryColor for the name text", () => {
      const { nameText } = render({
        borderColor: "#ff0000",
        cursorSecondaryColor: "#00ff00",
      });

      expect(nameText!.fillStyle).toBe("#00ff00");
    });

    it("treats cursorStyle 'filled' like the default", () => {
      const filled = render({ borderColor: "#ff0000", cursorStyle: "filled" });
      const unset = render({ borderColor: "#ff0000" });

      expect(filled.calls).toEqual(unset.calls);
    });

    it("draws an outlined cursor as a secondary-colored shape with a solid-color outline", () => {
      const { arrowFill, arrowStroke, labelFill, nameText } = render({
        borderColor: "#ff0000",
        cursorStyle: "outlined",
        cursorSecondaryColor: "#eeeeee",
      });

      expect(arrowFill!.fillStyle).toBe("#eeeeee");
      expect(arrowStroke!.strokeStyle).toBe("#ff0000");
      expect(labelFill!.fillStyle).toBe("#eeeeee");
      expect(nameText!.fillStyle).toBe("#ff0000");
    });

    it("applies cursorThickness to the cursor and name label border", () => {
      const { arrowFill, arrowStroke, labelStroke } = render({
        borderColor: "#ff0000",
        cursorThickness: 4,
      });

      expect(arrowFill!.lineWidth).toBe(4);
      expect(arrowStroke!.lineWidth).toBe(4);
      expect(labelStroke!.lineWidth).toBe(4);
    });

    it("defaults cursorThickness to 1.5", () => {
      const { arrowStroke } = render({ borderColor: "#ff0000" });

      expect(arrowStroke!.lineWidth).toBe(1.5);
    });

    it("keeps a thickness of 0 instead of falling back to the default", () => {
      const { arrowStroke } = render({
        borderColor: "#ff0000",
        cursorThickness: 0,
      });

      expect(arrowStroke!.lineWidth).toBe(0);
    });
  });

  describe("cursorOpacity", () => {
    it("applies to the cursor and the name label", () => {
      const { calls } = render({ borderColor: "#ff0000", cursorOpacity: 0.5 });

      expect(calls.length).toBeGreaterThan(0);
      expect(calls.every((call) => call.globalAlpha === 0.5)).toBe(true);
    });

    it("keeps an opacity of 0 instead of falling back to the default", () => {
      const { calls } = render({ cursorOpacity: 0 });

      expect(calls.every((call) => call.globalAlpha === 0)).toBe(true);
    });

    it("is multiplied by the dimming of an idle collaborator", () => {
      const { arrowFill } = render(
        { cursorOpacity: 0.5 },
        { userState: UserIdleState.IDLE },
      );

      expect(arrowFill!.globalAlpha).toBeCloseTo(0.15);
    });

    it("is multiplied by the dimming of an out-of-bounds pointer", () => {
      const { arrowFill } = render(
        { cursorOpacity: 0.5 },
        { pointer: { x: -50, y: 100 } },
      );

      expect(arrowFill!.globalAlpha).toBeCloseTo(0.15);
    });

    it("does not leak into what is drawn on the context afterwards", () => {
      const { context } = createRecordingContext();
      renderRemoteCursors({
        context,
        ...createArgs([[SOCKET_ID, { cursorOpacity: 0.2 }]]),
      });

      expect(context.globalAlpha).toBe(1);
    });
  });

  describe("var(--name) colors", () => {
    it("resolves a borderColor from the host page", () => {
      setHostColors({ "--my-accent": "rgb(9, 8, 7)" });
      const { arrowFill, outline } = render({
        borderColor: "var(--my-accent)",
      });

      expect(arrowFill!.fillStyle).toBe("rgb(9, 8, 7)");
      expect(outline).toHaveLength(0);
    });

    it("resolves a cursorSecondaryColor from the host page", () => {
      setHostColors({ "--my-label": "rgb(5, 5, 5)" });
      const { nameText } = render({
        borderColor: "#ff0000",
        cursorSecondaryColor: "var(--my-label)",
      });

      expect(nameText!.fillStyle).toBe("rgb(5, 5, 5)");
    });

    it("falls back to the uncustomised look when the variable is not defined", () => {
      const { arrowFill, outline } = render({
        borderColor: "var(--does-not-exist)",
      });

      expect(arrowFill!.fillStyle).toBe(getClientColor(SOCKET_ID, undefined));
      expect(outline.length).toBeGreaterThan(0);
    });

    it("passes a plain color function through unchanged", () => {
      const { arrowFill } = render({ borderColor: "rgb(1, 2, 3)" });

      expect(arrowFill!.fillStyle).toBe("rgb(1, 2, 3)");
    });
  });

  describe("pressed pointer rings", () => {
    const rings = (calls: DrawCall[]) =>
      calls.filter((call) => call.op === "stroke").slice(0, 2);

    it("draws a faint white halo and a thin ring without a borderColor", () => {
      const { calls } = render({}, { button: "down" });
      const [halo, ring] = rings(calls);

      expect(halo).toMatchObject({ strokeStyle: "#ffffff88", lineWidth: 3 });
      expect(ring.lineWidth).toBe(1);
      expect(ring.strokeStyle).toBe(getClientColor(SOCKET_ID, undefined));
    });

    it("draws both rings in the borderColor, the halo at half alpha", () => {
      const { calls } = render(
        { borderColor: "#ff0000", cursorThickness: 3, cursorOpacity: 0.8 },
        { button: "down" },
      );
      const [halo, ring] = rings(calls);

      expect(halo).toMatchObject({ strokeStyle: "#ff0000", lineWidth: 3 });
      expect(halo.globalAlpha).toBeCloseTo(0.4);
      expect(ring).toMatchObject({ strokeStyle: "#ff0000", lineWidth: 3 });
      expect(ring.globalAlpha).toBeCloseTo(0.8);
    });

    it("draws no rings while the button is up", () => {
      const { calls } = render({ borderColor: "#ff0000" }, { button: "up" });

      // the first stroke is the cursor arrow, not a ring
      expect(calls.find((call) => call.op === "stroke")!.lineWidth).toBe(1.5);
      expect(calls.some((call) => call.strokeStyle === "#ffffff88")).toBe(
        false,
      );
    });
  });

  describe("name label", () => {
    it("is not drawn for an out-of-bounds pointer", () => {
      const { nameText } = render(
        { borderColor: "#ff0000" },
        { pointer: { x: CANVAS_SIZE + 50, y: 100 } },
      );

      expect(nameText).toBeUndefined();
    });

    it("is not drawn without a username", () => {
      const { nameText } = render({ borderColor: "#ff0000" }, { username: "" });

      expect(nameText).toBeUndefined();
    });
  });
});
