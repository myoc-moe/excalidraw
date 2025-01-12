import { useLayoutEffect } from "react";
import { useApp } from "../App";
export const DiagramToCodePlugin = (props) => {
    const app = useApp();
    useLayoutEffect(() => {
        app.setPlugins({
            diagramToCode: { generate: props.generate },
        });
    }, [app, props.generate]);
    return null;
};
