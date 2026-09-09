import { vi } from "vitest";

import { applyZoomAndViewpointFlip } from "./viewpoint";

describe("MyOC regression: viewpoint canvas transform", () => {
  it("applies both reflections around the viewport center after zoom", () => {
    const context = {
      scale: vi.fn(),
      translate: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    applyZoomAndViewpointFlip(context, {
      width: 800,
      height: 600,
      zoom: { value: 2 as any },
      viewpointFlip: { horizontal: true, vertical: true },
    });

    expect(context.scale).toHaveBeenNthCalledWith(1, 2, 2);
    expect(context.translate).toHaveBeenNthCalledWith(1, 400, 0);
    expect(context.translate).toHaveBeenNthCalledWith(2, 0, 300);
    expect(context.scale).toHaveBeenNthCalledWith(2, -1, -1);
  });
});
