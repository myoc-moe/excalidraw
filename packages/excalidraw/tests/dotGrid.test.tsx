import { vi } from "vitest";

import { THEME } from "@excalidraw/common";
import { newElement } from "@excalidraw/element";

import type { NonDeletedSceneElementsMap } from "@excalidraw/element/types";

import * as staticSceneModule from "../renderer/staticScene";
import { getDefaultAppState } from "../appState";
import { exportToCanvas } from "../scene/export";
import { Excalidraw } from "../index";

import { render, waitFor } from "./test-utils";

import type { StaticCanvasAppState, ViewpointFlip } from "../types";
import type {
  RenderableElementsMap,
  StaticCanvasRenderConfig,
} from "../scene/types";

// the App-level test reads the render config that the App passes
vi.mock("../renderer/staticScene", async (importOriginal) => {
  const actual = await importOriginal<typeof staticSceneModule>();
  return { ...actual, renderStaticScene: vi.fn(actual.renderStaticScene) };
});

const { clampDotGridStrength, renderStaticScene } = staticSceneModule;

// MyOC: the canvas dot grid of the static scene. The tests use a mock
// context. The dots are one `CanvasPattern` that fills the viewport once.

/** the canvas size in css px: it does not change with the zoom */
const WIDTH = 240;
const HEIGHT = 120;

const render2d = (
  opts: {
    zoom?: number;
    scale?: number;
    scrollX?: number;
    scrollY?: number;
    viewpointFlip?: ViewpointFlip;
  } & Partial<StaticCanvasRenderConfig> = {},
) => {
  const scale = opts.scale ?? 1;
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH * scale;
  canvas.height = HEIGHT * scale;
  const context = canvas.getContext("2d")!;
  const createPattern = vi.spyOn(context, "createPattern");
  const fillRect = vi.spyOn(context, "fillRect");
  const arc = vi.spyOn(context, "arc");
  const transforms: DOMMatrix2DInit[] = [];
  const alphas: number[] = [];
  const fillStyles: unknown[] = [];
  // the flip and the zoom are on the context when the dots are drawn
  const rectTransforms: DOMMatrix[] = [];
  fillRect.mockImplementation(() => {
    rectTransforms.push(context.getTransform());
    fillStyles.push(context.fillStyle);
    alphas.push(context.globalAlpha);
  });
  createPattern.mockImplementation((...args) => {
    const pattern = CanvasRenderingContext2D.prototype.createPattern.apply(
      context,
      args as never,
    )!;
    const setTransform = pattern.setTransform.bind(pattern);
    pattern.setTransform = (matrix?: DOMMatrix2DInit) => {
      transforms.push(matrix!);
      setTransform(matrix);
    };
    return pattern;
  });

  const {
    zoom,
    scale: _scale,
    scrollX,
    scrollY,
    viewpointFlip,
    ...renderConfigOverrides
  } = opts;
  renderStaticScene({
    canvas,
    rc: {} as any,
    scale,
    elementsMap: new Map() as unknown as RenderableElementsMap,
    allElementsMap: new Map() as unknown as NonDeletedSceneElementsMap,
    visibleElements: [],
    appState: {
      zoom: { value: zoom ?? 1 },
      scrollX: scrollX ?? 0,
      scrollY: scrollY ?? 0,
      gridSize: 20,
      gridStep: 5,
      theme: THEME.LIGHT,
      viewBackgroundColor: "#ffffff",
      shouldCacheIgnoreZoom: false,
      viewpointFlip: viewpointFlip ?? { horizontal: false, vertical: false },
      frameRendering: { enabled: true, outline: true, name: true, clip: true },
      selectedElementIds: {},
      hoveredElementIds: {},
      width: WIDTH,
      height: HEIGHT,
    } as unknown as StaticCanvasAppState,
    renderConfig: {
      canvasBackgroundColor: "#ffffff",
      imageCache: new Map(),
      renderGrid: false,
      isExporting: false,
      embedsValidationStatus: new Map(),
      elementsPendingErasure: new Set(),
      pendingFlowchartNodes: null,
      theme: THEME.LIGHT,
      ...renderConfigOverrides,
    } as StaticCanvasRenderConfig,
  });

  /** the fills of the dots (the background fill is `fillRect` too, but the
   * dots are the ones with a pattern) */
  const dotFills = fillRect.mock.calls.filter(
    (_, i) => typeof fillStyles[i] === "object",
  );
  return {
    createPattern,
    fillRect,
    arc,
    transforms,
    alphas,
    rectTransforms,
    dotFills,
  };
};

describe("canvas dot grid", () => {
  it("draws the dots when enabled and the line grid is off", () => {
    const { createPattern, dotFills } = render2d({ renderDotGrid: true });
    expect(createPattern).toHaveBeenCalledTimes(1);
    expect(dotFills).toHaveLength(1);
  });

  it("draws no dots by default", () => {
    expect(render2d().createPattern).not.toHaveBeenCalled();
  });

  it("draws no dots while the line grid shows", () => {
    expect(
      render2d({ renderDotGrid: true, renderGrid: true }).createPattern,
    ).not.toHaveBeenCalled();
  });

  it("draws no dots when the dot grid is off", () => {
    expect(
      render2d({ renderDotGrid: false }).createPattern,
    ).not.toHaveBeenCalled();
  });

  it("draws no dots when exporting, even with the dot grid on", () => {
    expect(
      render2d({ renderDotGrid: true, isExporting: true }).createPattern,
    ).not.toHaveBeenCalled();
  });

  it("draws no dots in the default config of exportToCanvas", async () => {
    const createPattern = vi.spyOn(
      CanvasRenderingContext2D.prototype,
      "createPattern",
    );
    const canvas = await exportToCanvas(
      [newElement({ type: "rectangle", x: 0, y: 0, width: 100, height: 100 })],
      {
        ...getDefaultAppState(),
        width: 800,
        height: 600,
        offsetTop: 0,
        offsetLeft: 0,
        exportScale: 1,
      },
      {},
      { exportBackground: true, viewBackgroundColor: "#ffffff" },
    );
    expect(canvas.width).toBeGreaterThan(0);
    expect(createPattern).not.toHaveBeenCalled();
    createPattern.mockRestore();
  });

  it("draws no dots when 12 x zoom is below 6", () => {
    expect(
      render2d({ renderDotGrid: true, zoom: 0.49 }).createPattern,
    ).not.toHaveBeenCalled();
    expect(
      render2d({ renderDotGrid: true, zoom: 0.5 }).createPattern,
    ).toHaveBeenCalledTimes(1);
  });

  it("does not draw one arc for each dot", () => {
    // the one dot is in the tile: the scene context gets no arc
    expect(render2d({ renderDotGrid: true }).arc).not.toHaveBeenCalled();
  });

  it("fills the viewport in zoomed units at zoom 1 and 2", () => {
    // the canvas is 240x120 at every zoom: the viewport in zoomed units is
    // 240x120 at zoom 1 and 120x60 at zoom 2
    for (const zoom of [1, 2]) {
      const { dotFills, rectTransforms } = render2d({
        renderDotGrid: true,
        zoom,
      });
      expect(dotFills).toHaveLength(1);
      expect(dotFills[0]).toEqual([0, 0, WIDTH / zoom, HEIGHT / zoom]);
      // the context is scaled by zoom
      expect(rectTransforms[rectTransforms.length - 1].a).toBe(zoom);
    }
  });

  it("scales the tile to 12 scene units, also at a fractional device scale", () => {
    // 12 x 1.5 x 1.25 = 22.5 device px: the tile has 23 px, and the matrix
    // scales it back to 12 units
    const { transforms } = render2d({
      renderDotGrid: true,
      zoom: 1.5,
      scale: 1.25,
    });
    expect(transforms).toHaveLength(1);
    expect(transforms[0].a).toBeCloseTo(12 / 23);
    expect(transforms[0].d).toBeCloseTo(12 / 23);
  });

  it("aligns the dots to scene 0,0 and moves them with the scroll", () => {
    // the dot is at the center of the tile (6 units)
    const [none] = render2d({ renderDotGrid: true }).transforms;
    expect([none.e, none.f]).toEqual([-6, -6]);
    const [moved] = render2d({
      renderDotGrid: true,
      scrollX: 5,
      scrollY: 7,
    }).transforms;
    expect([moved.e, moved.f]).toEqual([-1, 1]);
    // 30 % 12 = 6: one period gives the same dots
    const [period] = render2d({
      renderDotGrid: true,
      scrollX: 24,
      scrollY: 36,
    }).transforms;
    expect([period.e, period.f]).toEqual([-6, -6]);
  });

  it("keeps the alignment for a negative scroll", () => {
    // -5 % 12 is -5 in JS: the dots are at -5 + 12 k units (7 mod 12), and
    // the tile origin is 6 units before the dot
    const [{ e, f }] = render2d({
      renderDotGrid: true,
      scrollX: -5,
      scrollY: -7,
    }).transforms;
    expect([e, f]).toEqual([-11, -13]);
    expect((e! + 6 + 12 * 10) % 12).toBe(7);
    expect((f! + 6 + 12 * 10) % 12).toBe(5);
  });

  it("draws the dots in the flipped coordinates of the viewport", () => {
    const flip = { horizontal: true, vertical: false };
    const { dotFills, rectTransforms } = render2d({
      renderDotGrid: true,
      viewpointFlip: flip,
    });
    expect(dotFills).toHaveLength(1);
    expect(dotFills[0]).toEqual([0, 0, WIDTH, HEIGHT]);
    // the flip mirrors x and keeps y
    const matrix = rectTransforms[rectTransforms.length - 1];
    expect(matrix.a).toBe(-1);
    expect(matrix.d).toBe(1);
    expect(matrix.e).toBe(WIDTH);
  });

  it("draws the dots with the strength as the alpha", () => {
    expect(
      render2d({ renderDotGrid: true, dotGridStrength: 0.8 }).alphas,
    ).toContain(0.8);
    expect(render2d({ renderDotGrid: true }).alphas).toContain(0.5);
  });

  it("clamps the strength to 0.1-1", () => {
    expect(clampDotGridStrength(0)).toBe(0.1);
    expect(clampDotGridStrength(-3)).toBe(0.1);
    expect(clampDotGridStrength(5)).toBe(1);
    expect(clampDotGridStrength(0.3)).toBe(0.3);
    expect(clampDotGridStrength(undefined)).toBe(0.5);
    expect(clampDotGridStrength(NaN)).toBe(0.5);
    expect(
      render2d({ renderDotGrid: true, dotGridStrength: 9 }).alphas,
    ).toContain(1);
    expect(
      render2d({ renderDotGrid: true, dotGridStrength: 0 }).alphas,
    ).toContain(0.1);
  });
});

describe("<Excalidraw dotGrid />", () => {
  const lastRenderConfig = () => {
    const calls = vi.mocked(renderStaticScene).mock.calls;
    return calls[calls.length - 1][0].renderConfig;
  };

  beforeEach(() => {
    vi.mocked(renderStaticScene).mockClear();
  });

  it("sets renderDotGrid on by default and with a strength", async () => {
    await render(<Excalidraw dotGrid={{ strength: 0.7 }} />);
    await waitFor(() => expect(renderStaticScene).toHaveBeenCalled());
    expect(lastRenderConfig().renderDotGrid).toBe(true);
    expect(lastRenderConfig().dotGridStrength).toBe(0.7);
  });

  it("sets renderDotGrid off for `enabled: false`", async () => {
    await render(<Excalidraw dotGrid={{ enabled: false }} />);
    await waitFor(() => expect(renderStaticScene).toHaveBeenCalled());
    expect(lastRenderConfig().renderDotGrid).toBe(false);
  });

  it("sets renderDotGrid off while the line grid shows", async () => {
    await render(<Excalidraw gridModeEnabled={true} />);
    await waitFor(() => expect(renderStaticScene).toHaveBeenCalled());
    expect(lastRenderConfig().renderGrid).toBe(true);
    expect(lastRenderConfig().renderDotGrid).toBe(false);
  });
});
