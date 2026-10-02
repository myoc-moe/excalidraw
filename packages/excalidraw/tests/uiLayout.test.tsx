import React from "react";

import { resolvablePromise } from "@excalidraw/common";
import {
  CaptureUpdateAction,
  convertToExcalidrawElements,
} from "@excalidraw/element";

import { DefaultSidebar, Excalidraw, Footer } from "../index";
import { getUIFormFactorLayout } from "../components/UIRegionLayout";

import { act, render } from "./test-utils";

import type {
  Collaborator,
  ExcalidrawImperativeAPI,
  ExcalidrawUILayout,
  SocketId,
} from "../types";

const renderEditor = async (
  formFactor: "desktop" | "tablet" | "phone",
  uiLayout?: ExcalidrawUILayout,
  children?: React.ReactNode,
) => {
  const apiPromise = resolvablePromise<ExcalidrawImperativeAPI>();
  const rendered = await render(
    <Excalidraw
      UIOptions={{ getFormFactor: () => formFactor }}
      uiLayout={uiLayout}
      onExcalidrawAPI={(api) => api && apiPromise.resolve(api)}
    >
      {children}
    </Excalidraw>,
  );
  act(() => {
    window.h.app.refreshEditorInterface();
    window.h.app.refresh();
  });
  return { ...rendered, api: await apiPromise };
};

describe("responsive UI layout", () => {
  it("MyOC regression: resolves each form factor from its own layout", () => {
    const layout: ExcalidrawUILayout = {
      desktop: { items: { toolbar: { region: "middleLeft" } } },
      tablet: { items: { toolbar: { region: "topRight" } } },
      mobile: { items: { toolbar: { visible: false } } },
    };

    expect(
      getUIFormFactorLayout(layout, {
        formFactor: "desktop",
      }),
    ).toBe(layout.desktop);
    expect(
      getUIFormFactorLayout(layout, {
        formFactor: "tablet",
      }),
    ).toBe(layout.tablet);
    expect(
      getUIFormFactorLayout(layout, {
        formFactor: "phone",
      }),
    ).toBe(layout.mobile);
  });

  it("MyOC regression: pads and caps the mobile toolbar and sizes canvas actions consistently", async () => {
    const { container } = await renderEditor("phone");
    const toolbarIsland = container.querySelector<HTMLElement>(".App-toolbar");
    const mobileBottomLeft = container.querySelector<HTMLElement>(
      '[data-ui-layout-region="bottomLeft"]',
    );
    const mobileCanvasActionIslands = container.querySelectorAll<HTMLElement>(
      ".mobile-canvas-actions",
    );

    expect(toolbarIsland).toHaveStyle({ maxWidth: "450px" });
    expect(toolbarIsland?.style.getPropertyValue("--padding")).toBe("1");
    expect(mobileBottomLeft).toHaveStyle({ alignItems: "center" });
    expect(mobileCanvasActionIslands).toHaveLength(1);
    expect(
      mobileCanvasActionIslands[0].querySelector(".view-mode-button"),
    ).not.toBeNull();
    expect(
      mobileCanvasActionIslands[0].querySelector(".smart-zoom-button"),
    ).not.toBeNull();
    mobileCanvasActionIslands.forEach((island) => {
      expect(island.style.getPropertyValue("--padding")).toBe("0");
    });
  });

  it("MyOC regression: renders all eight custom regions with their resolved orientation", async () => {
    const regions = [
      "topLeft",
      "topCenter",
      "topRight",
      "middleLeft",
      "middleRight",
      "bottomLeft",
      "bottomCenter",
      "bottomRight",
    ] as const;
    const { container, api } = await renderEditor("desktop", {
      desktop: {
        customItems: regions.map((region) => ({
          id: `host-${region}`,
          region,
          render: ({
            region: resolvedRegion,
            orientation,
            api: resolvedAPI,
          }) => (
            <span
              data-testid={`custom-${region}`}
              data-region={resolvedRegion}
              data-orientation={orientation}
              data-api-id={resolvedAPI.id}
            />
          ),
        })),
      },
    });

    for (const region of regions) {
      const item = container.querySelector(`[data-testid="custom-${region}"]`);
      expect(item?.parentElement?.parentElement).toHaveAttribute(
        "data-ui-layout-region",
        region,
      );
      expect(item).toHaveAttribute("data-region", region);
      expect(item).toHaveAttribute(
        "data-orientation",
        region.startsWith("middle") ? "vertical" : "horizontal",
      );
      expect(item).toHaveAttribute("data-api-id", api.id);
    }
  });

  it("MyOC regression: gives top and bottom regions independent row containers", async () => {
    const { container } = await renderEditor("desktop", {
      desktop: {
        customItems: [
          {
            id: "top-center",
            region: "topCenter",
            render: () => <span data-testid="top-center-content" />,
          },
          {
            id: "bottom-center",
            region: "bottomCenter",
            render: () => <span data-testid="bottom-center-content" />,
          },
        ],
      },
    });

    const topRow = container.querySelector(".ui-layout__row--top");
    const bottomRow = container.querySelector(".ui-layout__row--bottom");

    expect(topRow).not.toBe(bottomRow);
    expect(topRow).toContainElement(
      container.querySelector('[data-testid="top-center-content"]'),
    );
    expect(bottomRow).toContainElement(
      container.querySelector('[data-testid="bottom-center-content"]'),
    );
  });

  it("MyOC regression: updates placements immediately without remounting the canvas", async () => {
    const initialLayout: ExcalidrawUILayout = {
      desktop: { items: { toolbar: { region: "middleLeft" } } },
      mobile: { items: { toolbar: { visible: false } } },
    };
    const { container, rerender } = await renderEditor(
      "desktop",
      initialLayout,
    );
    const canvas = container.querySelector("canvas.static");
    expect(
      container
        .querySelector('[data-ui-layout-item="toolbar"]')
        ?.parentElement?.getAttribute("data-ui-layout-region"),
    ).toBe("middleLeft");

    rerender(
      <Excalidraw
        UIOptions={{ getFormFactor: () => "desktop" }}
        uiLayout={{
          desktop: { items: { toolbar: { region: "bottomRight" } } },
          mobile: { items: { toolbar: { visible: false } } },
        }}
      />,
    );

    expect(
      container
        .querySelector('[data-ui-layout-item="toolbar"]')
        ?.parentElement?.getAttribute("data-ui-layout-region"),
    ).toBe("bottomRight");
    expect(container.querySelector("canvas.static")).toBe(canvas);

    rerender(<Excalidraw UIOptions={{ getFormFactor: () => "desktop" }} />);
    expect(
      container
        .querySelector('[data-ui-layout-item="toolbar"]')
        ?.parentElement?.getAttribute("data-ui-layout-region"),
    ).toBe("topCenter");
    expect(container.querySelector("canvas.static")).toBe(canvas);
  });

  it("MyOC regression: keeps form-factor settings separate and restores defaults when omitted", async () => {
    const { container } = await renderEditor("tablet", {
      desktop: { items: { toolbar: { region: "middleLeft" } } },
    });

    expect(
      container
        .querySelector('[data-ui-layout-item="toolbar"]')
        ?.parentElement?.getAttribute("data-ui-layout-region"),
    ).toBe("topCenter");
  });

  it("MyOC regression: orders custom items around the tunneled Footer outlet", async () => {
    const customItem = {
      id: "host-footer-action",
      region: "bottomCenter" as const,
      render: () => <button data-testid="host-footer-action" />,
    };
    const { container, rerender } = await renderEditor(
      "desktop",
      { desktop: { customItems: [customItem] } },
      <Footer>
        <button data-testid="legacy-footer-action" />
      </Footer>,
    );

    const bottomCenter = container.querySelector(
      '[data-ui-layout-region="bottomCenter"]',
    )!;
    expect(
      bottomCenter.querySelector('[data-ui-layout-item="legacyFooterCenter"]')
        ?.nextElementSibling,
    ).toHaveAttribute("data-ui-layout-item", "custom:host-footer-action");

    rerender(
      <Excalidraw
        UIOptions={{ getFormFactor: () => "desktop" }}
        uiLayout={{
          desktop: {
            customItems: [{ ...customItem, order: 0 }],
          },
        }}
      >
        <Footer>
          <button data-testid="legacy-footer-action" />
        </Footer>
      </Excalidraw>,
    );
    expect(
      bottomCenter.querySelector(
        '[data-ui-layout-item="custom:host-footer-action"]',
      )?.nextElementSibling,
    ).toHaveAttribute("data-ui-layout-item", "legacyFooterCenter");
  });

  it("MyOC regression: honors independent built-in visibility and placement", async () => {
    const { container } = await renderEditor("desktop", {
      desktop: {
        items: {
          mainMenu: { region: "middleRight" },
          sidebarTrigger: { visible: false },
          toolbar: { region: "bottomCenter", orientation: "horizontal" },
          undo: { visible: false },
          redo: { visible: false },
          smartZoom: { visible: false },
          viewMode: { region: "topRight" },
          zoom: { visible: false },
          penMode: { visible: false },
          help: { visible: false },
        },
        customItems: [
          {
            id: "hidden-custom",
            region: "topRight",
            visible: false,
            render: () => <span data-testid="hidden-custom" />,
          },
        ],
      },
    });

    expect(
      container
        .querySelector('[data-ui-layout-item="mainMenu"]')
        ?.parentElement?.getAttribute("data-ui-layout-region"),
    ).toBe("middleRight");
    const toolbar = container.querySelector('[data-ui-layout-item="toolbar"]');
    expect(toolbar?.parentElement).toHaveAttribute(
      "data-ui-layout-region",
      "bottomCenter",
    );
    expect(toolbar).toHaveAttribute("data-ui-orientation", "horizontal");
    for (const item of [
      "sidebarTrigger",
      "undo",
      "redo",
      "smartZoom",
      "zoom",
      "penMode",
      "help",
    ]) {
      expect(
        container.querySelector(`[data-ui-layout-item="${item}"]`),
      ).toBeNull();
    }
    expect(container.querySelector('[data-testid="hidden-custom"]')).toBeNull();
    expect(container.querySelector(".main-menu-trigger")).not.toBeNull();
    expect(
      container
        .querySelector('[data-ui-layout-item="viewMode"]')
        ?.closest("[data-ui-layout-region]")
        ?.getAttribute("data-ui-layout-region"),
    ).toBe("topRight");
  });

  it("MyOC regression: hiding the main menu keeps the desktop sidebar trigger independently available", async () => {
    const { container } = await renderEditor(
      "desktop",
      {
        desktop: { items: { mainMenu: { visible: false } } },
      },
      <DefaultSidebar.Trigger />,
    );

    expect(container.querySelector(".main-menu-trigger")).toBeNull();
    expect(container.querySelector(".default-sidebar-trigger")).not.toBeNull();
    expect(
      container
        .querySelector('[data-ui-layout-item="sidebarTrigger"]')
        ?.parentElement?.getAttribute("data-ui-layout-region"),
    ).toBe("topLeft");
  });

  it("MyOC regression: moves phone undo once and keeps its command available when hidden", async () => {
    const { container, api, rerender } = await renderEditor("phone", {
      mobile: { items: { undo: { region: "topLeft" } } },
    });

    const [element] = convertToExcalidrawElements([
      { type: "rectangle", x: 10, y: 10, width: 100, height: 80 },
    ]);
    act(() => {
      api.updateScene({
        elements: [element],
        appState: { selectedElementIds: { [element.id]: true } },
      });
    });

    expect(
      container.querySelectorAll('[data-testid="button-undo"]'),
    ).toHaveLength(1);
    expect(
      container.querySelectorAll('[data-testid="button-redo"]'),
    ).toHaveLength(1);
    expect(
      container
        .querySelector('[data-ui-layout-item="undo"]')
        ?.parentElement?.getAttribute("data-ui-layout-region"),
    ).toBe("topLeft");

    rerender(
      <Excalidraw
        UIOptions={{ getFormFactor: () => "phone" }}
        uiLayout={{
          mobile: {
            items: {
              undo: { region: "topLeft" },
              redo: { region: "topRight" },
            },
          },
        }}
      />,
    );
    expect(
      container.querySelectorAll('[data-testid="button-undo"]'),
    ).toHaveLength(1);
    expect(
      container.querySelectorAll('[data-testid="button-redo"]'),
    ).toHaveLength(1);
    expect(
      container
        .querySelector('[data-ui-layout-item="redo"]')
        ?.parentElement?.getAttribute("data-ui-layout-region"),
    ).toBe("topRight");
    let commandAvailable = false;
    act(() => {
      commandAvailable = api.executeCommand("action:undo");
    });
    expect(commandAvailable).toBe(true);

    rerender(
      <Excalidraw
        UIOptions={{ getFormFactor: () => "phone" }}
        uiLayout={{ mobile: { items: { undo: { visible: false } } } }}
      />,
    );

    act(() => undefined);
    expect(
      container.querySelectorAll('[data-testid="button-undo"]'),
    ).toHaveLength(0);
    act(() => {
      commandAvailable = api.executeCommand("action:undo");
    });
    expect(commandAvailable).toBe(true);
  });

  it("MyOC regression: preserves external history and zoom commands when their controls are hidden", async () => {
    const { api, container } = await renderEditor("desktop", {
      desktop: {
        items: {
          undo: { visible: false },
          redo: { visible: false },
          zoom: { visible: false },
        },
      },
    });
    const elements = convertToExcalidrawElements([
      { type: "rectangle", x: 10, y: 10, width: 100, height: 80 },
    ]);
    act(() => {
      api.updateScene({
        elements,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    });
    expect(api.getSceneElements()).toHaveLength(1);
    expect(container.querySelector('[data-ui-layout-item="undo"]')).toBeNull();
    expect(container.querySelector('[data-ui-layout-item="redo"]')).toBeNull();
    expect(container.querySelector('[data-ui-layout-item="zoom"]')).toBeNull();

    let commandAvailable = false;
    act(() => {
      commandAvailable = api.executeCommand("action:undo");
    });
    expect(commandAvailable).toBe(true);
    expect(api.getSceneElements()).toHaveLength(0);
    act(() => {
      commandAvailable = api.executeCommand("action:redo");
    });
    expect(commandAvailable).toBe(true);
    expect(api.getSceneElements()).toHaveLength(1);

    const initialZoom = api.getAppState().zoom.value;
    act(() => {
      commandAvailable = api.executeCommand("action:zoomIn");
    });
    expect(commandAvailable).toBe(true);
    expect(api.getAppState().zoom.value).toBeGreaterThan(initialZoom);
  });

  it("MyOC regression: keeps host custom content available when default UI is disabled", async () => {
    const apiPromise = resolvablePromise<ExcalidrawImperativeAPI>();
    const { container } = await render(
      <Excalidraw
        ui={false}
        UIOptions={{ getFormFactor: () => "desktop" }}
        uiLayout={{
          desktop: {
            customItems: [
              {
                id: "host-ui-disabled-content",
                region: "middleLeft",
                render: ({ api }) => (
                  <button data-testid="host-ui-disabled-content">
                    {api.id}
                  </button>
                ),
              },
            ],
          },
        }}
        onExcalidrawAPI={(api) => api && apiPromise.resolve(api)}
      />,
    );
    const api = await apiPromise;

    expect(
      container.querySelector('[data-testid="host-ui-disabled-content"]'),
    ).toHaveTextContent(api.id);
    expect(
      container.querySelector('[data-ui-layout-item="toolbar"]'),
    ).toBeNull();
  });

  it("MyOC regression: preserves Full and Compact styles panels inside the configured region", async () => {
    const { container, api } = await renderEditor("desktop", {
      desktop: { items: { stylesPanel: { region: "bottomRight" } } },
    });
    const [element] = convertToExcalidrawElements([
      { type: "rectangle", x: 10, y: 10, width: 100, height: 80 },
    ]);
    act(() => {
      api.updateScene({
        elements: [element],
        appState: { selectedElementIds: { [element.id]: true } },
      });
    });
    expect(
      container
        .querySelector('[data-ui-layout-item="stylesPanel"]')
        ?.parentElement?.getAttribute("data-ui-layout-region"),
    ).toBe("bottomRight");
    expect(
      container.querySelector(
        '[data-ui-layout-item="stylesPanel"] .selected-shape-actions-container--compact',
      ),
    ).toBeNull();

    act(() => api.setDesktopUIMode("compact"));
    expect(
      container.querySelector(
        '[data-ui-layout-item="stylesPanel"] .selected-shape-actions-container--compact',
      ),
    ).not.toBeNull();
    act(() => api.setDesktopUIMode("full"));
    expect(
      container.querySelector(
        '[data-ui-layout-item="stylesPanel"] .selected-shape-actions-container--compact',
      ),
    ).toBeNull();
  });

  it("MyOC regression: places selected-shape properties in middleLeft by default", async () => {
    const { container, api } = await renderEditor("desktop");
    const [element] = convertToExcalidrawElements([
      { type: "rectangle", x: 10, y: 10, width: 100, height: 80 },
    ]);
    act(() => {
      api.updateScene({
        elements: [element],
        appState: { selectedElementIds: { [element.id]: true } },
      });
    });

    expect(
      container
        .querySelector('[data-ui-layout-item="stylesPanel"]')
        ?.parentElement?.getAttribute("data-ui-layout-region"),
    ).toBe("middleLeft");
  });

  it("MyOC regression: places and hides the styles, collaborator, and stats groups", async () => {
    const { container, api } = await renderEditor("desktop", {
      desktop: {
        items: {
          stylesPanel: { visible: false },
          collaborators: { region: "middleRight" },
          stats: { region: "bottomRight" },
        },
      },
    });
    const socketId = "host-user" as SocketId;
    const collaborator: Collaborator = {
      id: socketId,
      socketId,
      username: "Host user",
    };
    const [element] = convertToExcalidrawElements([
      { type: "rectangle", x: 10, y: 10, width: 100, height: 80 },
    ]);
    act(() => {
      api.updateScene({
        elements: [element],
        collaborators: new Map([[socketId, collaborator]]),
        appState: {
          selectedElementIds: { [element.id]: true },
          stats: { open: true, panels: 0 },
        },
      });
    });

    expect(
      container.querySelector('[data-ui-layout-item="stylesPanel"]'),
    ).toBeNull();
    expect(
      container
        .querySelector('[data-ui-layout-item="collaborators"]')
        ?.parentElement?.getAttribute("data-ui-layout-region"),
    ).toBe("middleRight");
    expect(
      container.querySelector(
        '[data-ui-layout-item="collaborators"] .UserList__wrapper',
      ),
    ).not.toBeNull();
    expect(
      container
        .querySelector('[data-ui-layout-item="stats"]')
        ?.parentElement?.getAttribute("data-ui-layout-region"),
    ).toBe("bottomRight");
    expect(
      container.querySelector('[data-ui-layout-item="stats"] .exc-stats'),
    ).not.toBeNull();
  });

  it("MyOC regression: viewModeOnly cannot reveal a prohibited view-mode toggle", async () => {
    const { container } = await render(
      <Excalidraw
        viewModeOnly
        UIOptions={{ getFormFactor: () => "desktop" }}
        uiLayout={{
          desktop: {
            items: { viewMode: { region: "topRight", visible: true } },
          },
        }}
      />,
    );

    expect(
      container.querySelector('[data-ui-layout-item="viewMode"]'),
    ).toBeNull();
  });
});
