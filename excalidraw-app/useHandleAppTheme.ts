import { THEME } from "@excalidraw/excalidraw";
import { EVENT, CODES, KEYS } from "@excalidraw/common";
import { useCallback, useEffect, useState } from "react";

import type { Theme } from "@excalidraw/element/types";

const getDarkThemeMediaQuery = (): MediaQueryList | undefined =>
  window.matchMedia?.("(prefers-color-scheme: dark)");

export const useHandleAppTheme = () => {
  const appTheme = THEME.LIGHT; // Myoc - only allow light
  const [editorTheme, setEditorTheme] = useState<Theme>(THEME.LIGHT);

  const setAppTheme = useCallback((_unused: string) => {
    // eslint-disable-next-line no-console
    console.debug("Myoc - light mode only");
  }, []);

  useEffect(() => {
    const mediaQuery = getDarkThemeMediaQuery();

    const handleChange = (e: MediaQueryListEvent) => {
      setEditorTheme(THEME.LIGHT); // MYOC - only allow light
    };

    const handleKeydown = (event: KeyboardEvent) => {
      if (
        !event[KEYS.CTRL_OR_CMD] &&
        event.altKey &&
        event.shiftKey &&
        event.code === CODES.D
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    document.addEventListener(EVENT.KEYDOWN, handleKeydown, { capture: true });

    return () => {
      mediaQuery?.removeEventListener("change", handleChange);
      document.removeEventListener(EVENT.KEYDOWN, handleKeydown, {
        capture: true,
      });
    };
  }, [appTheme, editorTheme, setAppTheme]);

  return { editorTheme, appTheme, setAppTheme };
};
