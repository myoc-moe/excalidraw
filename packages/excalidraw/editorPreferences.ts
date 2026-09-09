import type {
  AlignPreferences,
  AppState,
  ArrangePreferences,
  EditorPreferences,
  NormalisePreferences,
  SmartZoomPreferences,
} from "./types";

export type ResolvedSmartZoomPreferences = Required<SmartZoomPreferences>;
export type ResolvedAlignPreferences = Required<AlignPreferences>;
export type ResolvedArrangePreferences = Required<ArrangePreferences>;
export type ResolvedNormalisePreferences = Required<NormalisePreferences>;

export type ResolvedEditorPreferences = {
  smartZoom: ResolvedSmartZoomPreferences;
  align: ResolvedAlignPreferences;
  arrange: ResolvedArrangePreferences;
  normalise: ResolvedNormalisePreferences;
};

export const DEFAULT_ALIGN_PREFERENCES: ResolvedAlignPreferences = {
  stacking: false,
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
    Pick<AppState, "arrangeConfiguration" | "normaliseConfiguration"> &
      Partial<Pick<AppState, "alignConfiguration">>
  >,
  editorPreferences?: EditorPreferences,
): ResolvedEditorPreferences => {
  return {
    smartZoom: {
      ...DEFAULT_SMART_ZOOM_PREFERENCES,
      ...editorPreferences?.smartZoom,
    },
    align: {
      ...DEFAULT_ALIGN_PREFERENCES,
      ...appState.alignConfiguration,
      ...editorPreferences?.align,
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
