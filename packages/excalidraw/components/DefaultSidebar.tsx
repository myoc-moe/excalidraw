import clsx from "clsx";

import { CANVAS_SEARCH_TAB, DEFAULT_SIDEBAR } from "@excalidraw/common";

import type { MarkOptional, Merge } from "@excalidraw/common/utility-types";

import { useTunnels } from "../context/tunnels";
import { useUIAppState } from "../context/ui-appState";

import "../components/dropdownMenu/DropdownMenu.scss";

import { useExcalidrawSetAppState } from "./App";

import { SearchMenu } from "./SearchMenu";
import { Sidebar } from "./Sidebar/Sidebar";
import { withInternalFallback } from "./hoc/withInternalFallback";

import type { SidebarProps, SidebarTriggerProps } from "./Sidebar/common";

const DefaultSidebarTrigger = withInternalFallback(
  "DefaultSidebarTrigger",
  (
    props: Omit<SidebarTriggerProps, "name"> &
      React.HTMLAttributes<HTMLDivElement>,
  ) => {
    const { DefaultSidebarTriggerTunnel } = useTunnels();
    return (
      <DefaultSidebarTriggerTunnel.In>
        <Sidebar.Trigger
          {...props}
          className="default-sidebar-trigger"
          name={DEFAULT_SIDEBAR.name}
        />
      </DefaultSidebarTriggerTunnel.In>
    );
  },
);
DefaultSidebarTrigger.displayName = "DefaultSidebarTrigger";

const DefaultTabTriggers = ({ children }: { children: React.ReactNode }) => {
  const { DefaultSidebarTabTriggersTunnel } = useTunnels();
  return (
    <DefaultSidebarTabTriggersTunnel.In>
      {children}
    </DefaultSidebarTabTriggersTunnel.In>
  );
};
DefaultTabTriggers.displayName = "DefaultTabTriggers";

export const DefaultSidebar = Object.assign(
  withInternalFallback(
    "DefaultSidebar",
    ({
      children,
      className,
      docked,
      onDock,
      ...rest
    }: Merge<
      MarkOptional<Omit<SidebarProps, "name">, "children">,
      {
        /** pass `false` to disable docking */
        onDock?: SidebarProps["onDock"] | false;
      }
    >) => {
      const appState = useUIAppState();
      const setAppState = useExcalidrawSetAppState();

      const isSearchSidebar = appState.openSidebar?.tab === CANVAS_SEARCH_TAB;
      const isDocked = isSearchSidebar
        ? false
        : docked ?? appState.defaultSidebarDockedPreference;
      const canDock = !isSearchSidebar && docked == null && onDock !== false;

      return (
        <Sidebar
          {...rest}
          name="default"
          key="default"
          className={clsx(
            "default-sidebar",
            { "default-sidebar--search-only": isSearchSidebar },
            className,
          )}
          docked={isDocked}
          onDock={
            canDock
              ? (nextDocked) => {
                  setAppState({
                    defaultSidebarDockedPreference: nextDocked,
                  });
                  onDock?.(nextDocked);
                }
              : undefined
          }
        >
          <Sidebar.Tabs>
            {!isSearchSidebar && <Sidebar.Header />}
            <Sidebar.Tab tab={CANVAS_SEARCH_TAB}>
              <SearchMenu />
            </Sidebar.Tab>
            {!isSearchSidebar && children}
          </Sidebar.Tabs>
        </Sidebar>
      );
    },
  ),
  {
    Trigger: DefaultSidebarTrigger,
    TabTriggers: DefaultTabTriggers,
  },
);
