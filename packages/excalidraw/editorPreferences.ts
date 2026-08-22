import type {
  AppState,
  ArrangePreferences,
  EditorPreferences,
  NormalisePreferences,
  SmartZoomPreferences,
} from "./types";

export type ResolvedSmartZoomPreferences = Required<SmartZoomPreferences>;
export type ResolvedArrangePreferences = Required<ArrangePreferences>;
export type ResolvedNormalisePreferences = Required<NormalisePreferences>;

export type ResolvedEditorPreferences = {
  smartZoom: ResolvedSmartZoomPreferences;
  arrange: ResolvedArrangePreferences;
  normalise: ResolvedNormalisePreferences;
};

export const DEFAULT_SMART_ZOOM_PREFERENCES: ResolvedSmartZoomPreferences = {
  fitToViewport: true,
  animate: true,
  duration: 200,
  respectUIElements: false,
  viewportZoomFactor: 0.8,
};

export const getEffectiveEditorPreferences = (
  appState: Readonly<
    Pick<AppState, "arrangeConfiguration" | "normaliseConfiguration">
  >,
  editorPreferences?: EditorPreferences,
): ResolvedEditorPreferences => {
  return {
    smartZoom: {
      ...DEFAULT_SMART_ZOOM_PREFERENCES,
      ...editorPreferences?.smartZoom,
    },
    arrange: {
      ...appState.arrangeConfiguration,
      ...editorPreferences?.arrange,
    },
    normalise: {
      ...appState.normaliseConfiguration,
      ...editorPreferences?.normalise,
    },
  };
};
