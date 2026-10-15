import type { StrokeInputKind } from '../../src/model/types';
import type { PenPreset } from '../../src/geom/tool-presets';
import type { InkStrokeStyle } from '../../src/model/types';
import {
	clampCaptureZoom,
	INK_STROKE_ZOOM_REFERENCE,
	numericForCaptureZoom,
} from './stroke-zoom-scale';

/**
 * Pen @ 1× — `streamline: 0` for a faithful, pen-following stroke. Live preview and the committed
 * stroke render the same `points` through the same `getStroke(points, toStrokeOptions(style))` call,
 * so this value applies to both equally (WYSIWYG) — see `ink-canvas-live-drawing.md`.
 * At zoom-**out**, `streamline` lerps toward the zoom-out target
 * (`STREAMLINE_SMOOTHING_ZOOM_OUT_TARGET.pen`) for both layers together, since the scaled value lives
 * on `style`.
 */
export const PEN_NUMERIC_STROKE_PARTIAL: Pick<
	InkStrokeStyle,
	'thinning' | 'smoothing' | 'streamline' | 'simulatePressure'
> = {
	thinning: 0.6,
	smoothing: 0.1,
	streamline: 0,
	simulatePressure: false,
};

/** Mouse @ 1× — zoom-out target 0.4 at 0.1× (+0.2 vs reference). */
export const MOUSE_NUMERIC_STROKE_PARTIAL: Pick<
	InkStrokeStyle,
	'thinning' | 'smoothing' | 'streamline' | 'simulatePressure'
> = {
	thinning: 0.6,
	smoothing: 0.4,
	streamline: 0.4,
	simulatePressure: true,
};

/** Multiply editor stroke width when using mouse treat-as (simulated stroke reads narrower than pen). */
// 1.6 matches optically to mouse in pen setting, but not necessarily pen in pen setting.
// TODO: We should let pen as pen be 1, but mouse as pen should be 1.6 
export const OPTICAL_MOUSE_TO_PEN_RATIO = 1;

/**
 * Builds a full stroke style for persistence: merges pen/mouse numeric preset with
 * user-chosen size and colour from the editor toolbar.
 *
 * When a {@link PenPreset} is supplied (i.e. the toolbar is on a specific pen), its
 * pen-feel values are layered on top of the input-kind numerics: `thinning` is an
 * absolute override, while smoothing/streamline are boosts applied *after* the zoom
 * scaling so the upstream zoom behaviour is preserved.
 */
export function buildInkStrokeStyleForTreatAs(
	base: InkStrokeStyle,
	treatAs: StrokeInputKind,
	captureZoom: number = INK_STROKE_ZOOM_REFERENCE,
	penPreset?: PenPreset,
): InkStrokeStyle {
	const numeric =
		treatAs === 'pen' ? PEN_NUMERIC_STROKE_PARTIAL : MOUSE_NUMERIC_STROKE_PARTIAL;
	const size = treatAs === 'mouse' ? base.size * OPTICAL_MOUSE_TO_PEN_RATIO : base.size;
	const zoom = clampCaptureZoom(captureZoom);

	const style: InkStrokeStyle = {
		...base,
		...numeric,
		size,
		streamline: numericForCaptureZoom(numeric.streamline, zoom, treatAs),
		smoothing: numericForCaptureZoom(numeric.smoothing, zoom, treatAs),
		inputKind: treatAs,
		captureZoom: zoom,
	};

	if (!penPreset) return style;

	style.thinning = penPreset.thinning;
	style.streamline = clamp01(style.streamline + penPreset.streamlineBoost);
	style.smoothing = clamp01(style.smoothing + penPreset.smoothingBoost);
	// Opacity is omitted at full strength so ordinary ink files keep their original shape.
	if (penPreset.opacity < 1) {
		style.opacity = penPreset.opacity;
	} else {
		delete style.opacity;
	}

	return style;
}

function clamp01(value: number): number {
	if (!Number.isFinite(value)) return 0;
	return Math.min(1, Math.max(0, value));
}
