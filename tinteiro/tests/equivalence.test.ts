/**
 * The rewritten modules must behave exactly like the Ink modules they replace (kept in
 * tests/reference, this private repository only). Random inputs plus edge cases, compared
 * value for value; legacy files compared on the real ones in the vault.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import * as ref from './reference/stroke-zoom-scale';
import * as refCam from './reference/camera';
import * as refPresets from './reference/stroke-presets';
import * as refEase from './reference/stroke-easing';
import * as refPen from './reference/pen-input';
import * as refErase from './reference/erase-constants';
import * as refTl from './reference/migrate-from-tldraw';
import * as pm from '../src/geom/pen-model';
import { frameRect } from '../src/geom/view';
import { drawingFromTldraw, writingFromTldraw } from '../src/geom/legacy-tldraw';
import { PEN_PRESETS } from '../src/geom/tool-presets';
import type { InkStrokeStyle, StrokeInputKind } from '../src/model/types';

let seed = 12345;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const range = (a: number, b: number) => a + (b - a) * rnd();
const EDGE = [NaN, -Infinity, Infinity, -1, 0, 1e-9, 0.05, 0.1, 0.0999, 0.5, 1, 1.0001, 2, 5, 5.0001, 50];
const N = 5000;

describe('zoom and smoothing', () => {
	it('clampZoom', () => {
		for (const z of [...EDGE, ...Array.from({ length: N }, () => range(-1, 8))]) expect(pm.clampZoom(z)).toEqual(refCam.clampZoom(z));
	});
	it('smoothing at capture zoom', () => {
		for (let i = 0; i < N; i++) {
			const v = range(-0.5, 1.5), z = i < EDGE.length ? EDGE[i] : range(0.01, 8);
			for (const k of ['pen', 'mouse'] as StrokeInputKind[]) expect(pm.smoothingAtZoom(v, z, k)).toEqual(ref.numericForCaptureZoom(v, z, k));
		}
	});
	it('eraser footprint', () => {
		for (let i = 0; i < N; i++) {
			const z = i < EDGE.length ? EDGE[i] : range(0.01, 8), r = range(4, 90);
			expect(pm.eraserRadiusOnScreen(z, r)).toEqual(ref.eraserHitRadiusScreenPx(z, r));
			expect(pm.eraserRadiusOnScreen(z)).toEqual(ref.eraserHitRadiusScreenPx(z));
		}
	});
	it('constants', () => {
		expect(pm.BASE_ZOOM).toBe(ref.INK_STROKE_ZOOM_REFERENCE);
		expect(pm.ZOOM_MIN).toBe(ref.INK_STROKE_ZOOM_MIN);
		expect(pm.ERASER_RADIUS).toBe(refErase.ERASER_HIT_RADIUS_REFERENCE);
		expect(pm.PEN_NUMERICS).toEqual(refPresets.PEN_NUMERIC_STROKE_PARTIAL);
		expect(pm.MOUSE_NUMERICS).toEqual(refPresets.MOUSE_NUMERIC_STROKE_PARTIAL);
		expect(pm.PRESSURE_GAIN).toBe(refPen.PEN_PRESSURE_GAIN);
		expect(pm.START_PRESSURE_FLOOR).toBe(refPen.PEN_MIN_START_PRESSURE);
		expect(pm.PRESSURE_SMOOTHING).toBe(refPen.PEN_PRESSURE_SMOOTHING_ALPHA);
		expect(pm.PRESSURE_SLEW_PER_SIZE).toBe(refPen.PEN_PRESSURE_SLEW_PER_SIZE);
		expect(pm.HOVER_PRESSURE).toBe(refPen.PEN_HOVER_PRESSURE_EPSILON);
	});
});

describe('stroke style', () => {
	it('matches for every pen, input kind and zoom', () => {
		const presets = [undefined, ...Object.values(PEN_PRESETS)];
		for (let i = 0; i < 2000; i++) {
			const base: InkStrokeStyle = { size: range(1, 80), thinning: range(0, 1), smoothing: range(0, 1), streamline: range(0, 1), simulatePressure: rnd() < 0.5, color: rnd() < 0.5 ? 'currentColor' : '#e03131', ...(rnd() < 0.3 ? { opacity: 0.4 } : {}) };
			const z = i < EDGE.length ? EDGE[i] : range(0.01, 8);
			for (const kind of ['pen', 'mouse'] as StrokeInputKind[]) {
				for (const preset of presets) {
					expect(pm.strokeStyleFor(base, kind, z, preset)).toEqual(refPresets.buildInkStrokeStyleForTreatAs(base, kind, z, preset));
				}
			}
			expect(pm.strokeStyleFor(base, 'pen')).toEqual(refPresets.buildInkStrokeStyleForTreatAs(base, 'pen'));
		}
	});
	it('pressure response and when it applies', () => {
		for (let i = 0; i <= 1000; i++) expect(pm.defaultPenEasing(i / 1000)).toEqual(refEase.penStrokePressureEasing(i / 1000));
		for (const inputKind of [undefined, 'pen', 'mouse'] as const) {
			for (const simulatePressure of [true, false]) {
				const s = { size: 4, thinning: 0.5, smoothing: 0.5, streamline: 0.5, simulatePressure, color: 'currentColor', ...(inputKind ? { inputKind } : {}) };
				expect(pm.usesPenEasing(s)).toBe(refEase.inkStrokeUsesPenEasing(s));
			}
		}
	});
	it('stylus pressure conditioning', () => {
		for (let i = 0; i < N; i++) {
			const raw = i < EDGE.length ? EDGE[i] : range(-0.2, 1.2);
			const travelled = rnd() < 0.1 ? 0 : range(0, 60), size = rnd() < 0.05 ? (rnd() < 0.5 ? 0 : -3) : range(1, 40);
			expect(pm.conditionPenPressure(raw, travelled, size)).toEqual(refPen.normalizePointerPenPressureForCapture(raw, travelled, size));
		}
	});
});

describe('framing', () => {
	it('frameRect', () => {
		for (let i = 0; i < N; i++) {
			const rect = { x: range(-5000, 5000), y: range(-5000, 5000), width: rnd() < 0.02 ? 0 : range(-10, 8000), height: rnd() < 0.02 ? 0 : range(-10, 8000) };
			const w = range(100, 2000), h = range(100, 2000), m = rnd() < 0.5 ? 16 : range(0, 40);
			expect(frameRect(w, h, rect, m)).toEqual(refCam.fitBoundsToViewport(w, h, rect, m));
			expect(frameRect(w, h, rect)).toEqual(refCam.fitBoundsToViewport(w, h, rect));
		}
	});
});

describe('legacy tldraw files', () => {
	const VAULT = '/home/davi/Documentos/Obsidian_Vaults/megabrain';
	const files: string[] = [];
	const walk = (d: string) => {
		for (const n of readdirSync(d)) {
			if (n.startsWith('.')) continue;
			const p = join(d, n);
			if (statSync(p).isDirectory()) walk(p);
			else if (/\.(writing|drawing)$/.test(n)) files.push(p);
		}
	};
	walk(VAULT);
	it('finds the vault legacy files', () => expect(files.length).toBeGreaterThan(0));
	for (const f of files) {
		it(f.split('/').slice(-2).join('/'), () => {
			const doc = JSON.parse(readFileSync(f, 'utf8')).tldraw;
			expect(drawingFromTldraw(doc)).toEqual(refTl.migrateFromTldraw(doc));
			expect(writingFromTldraw(doc)).toEqual(refTl.migrateWritingFromTldraw(doc));
			expect(writingFromTldraw(doc, 90)).toEqual(refTl.migrateWritingFromTldraw(doc, 90));
		});
	}
	it('synthetic documents (empty, no store, top-level store, sizes, missing z)', () => {
		const shape = (id: string, size: string, isPen: boolean, z?: number) => ({ typeName: 'shape', type: 'draw', id, x: range(-50, 50), y: range(-50, 50), props: { size, isPen, color: 'black', isComplete: true, segments: [{ type: 'free', points: [{ x: 1, y: 2, ...(z === undefined ? {} : { z }) }, { x: 3, y: 4, z: 0.7 }] }] } });
		const docs = [
			{},
			{ store: {} },
			{ session: { isGridMode: false }, document: { store: { a: shape('a', 's', true), b: shape('b', 'xl', false), c: shape('c', 'weird', true, 0.2), d: { typeName: 'shape', type: 'geo' }, e: { typeName: 'shape', type: 'draw', id: 'e', x: 0, y: 0, props: { size: 'm', isPen: true, segments: [] } }, 'document:document': { meta: { writingLineHeight: 120 } } } } },
			{ store: { a: shape('a', 'l', true), 'document:document': { meta: { writingLineHeight: -3 } } } },
		];
		for (const doc of docs) {
			expect(drawingFromTldraw(doc as never)).toEqual(refTl.migrateFromTldraw(doc as never));
			expect(writingFromTldraw(doc as never)).toEqual(refTl.migrateWritingFromTldraw(doc as never));
		}
	});
});
