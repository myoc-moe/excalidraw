import { createElement as _createElement } from "react";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import clsx from "clsx";
import { CANVAS_SEARCH_TAB, DEFAULT_SIDEBAR, LIBRARY_SIDEBAR_TAB, } from "../constants";
import { useTunnels } from "../context/tunnels";
import { useUIAppState } from "../context/ui-appState";
import { composeEventHandlers } from "../utils";
import { useExcalidrawSetAppState } from "./App";
import { withInternalFallback } from "./hoc/withInternalFallback";
import { LibraryMenu } from "./LibraryMenu";
import { Sidebar } from "./Sidebar/Sidebar";
import "../components/dropdownMenu/DropdownMenu.scss";
import { SearchMenu } from "./SearchMenu";
import { LibraryIcon, searchIcon } from "./icons";
const DefaultSidebarTrigger = withInternalFallback("DefaultSidebarTrigger", (props) => {
    const { DefaultSidebarTriggerTunnel } = useTunnels();
    return (_jsx(DefaultSidebarTriggerTunnel.In, { children: _jsx(Sidebar.Trigger, { ...props, className: "default-sidebar-trigger", name: DEFAULT_SIDEBAR.name }) }));
});
DefaultSidebarTrigger.displayName = "DefaultSidebarTrigger";
const DefaultTabTriggers = ({ children }) => {
    const { DefaultSidebarTabTriggersTunnel } = useTunnels();
    return (_jsx(DefaultSidebarTabTriggersTunnel.In, { children: children }));
};
DefaultTabTriggers.displayName = "DefaultTabTriggers";
export const DefaultSidebar = Object.assign(withInternalFallback("DefaultSidebar", ({ children, className, onDock, docked, ...rest }) => {
    const appState = useUIAppState();
    const setAppState = useExcalidrawSetAppState();
    const { DefaultSidebarTabTriggersTunnel } = useTunnels();
    const isForceDocked = appState.openSidebar?.tab === CANVAS_SEARCH_TAB;
    return (_createElement(Sidebar, { ...rest, name: "default", key: "default", className: clsx("default-sidebar", className), docked: isForceDocked || (docked ?? appState.defaultSidebarDockedPreference), onDock: 
        // `onDock=false` disables docking.
        // if `docked` passed, but no onDock passed, disable manual docking.
        isForceDocked || onDock === false || (!onDock && docked != null)
            ? undefined
            : // compose to allow the host app to listen on default behavior
                composeEventHandlers(onDock, (docked) => {
                    setAppState({ defaultSidebarDockedPreference: docked });
                }) },
        _jsxs(Sidebar.Tabs, { children: [_jsx(Sidebar.Header, { children: _jsxs(Sidebar.TabTriggers, { children: [_jsx(Sidebar.TabTrigger, { tab: CANVAS_SEARCH_TAB, children: searchIcon }), _jsx(Sidebar.TabTrigger, { tab: LIBRARY_SIDEBAR_TAB, children: LibraryIcon }), _jsx(DefaultSidebarTabTriggersTunnel.Out, {})] }) }), _jsx(Sidebar.Tab, { tab: LIBRARY_SIDEBAR_TAB, children: _jsx(LibraryMenu, {}) }), _jsx(Sidebar.Tab, { tab: CANVAS_SEARCH_TAB, children: _jsx(SearchMenu, {}) }), children] })));
}), {
    Trigger: DefaultSidebarTrigger,
    TabTriggers: DefaultTabTriggers,
});
