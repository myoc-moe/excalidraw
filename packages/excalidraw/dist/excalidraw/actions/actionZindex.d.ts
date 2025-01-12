/// <reference types="react" />
export declare const actionSendBackward: {
    name: "sendBackward";
    label: string;
    keywords: string[];
    icon: JSX.Element;
    trackEvent: {
        category: "element";
    };
    perform: (elements: readonly import("../element/types").OrderedExcalidrawElement[], appState: Readonly<import("../types").AppState>) => {
        elements: readonly import("../element/types").ExcalidrawElement[];
        appState: Readonly<import("../types").AppState>;
        storeAction: "capture";
    };
    keyPriority: number;
    keyTest: (event: KeyboardEvent | import("react").KeyboardEvent<Element>) => boolean;
    PanelComponent: ({ updateData, appState }: import("./types").PanelComponentProps) => JSX.Element;
} & {
    keyTest?: ((event: KeyboardEvent | import("react").KeyboardEvent<Element>) => boolean) | undefined;
};
export declare const actionBringForward: {
    name: "bringForward";
    label: string;
    keywords: string[];
    icon: JSX.Element;
    trackEvent: {
        category: "element";
    };
    perform: (elements: readonly import("../element/types").OrderedExcalidrawElement[], appState: Readonly<import("../types").AppState>) => {
        elements: readonly import("../element/types").ExcalidrawElement[];
        appState: Readonly<import("../types").AppState>;
        storeAction: "capture";
    };
    keyPriority: number;
    keyTest: (event: KeyboardEvent | import("react").KeyboardEvent<Element>) => boolean;
    PanelComponent: ({ updateData, appState }: import("./types").PanelComponentProps) => JSX.Element;
} & {
    keyTest?: ((event: KeyboardEvent | import("react").KeyboardEvent<Element>) => boolean) | undefined;
};
export declare const actionSendToBack: {
    name: "sendToBack";
    label: string;
    keywords: string[];
    icon: JSX.Element;
    trackEvent: {
        category: "element";
    };
    perform: (elements: readonly import("../element/types").OrderedExcalidrawElement[], appState: Readonly<import("../types").AppState>) => {
        elements: import("../element/types").ExcalidrawElement[] | readonly import("../element/types").ExcalidrawElement[];
        appState: Readonly<import("../types").AppState>;
        storeAction: "capture";
    };
    keyTest: (event: KeyboardEvent | import("react").KeyboardEvent<Element>) => boolean;
    PanelComponent: ({ updateData, appState }: import("./types").PanelComponentProps) => JSX.Element;
} & {
    keyTest?: ((event: KeyboardEvent | import("react").KeyboardEvent<Element>) => boolean) | undefined;
};
export declare const actionBringToFront: {
    name: "bringToFront";
    label: string;
    keywords: string[];
    icon: JSX.Element;
    trackEvent: {
        category: "element";
    };
    perform: (elements: readonly import("../element/types").OrderedExcalidrawElement[], appState: Readonly<import("../types").AppState>) => {
        elements: import("../element/types").ExcalidrawElement[] | readonly import("../element/types").ExcalidrawElement[];
        appState: Readonly<import("../types").AppState>;
        storeAction: "capture";
    };
    keyTest: (event: KeyboardEvent | import("react").KeyboardEvent<Element>) => boolean;
    PanelComponent: ({ updateData, appState }: import("./types").PanelComponentProps) => JSX.Element;
} & {
    keyTest?: ((event: KeyboardEvent | import("react").KeyboardEvent<Element>) => boolean) | undefined;
};
