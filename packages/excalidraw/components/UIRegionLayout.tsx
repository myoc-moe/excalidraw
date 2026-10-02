import React from "react";

import type { EditorInterface } from "@excalidraw/common";

import { Island } from "./Island";

import "./UIRegionLayout.scss";

import type {
  ExcalidrawImperativeAPI,
  ExcalidrawUIFormFactorLayout,
  ExcalidrawUIItem,
  ExcalidrawUIItemLayout,
  ExcalidrawUIOrientation,
  ExcalidrawUIRegion,
  UIAppState,
} from "../types";

export type UIRegionLayoutItem = {
  id: ExcalidrawUIItem;
  content: React.ReactNode;
  defaultRegion: ExcalidrawUIRegion;
  defaultOrder?: number;
  defaultOrientation?: ExcalidrawUIOrientation;
  islandGroup?: {
    id: string;
    className: string;
    padding: number;
    gap: number;
  };
};

type ResolvedUIRegionLayoutItem = {
  id: string;
  region: ExcalidrawUIRegion;
  orientation: Exclude<ExcalidrawUIOrientation, "auto">;
  order: number;
  content: React.ReactNode;
  islandGroup?: UIRegionLayoutItem["islandGroup"];
};

const REGIONS: readonly ExcalidrawUIRegion[] = [
  "topLeft",
  "topCenter",
  "topRight",
  "middleLeft",
  "middleRight",
  "bottomLeft",
  "bottomCenter",
  "bottomRight",
];

const getAutoOrientation = (
  region: ExcalidrawUIRegion,
): Exclude<ExcalidrawUIOrientation, "auto"> =>
  region.startsWith("middle") ? "vertical" : "horizontal";

const getViewportDock = (
  region: ExcalidrawUIRegion,
): "top" | "bottom" | "side" => {
  if (region.startsWith("middle")) {
    return "side";
  }
  return region.startsWith("top") ? "top" : "bottom";
};

export const UIRegionLayout = ({
  items,
  layout,
  app,
  appState,
  editorInterface,
  className,
  legacyBottomCenter,
  legacyBottomLeft,
}: {
  items: readonly UIRegionLayoutItem[];
  layout?: ExcalidrawUIFormFactorLayout;
  app: { api: ExcalidrawImperativeAPI };
  appState: UIAppState;
  editorInterface: EditorInterface;
  className?: string;
  legacyBottomCenter?: React.ReactNode;
  legacyBottomLeft?: React.ReactNode;
}) => {
  const byRegion = new Map<ExcalidrawUIRegion, React.ReactNode[]>();
  REGIONS.forEach((region) => byRegion.set(region, []));

  const configuredItems: ResolvedUIRegionLayoutItem[] = items.flatMap(
    (item, index) => {
      const config: ExcalidrawUIItemLayout = layout?.items?.[item.id] ?? {};
      if (config.visible === false || item.content == null) {
        return [];
      }
      const region = config.region ?? item.defaultRegion;
      const orientation =
        config.orientation && config.orientation !== "auto"
          ? config.orientation
          : item.defaultOrientation && item.defaultOrientation !== "auto"
          ? item.defaultOrientation
          : getAutoOrientation(region);

      return [
        {
          id: item.id,
          region,
          orientation,
          order: config.order ?? item.defaultOrder ?? index,
          content: item.content,
          islandGroup: item.islandGroup,
        },
      ];
    },
  );

  const customItems: ResolvedUIRegionLayoutItem[] = (
    layout?.customItems ?? []
  ).flatMap((item, index) => {
    if (item.visible === false) {
      return [];
    }
    const region = item.region;
    const orientation =
      item.orientation && item.orientation !== "auto"
        ? item.orientation
        : getAutoOrientation(region);
    return [
      {
        id: `custom:${item.id}`,
        region,
        orientation,
        order: item.order ?? 1000 + index,
        content: item.render({
          api: app.api,
          appState,
          editorInterface,
          region,
          orientation,
        }),
      },
    ];
  });

  const legacyItems: ResolvedUIRegionLayoutItem[] =
    legacyBottomCenter == null
      ? []
      : [
          {
            id: "legacyFooterCenter",
            region: "bottomCenter" as const,
            orientation: "horizontal" as const,
            order: 999,
            content: legacyBottomCenter,
          },
        ];

  const orderedItems = [
    ...configuredItems,
    ...customItems,
    ...legacyItems,
  ].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

  const renderItem = (item: ResolvedUIRegionLayoutItem) => (
    <div
      className="ui-layout__item"
      data-ui-layout-item={item.id}
      data-ui-orientation={item.orientation}
      data-viewport-ui={getViewportDock(item.region)}
      data-viewport-ui-name={
        item.id === "stylesPanel" ? "stylesPanel" : undefined
      }
      key={item.id}
    >
      {item.content}
    </div>
  );

  REGIONS.forEach((region) => {
    const regionItems = orderedItems.filter((item) => item.region === region);
    const target = byRegion.get(region);

    for (let index = 0; index < regionItems.length; ) {
      const item = regionItems[index];
      const group = item.islandGroup;

      if (!group) {
        target?.push(renderItem(item));
        index++;
        continue;
      }

      const groupedItems = [item];
      let nextIndex = index + 1;
      while (nextIndex < regionItems.length) {
        const nextItem = regionItems[nextIndex];
        if (
          nextItem.islandGroup?.id !== group.id ||
          nextItem.orientation !== item.orientation
        ) {
          break;
        }
        groupedItems.push(nextItem);
        nextIndex++;
      }

      target?.push(
        <Island
          className={`ui-layout__island-group ${group.className}`}
          padding={group.padding}
          data-viewport-ui={getViewportDock(region)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: `${group.gap}px`,
          }}
          key={`island-group:${group.id}:${region}:${item.id}`}
        >
          {groupedItems.map(renderItem)}
        </Island>,
      );
      index = nextIndex;
    }
  });

  if (legacyBottomLeft != null) {
    byRegion.get("bottomLeft")?.unshift(
      <div className="ui-layout__legacy-bottom-left" key="legacy-bottom-left">
        {legacyBottomLeft}
      </div>,
    );
  }

  const renderRegion = (region: ExcalidrawUIRegion) => (
    <div
      className={`ui-layout__region ui-layout__region--${region}`}
      data-ui-layout-region={region}
      style={
        editorInterface.formFactor === "phone" && region === "bottomLeft"
          ? { alignItems: "center" }
          : undefined
      }
      key={region}
    >
      {byRegion.get(region)}
    </div>
  );

  return (
    <div className={className ? `ui-layout ${className}` : "ui-layout"}>
      <div className="ui-layout__row ui-layout__row--top">
        {renderRegion("topLeft")}
        {renderRegion("topCenter")}
        {renderRegion("topRight")}
      </div>
      <div className="ui-layout__row ui-layout__row--middle">
        {renderRegion("middleLeft")}
        {renderRegion("middleRight")}
      </div>
      <div className="ui-layout__row ui-layout__row--bottom">
        {renderRegion("bottomLeft")}
        {renderRegion("bottomCenter")}
        {renderRegion("bottomRight")}
      </div>
    </div>
  );
};

export const getUIFormFactorLayout = (
  layout:
    | {
        desktop?: ExcalidrawUIFormFactorLayout;
        tablet?: ExcalidrawUIFormFactorLayout;
        mobile?: ExcalidrawUIFormFactorLayout;
      }
    | undefined,
  editorInterface: Pick<EditorInterface, "formFactor">,
) =>
  editorInterface.formFactor === "phone"
    ? layout?.mobile
    : editorInterface.formFactor === "tablet"
    ? layout?.tablet
    : layout?.desktop;
