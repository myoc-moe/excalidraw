import React from "react";
import type { AppClassProperties, AppProps, AppState, Device, ExcalidrawProps, UIAppState } from "../types";
import type { ActionManager } from "../actions/manager";
import type { NonDeletedExcalidrawElement } from "../element/types";
type MobileMenuProps = {
    appState: UIAppState;
    actionManager: ActionManager;
    renderJSONExportDialog: () => React.ReactNode;
    renderImageExportDialog: () => React.ReactNode;
    setAppState: React.Component<any, AppState>["setState"];
    elements: readonly NonDeletedExcalidrawElement[];
    onLockToggle: () => void;
    onHandToolToggle: () => void;
    onPenModeToggle: AppClassProperties["togglePenMode"];
    renderTopRightUI?: (isMobile: boolean, appState: UIAppState) => JSX.Element | null;
    renderCustomStats?: ExcalidrawProps["renderCustomStats"];
    renderSidebars: () => JSX.Element | null;
    device: Device;
    renderWelcomeScreen: boolean;
    UIOptions: AppProps["UIOptions"];
    app: AppClassProperties;
};
export declare const MobileMenu: ({ appState, elements, actionManager, setAppState, onLockToggle, onHandToolToggle, onPenModeToggle, renderTopRightUI, renderCustomStats, renderSidebars, device, renderWelcomeScreen, UIOptions, app, }: MobileMenuProps) => JSX.Element;
export {};