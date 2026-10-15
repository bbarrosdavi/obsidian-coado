// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The editor's input logic, without a GPU: every renderer call is a no-op, page = css.
vi.mock('../src/engine/renderer', () => ({
	createRenderer: () => new Proxy({ camera: { x: 0, y: 0, zoom: 1 }, palette: { ink: '#000', rule: '#ccc', accent: '#00f' } } as Record<string, unknown>, {
		get(target, key) {
			if (key in target) return target[key as string];
			if (key === 'cssToPage') return (x: number, y: number) => ({ x, y });
			if (key === 'visiblePageRect') return () => ({ minX: 0, minY: 0, maxX: 500, maxY: 500 });
			return () => undefined;
		},
		set(target, key, value) {
			target[key as string] = value;
			return true;
		},
	}),
}));

import { InkEditor } from '../src/engine/editor';
import { InkDocument } from '../src/engine/document';
import { DEFAULT_SETTINGS } from '../src/settings';
import type { InkMode } from '../src/model/types';
import { watchPointer, resetPointerFocus } from '../src/engine/pointer-focus';

function pointer(type: string, init: { pointerType: string; buttons: number; button?: number; x?: number; y?: number; t?: number; id?: number }): Event {
	const e = new Event(type, { bubbles: true, cancelable: true });
	Object.assign(e, {
		pointerId: init.id ?? (init.pointerType === 'pen' ? 2 : init.pointerType === 'touch' ? 3 : 1),
		pointerType: init.pointerType,
		buttons: init.buttons,
		button: init.button ?? -1,
		clientX: init.x ?? 0,
		clientY: init.y ?? 0,
		pressure: 0.5,
		shiftKey: false, ctrlKey: false, metaKey: false,
	});
	Object.defineProperty(e, 'timeStamp', { value: init.t ?? performance.now() });
	return e;
}

function setup(mode: InkMode) {
	const scroller = document.createElement('div');
	const stage = document.createElement('div');
	scroller.appendChild(stage);
	document.body.appendChild(scroller);
	const doc = new InkDocument({} as never, []);
	const editor = new InkEditor(stage, doc, mode, {
		settings: () => DEFAULT_SETTINGS,
		onEdit: () => {},
		onState: () => {},
		scroller: () => (stage.isConnected ? scroller : null),
	});
	return { scroller, stage, editor, doc };
}

describe('pen barrel pan in hover', () => {
	afterEach(() => { document.body.innerHTML = ''; });

	it('drawing: barrel held while hovering moves the camera, draws nothing', () => {
		const { stage, editor, doc } = setup('drawing');
		stage.dispatchEvent(pointer('pointerdown', { pointerType: 'pen', buttons: 2, button: 2, x: 100, y: 100 }));
		stage.dispatchEvent(pointer('pointermove', { pointerType: 'pen', buttons: 2, x: 140, y: 70 }));
		expect(editor.camera.x).toBe(40);
		expect(editor.camera.y).toBe(-30);
		stage.dispatchEvent(pointer('pointerup', { pointerType: 'pen', buttons: 0, button: 2, x: 140, y: 70 }));
		expect(editor.isBusy).toBe(false);
		expect(doc.strokes.length).toBe(0);
	});

	it('drawing: barrel arriving as a chorded move also pans, and releasing it ends the pan', () => {
		const { stage, editor } = setup('drawing');
		stage.dispatchEvent(pointer('pointermove', { pointerType: 'pen', buttons: 0, x: 10, y: 10 }));
		stage.dispatchEvent(pointer('pointermove', { pointerType: 'pen', buttons: 2, x: 10, y: 10 }));
		stage.dispatchEvent(pointer('pointermove', { pointerType: 'pen', buttons: 2, x: 30, y: 10 }));
		expect(editor.camera.x).toBe(20);
		stage.dispatchEvent(pointer('pointermove', { pointerType: 'pen', buttons: 0, x: 50, y: 10 }));
		expect(editor.isBusy).toBe(false);
		expect(editor.camera.x).toBe(20);
	});

	it('writing: barrel drag scrolls the note', () => {
		const { stage, scroller } = setup('writing');
		Object.defineProperty(scroller, 'scrollTop', { value: 200, writable: true });
		stage.dispatchEvent(pointer('pointerdown', { pointerType: 'pen', buttons: 2, button: 2, x: 50, y: 300 }));
		stage.dispatchEvent(pointer('pointermove', { pointerType: 'pen', buttons: 2, x: 50, y: 240 }));
		expect(scroller.scrollTop).toBe(260);
	});

	it('locked preview: barrel does nothing', () => {
		const { stage, editor } = setup('drawing');
		editor.interactive = false;
		stage.dispatchEvent(pointer('pointermove', { pointerType: 'pen', buttons: 2, x: 10, y: 10 }));
		stage.dispatchEvent(pointer('pointermove', { pointerType: 'pen', buttons: 2, x: 60, y: 10 }));
		expect(editor.camera.x).toBe(0);
	});
});

describe('touches stay in the page', () => {
	afterEach(() => { document.body.innerHTML = ''; });

	it("an editable page keeps touch downs from the note (reading view's double-tap toggle)", () => {
		const { stage, scroller } = setup('writing');
		let seen = 0;
		scroller.addEventListener('pointerdown', () => { seen++; });
		stage.dispatchEvent(pointer('pointerdown', { pointerType: 'touch', buttons: 1, button: 0 }));
		expect(seen).toBe(0);
	});

	it('a locked preview lets them through (tap to open, note gestures)', () => {
		const { stage, scroller, editor } = setup('writing');
		editor.interactive = false;
		let seen = 0;
		scroller.addEventListener('pointerdown', () => { seen++; });
		stage.dispatchEvent(pointer('pointerdown', { pointerType: 'touch', buttons: 1, button: 0 }));
		expect(seen).toBe(1);
	});
});

describe('pen near the page (cursor) and the note scroller', () => {
	beforeEach(() => { vi.useFakeTimers(); });
	afterEach(() => {
		vi.useRealTimers();
		document.body.innerHTML = '';
	});

	it('the pen never stops the note from scrolling by touch', () => {
		for (const mode of ['writing', 'drawing'] as const) {
			const { stage, scroller } = setup(mode);
			stage.dispatchEvent(pointer('pointerenter', { pointerType: 'pen', buttons: 0, t: performance.now() }));
			stage.dispatchEvent(pointer('pointermove', { pointerType: 'pen', buttons: 0, t: performance.now() }));
			expect(stage.classList.contains('pen-near')).toBe(true);
			expect(scroller.style.touchAction).toBe('');
		}
	});

	it('no pen state on a locked preview', () => {
		const { stage, editor } = setup('writing');
		editor.interactive = false;
		stage.dispatchEvent(pointer('pointermove', { pointerType: 'pen', buttons: 0, t: performance.now() }));
		expect(stage.classList.contains('pen-near')).toBe(false);
	});

	it('ends when the pen goes silent and its leave never came', () => {
		const { stage } = setup('writing');
		stage.dispatchEvent(pointer('pointermove', { pointerType: 'pen', buttons: 0, t: performance.now() }));
		vi.advanceTimersByTime(3000);
		expect(stage.classList.contains('pen-near')).toBe(false);
	});

	it('locking the embed ends it at once', () => {
		const { stage, editor } = setup('drawing');
		stage.dispatchEvent(pointer('pointerenter', { pointerType: 'pen', buttons: 0, t: performance.now() }));
		editor.interactive = false;
		expect(stage.classList.contains('pen-near')).toBe(false);
	});

	it('a mouse moving over the page brings the cursor back', () => {
		const { stage } = setup('writing');
		stage.dispatchEvent(pointer('pointermove', { pointerType: 'pen', buttons: 0, t: performance.now() }));
		stage.dispatchEvent(pointer('pointermove', { pointerType: 'mouse', buttons: 0, x: 40, y: 40 }));
		expect(stage.classList.contains('pen-near')).toBe(false);
	});
});

describe('cursor sent again when the pen arrives', () => {
	afterEach(() => { document.body.innerHTML = ''; });

	it('each arrival flips the cursor variant on an editable page', () => {
		const { stage } = setup('drawing');
		const before = stage.classList.contains('cursor-alt');
		stage.dispatchEvent(pointer('pointerenter', { pointerType: 'pen', buttons: 0, t: 1000 }));
		const first = stage.classList.contains('cursor-alt');
		expect(first).not.toBe(before);
		stage.dispatchEvent(pointer('pointerleave', { pointerType: 'pen', buttons: 0, t: 1010 }));
		stage.dispatchEvent(pointer('pointerenter', { pointerType: 'pen', buttons: 0, t: 1100 }));
		expect(stage.classList.contains('cursor-alt')).not.toBe(first);
	});

	it('a pause in pen events (back in range without an enter) flips it too', () => {
		const { stage } = setup('drawing');
		stage.dispatchEvent(pointer('pointermove', { pointerType: 'pen', buttons: 0, t: 1000 }));
		const a = stage.classList.contains('cursor-alt');
		stage.dispatchEvent(pointer('pointermove', { pointerType: 'pen', buttons: 0, t: 1008 }));
		expect(stage.classList.contains('cursor-alt')).toBe(a);
		stage.dispatchEvent(pointer('pointermove', { pointerType: 'pen', buttons: 0, t: 1600 }));
		expect(stage.classList.contains('cursor-alt')).not.toBe(a);
	});
});

describe('barrel pan and fingers', () => {
	afterEach(() => { document.body.innerHTML = ''; });

	it('a finger anywhere on the screen blocks the barrel pan (stray barrel presses while scrolling)', () => {
		const { stage, editor } = setup('drawing');
		const text = document.createElement('p');
		document.body.appendChild(text);
		text.dispatchEvent(Object.assign(pointer('pointerdown', { pointerType: 'touch', buttons: 1, button: 0 }), {}));
		stage.dispatchEvent(pointer('pointermove', { pointerType: 'pen', buttons: 2, x: 10, y: 10 }));
		stage.dispatchEvent(pointer('pointermove', { pointerType: 'pen', buttons: 2, x: 60, y: 10 }));
		expect(editor.camera.x).toBe(0);
		text.dispatchEvent(pointer('pointerup', { pointerType: 'touch', buttons: 0, button: 0 }));
		stage.dispatchEvent(pointer('pointermove', { pointerType: 'pen', buttons: 2, x: 60, y: 10 }));
		stage.dispatchEvent(pointer('pointermove', { pointerType: 'pen', buttons: 2, x: 80, y: 10 }));
		expect(editor.camera.x).toBe(20);
	});

	it('a finger landing mid-pan ends it', () => {
		const { stage, editor } = setup('drawing');
		const text = document.createElement('p');
		document.body.appendChild(text);
		stage.dispatchEvent(pointer('pointermove', { pointerType: 'pen', buttons: 2, x: 10, y: 10 }));
		stage.dispatchEvent(pointer('pointermove', { pointerType: 'pen', buttons: 2, x: 30, y: 10 }));
		expect(editor.camera.x).toBe(20);
		text.dispatchEvent(pointer('pointerdown', { pointerType: 'touch', buttons: 1, button: 0 }));
		stage.dispatchEvent(pointer('pointermove', { pointerType: 'pen', buttons: 2, x: 90, y: 10 }));
		expect(editor.isBusy).toBe(false);
		expect(editor.camera.x).toBe(20);
		text.dispatchEvent(pointer('pointerup', { pointerType: 'touch', buttons: 0, button: 0 }));
	});
});

describe('nothing left drawn where the pen leaves', () => {
	beforeEach(() => { vi.useFakeTimers(); });
	afterEach(() => {
		vi.useRealTimers();
		document.body.innerHTML = '';
	});

	it('pen leaving makes the page cursorless; the mouse niri parks there keeps it so', () => {
		const { stage } = setup('drawing');
		stage.dispatchEvent(pointer('pointermove', { pointerType: 'pen', buttons: 0, x: 120, y: 80, t: performance.now() }));
		stage.dispatchEvent(pointer('pointerleave', { pointerType: 'pen', buttons: 0, x: 120, y: 80 }));
		expect(stage.classList.contains('pen-away')).toBe(true);
		stage.dispatchEvent(pointer('pointermove', { pointerType: 'mouse', buttons: 0, x: 120, y: 80 }));
		expect(stage.classList.contains('pen-away')).toBe(true);
		vi.advanceTimersByTime(3000);
		expect(stage.classList.contains('pen-away')).toBe(true);
	});

	it('a real mouse move brings the mouse cursor back', () => {
		const { stage } = setup('drawing');
		stage.dispatchEvent(pointer('pointermove', { pointerType: 'pen', buttons: 0, x: 120, y: 80, t: performance.now() }));
		stage.dispatchEvent(pointer('pointerleave', { pointerType: 'pen', buttons: 0, x: 120, y: 80 }));
		stage.dispatchEvent(pointer('pointermove', { pointerType: 'mouse', buttons: 0, x: 150, y: 90 }));
		expect(stage.classList.contains('pen-away')).toBe(false);
	});

	it('the pen coming back clears it and sends the cursor again', () => {
		const { stage } = setup('drawing');
		stage.dispatchEvent(pointer('pointermove', { pointerType: 'pen', buttons: 0, x: 120, y: 80, t: 1000 }));
		stage.dispatchEvent(pointer('pointerleave', { pointerType: 'pen', buttons: 0, x: 120, y: 80, t: 1010 }));
		const alt = stage.classList.contains('cursor-alt');
		stage.dispatchEvent(pointer('pointerenter', { pointerType: 'pen', buttons: 0, x: 200, y: 80, t: 1500 }));
		expect(stage.classList.contains('pen-away')).toBe(false);
		expect(stage.classList.contains('cursor-alt')).not.toBe(alt);
	});
});

describe('mouse brought under the pen so its cursor reaches the screen', () => {
	let moves: Array<[number, number]> = [];
	let unwatch: () => void = () => {};
	beforeEach(() => {
		moves = [];
		unwatch = watchPointer(window, (dx, dy) => { moves.push([dx, dy]); });
	});
	afterEach(() => {
		unwatch();
		resetPointerFocus();
		document.body.innerHTML = '';
	});

	it('pen arriving moves the mouse from where niri parked it to the pen', () => {
		const { stage } = setup('drawing');
		// niri parks the mouse where the pen left: the page sees a mouse move there.
		stage.dispatchEvent(pointer('pointermove', { pointerType: 'mouse', buttons: 0, x: 120, y: 80 }));
		// A finger scrolls (niri drops the mouse focus; the mouse does not move).
		stage.dispatchEvent(pointer('pointerdown', { pointerType: 'touch', buttons: 1, button: 0, x: 400, y: 400 }));
		stage.dispatchEvent(pointer('pointerup', { pointerType: 'touch', buttons: 0, button: 0, x: 400, y: 300 }));
		stage.dispatchEvent(pointer('pointerenter', { pointerType: 'pen', buttons: 0, x: 300, y: 200, t: 5000 }));
		expect(moves).toEqual([[180, 120]]);
	});

	it('our own move does not count as the user taking the mouse', () => {
		const { stage } = setup('drawing');
		stage.dispatchEvent(pointer('pointermove', { pointerType: 'mouse', buttons: 0, x: 120, y: 80 }));
		stage.dispatchEvent(pointer('pointerenter', { pointerType: 'pen', buttons: 0, x: 300, y: 200, t: 5000 }));
		stage.dispatchEvent(pointer('pointermove', { pointerType: 'pen', buttons: 0, x: 310, y: 205, t: 5010 }));
		stage.dispatchEvent(pointer('pointermove', { pointerType: 'mouse', buttons: 0, x: 300, y: 200 }));
		expect(stage.classList.contains('pen-near')).toBe(true);
	});

	it('once per arrival: hovering on does not move the mouse again', () => {
		const { stage } = setup('drawing');
		stage.dispatchEvent(pointer('pointermove', { pointerType: 'mouse', buttons: 0, x: 120, y: 80 }));
		stage.dispatchEvent(pointer('pointerenter', { pointerType: 'pen', buttons: 0, x: 300, y: 200, t: 5000 }));
		for (let i = 1; i <= 5; i++) stage.dispatchEvent(pointer('pointermove', { pointerType: 'pen', buttons: 0, x: 300 + i, y: 200, t: 5000 + i * 8 }));
		stage.dispatchEvent(pointer('pointermove', { pointerType: 'pen', buttons: 0, x: 320, y: 200, t: 5600 }));
		expect(moves.length).toBe(1);
	});

	it('mouse position unknown (it left the window): no move', () => {
		const { stage } = setup('drawing');
		stage.dispatchEvent(pointer('pointermove', { pointerType: 'mouse', buttons: 0, x: 2, y: 80 }));
		stage.dispatchEvent(pointer('pointerout', { pointerType: 'mouse', buttons: 0, x: 0, y: 80 }));
		stage.dispatchEvent(pointer('pointerenter', { pointerType: 'pen', buttons: 0, x: 300, y: 200, t: 5000 }));
		expect(moves).toEqual([]);
	});

	it('a locked preview never moves the mouse', () => {
		const { stage, editor } = setup('drawing');
		editor.interactive = false;
		stage.dispatchEvent(pointer('pointermove', { pointerType: 'mouse', buttons: 0, x: 120, y: 80 }));
		stage.dispatchEvent(pointer('pointerenter', { pointerType: 'pen', buttons: 0, x: 300, y: 200, t: 5000 }));
		expect(moves).toEqual([]);
	});
});

describe('a touch whose release never came', () => {
	afterEach(() => { document.body.innerHTML = ''; });
	const finger = (type: string, id: number, x: number, y: number, t: number) =>
		pointer(type, { pointerType: 'touch', buttons: type === 'pointerup' ? 0 : 1, button: 0, id, x, y, t });

	it('a finger silent for long is dropped when another lands: one finger scrolls, the camera stays', () => {
		const { stage, scroller, editor } = setup('drawing');
		Object.defineProperty(scroller, 'scrollTop', { value: 500, writable: true });
		stage.dispatchEvent(finger('pointerdown', 9, 300, 300, 1000));
		stage.dispatchEvent(finger('pointerdown', 1, 100, 300, 9000));
		stage.dispatchEvent(finger('pointermove', 1, 100, 240, 9016));
		expect(editor.camera).toEqual({ x: 0, y: 0, zoom: 1 });
		expect(scroller.scrollTop).toBe(560);
	});

	it('two fingers landing together still pinch-pan the drawing', () => {
		const { stage, editor } = setup('drawing');
		stage.dispatchEvent(finger('pointerdown', 1, 100, 300, 1000));
		stage.dispatchEvent(finger('pointerdown', 2, 200, 300, 1040));
		stage.dispatchEvent(finger('pointermove', 1, 100, 260, 1060));
		stage.dispatchEvent(finger('pointermove', 2, 200, 260, 1060));
		expect(editor.camera.y).toBe(-40);
	});

	it('a finger that keeps moving is kept, however long it has been down', () => {
		const { stage, editor } = setup('drawing');
		editor.zoomLocked = true;
		stage.dispatchEvent(finger('pointerdown', 1, 100, 300, 1000));
		for (let t = 1500; t <= 6000; t += 500) stage.dispatchEvent(finger('pointermove', 1, 100, 300 - (t - 1000) / 500, t));
		stage.dispatchEvent(finger('pointerdown', 2, 200, 290, 6200));
		stage.dispatchEvent(finger('pointermove', 2, 200, 250, 6216));
		expect(editor.camera.y).toBe(-20);
	});
});
