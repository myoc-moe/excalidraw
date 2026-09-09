import { Dialog } from "@excalidraw/excalidraw/components/Dialog";

import type { ArrangeAlgorithms } from "@excalidraw/element/types";
import type {
  EditorPreferences,
  NormaliseMetric,
  NormaliseMode,
} from "@excalidraw/excalidraw/types";
import type { ResolvedEditorPreferences } from "@excalidraw/excalidraw/editorPreferences";

import "./EditorPreferencesDialog.scss";

const ARRANGE_ALGORITHMS: {
  value: ArrangeAlgorithms;
  label: string;
}[] = [
  { value: "bin-packing", label: "Bin packing" },
  { value: "bin-packing-center", label: "Bin packing (center)" },
  { value: "bin-packing-max-rects", label: "Max rects" },
  { value: "bin-packing-binary-tree", label: "Binary tree" },
];

const NORMALISE_MODES: {
  value: NormaliseMode;
  label: string;
}[] = [
  { value: "average", label: "Average" },
  { value: "first", label: "First selected" },
];

const NORMALISE_METRICS: {
  value: NormaliseMetric;
  label: string;
}[] = [
  { value: "size", label: "Size" },
  { value: "scale", label: "Scale" },
  { value: "height", label: "Height" },
  { value: "width", label: "Width" },
];

const updateNumericPreference = (
  value: string,
  onValidValue: (nextValue: number) => void,
) => {
  const nextValue = Number(value);
  if (!Number.isFinite(nextValue)) {
    return;
  }
  onValidValue(nextValue);
};

export const EditorPreferencesDialog = ({
  editorPreferences,
  onChange,
  onClose,
}: {
  editorPreferences: ResolvedEditorPreferences;
  onChange: (next: EditorPreferences) => void;
  onClose: () => void;
}) => {
  return (
    <Dialog
      className="EditorPreferencesDialog"
      size="small"
      onCloseRequest={onClose}
      title="Editor Preferences"
    >
      <div className="EditorPreferencesDialog__sections">
        <section className="EditorPreferencesDialog__section">
          <h3>Smart zoom</h3>
          <label className="EditorPreferencesDialog__checkbox">
            <input
              data-testid="editor-preferences-smartzoom-fit"
              type="checkbox"
              checked={editorPreferences.smartZoom.fitToViewport}
              onChange={(event) =>
                onChange({
                  smartZoom: {
                    fitToViewport: event.target.checked,
                  },
                })
              }
            />
            <span>Fit to viewport</span>
          </label>
          <label className="EditorPreferencesDialog__checkbox">
            <input
              data-testid="editor-preferences-smartzoom-animate"
              type="checkbox"
              checked={editorPreferences.smartZoom.animate}
              onChange={(event) =>
                onChange({
                  smartZoom: {
                    animate: event.target.checked,
                  },
                })
              }
            />
            <span>Animate</span>
          </label>
          <label className="EditorPreferencesDialog__checkbox">
            <input
              data-testid="editor-preferences-smartzoom-respect-ui"
              type="checkbox"
              checked={editorPreferences.smartZoom.respectUIElements}
              onChange={(event) =>
                onChange({
                  smartZoom: {
                    respectUIElements: event.target.checked,
                  },
                })
              }
            />
            <span>Respect UI elements</span>
          </label>
          <label className="EditorPreferencesDialog__field">
            <span>Duration (ms)</span>
            <input
              data-testid="editor-preferences-smartzoom-duration"
              type="number"
              min={0}
              step={10}
              value={editorPreferences.smartZoom.duration}
              onChange={(event) =>
                updateNumericPreference(event.target.value, (duration) =>
                  onChange({
                    smartZoom: {
                      duration: Math.max(0, duration),
                    },
                  }),
                )
              }
            />
          </label>
          <label className="EditorPreferencesDialog__field">
            <span>Viewport zoom factor</span>
            <input
              data-testid="editor-preferences-smartzoom-factor"
              type="number"
              min={0.1}
              max={1}
              step={0.05}
              value={editorPreferences.smartZoom.viewportZoomFactor}
              onChange={(event) =>
                updateNumericPreference(
                  event.target.value,
                  (viewportZoomFactor) =>
                    onChange({
                      smartZoom: {
                        viewportZoomFactor: Math.min(
                          1,
                          Math.max(0.1, viewportZoomFactor),
                        ),
                      },
                    }),
                )
              }
            />
          </label>
        </section>

        <section className="EditorPreferencesDialog__section">
          <h3>Align</h3>
          <label className="EditorPreferencesDialog__checkbox">
            <input
              data-testid="editor-preferences-align-stacking"
              type="checkbox"
              checked={editorPreferences.align.stacking}
              onChange={(event) =>
                onChange({
                  align: {
                    stacking: event.target.checked,
                  },
                })
              }
            />
            <span>Stacking</span>
          </label>
        </section>

        <section className="EditorPreferencesDialog__section">
          <h3>Arrange</h3>
          <label className="EditorPreferencesDialog__field">
            <span>Algorithm</span>
            <select
              data-testid="editor-preferences-arrange-algorithm"
              value={editorPreferences.arrange.algorithm}
              onChange={(event) =>
                onChange({
                  arrange: {
                    algorithm: event.target.value as ArrangeAlgorithms,
                  },
                })
              }
            >
              {ARRANGE_ALGORITHMS.map((algorithm) => (
                <option key={algorithm.value} value={algorithm.value}>
                  {algorithm.label}
                </option>
              ))}
            </select>
          </label>
          <label className="EditorPreferencesDialog__field">
            <span>Gap</span>
            <input
              data-testid="editor-preferences-arrange-gap"
              type="number"
              min={0}
              step={1}
              value={editorPreferences.arrange.gap}
              onChange={(event) =>
                updateNumericPreference(event.target.value, (gap) =>
                  onChange({
                    arrange: {
                      gap: Math.max(0, gap),
                    },
                  }),
                )
              }
            />
          </label>
        </section>

        <section className="EditorPreferencesDialog__section">
          <h3>Normalise</h3>
          <label className="EditorPreferencesDialog__field">
            <span>Mode</span>
            <select
              data-testid="editor-preferences-normalise-mode"
              value={editorPreferences.normalise.mode}
              onChange={(event) =>
                onChange({
                  normalise: {
                    mode: event.target.value as NormaliseMode,
                  },
                })
              }
            >
              {NORMALISE_MODES.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </select>
          </label>
          <label className="EditorPreferencesDialog__field">
            <span>Metric</span>
            <select
              data-testid="editor-preferences-normalise-metric"
              value={editorPreferences.normalise.metric}
              onChange={(event) =>
                onChange({
                  normalise: {
                    metric: event.target.value as NormaliseMetric,
                  },
                })
              }
            >
              {NORMALISE_METRICS.map((metric) => (
                <option key={metric.value} value={metric.value}>
                  {metric.label}
                </option>
              ))}
            </select>
          </label>
        </section>
      </div>

      <div className="EditorPreferencesDialog__actions">
        <button
          data-testid="editor-preferences-close"
          type="button"
          className="EditorPreferencesDialog__close"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </Dialog>
  );
};
