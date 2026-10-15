/**
 * TEMPORARY diagnostic: where does a touch release get lost?
 *
 * Off unless ~/.cache/tinteiro-diag/ativo exists (created by gravar-toque.sh, which the user
 * runs). While on, pointer, touch, click and capture events seen by this window go to
 * ~/.cache/tinteiro-diag/renderer-<start>.jsonl, written outside the vault every 2 s. Markers
 * point at the failure: TAP-SEM-CLIQUE (a short touch outside ink produced no click), PRESO (a
 * touch down 3 s without moving and never released) and FANTASMA (the browser counts more
 * touches on the screen than the downs this window saw). Remove this module once the cause is known.
 */

type Fs = {
	existsSync(p: string): boolean;
	mkdirSync(p: string, o: { recursive: boolean }): void;
	promises: { appendFile(p: string, d: string): Promise<void> };
};

const POLL_MS = 1000;
const FLUSH_MS = 2000;
const TAP_MS = 400;
const TAP_PX = 10;
const CLICK_WAIT_MS = 600;
const TOUCH_MOVE_EVERY_MS = 100;

interface EmbedLike {
	el: HTMLElement;
	mode: string;
	surface?: { editor?: { touches?: Map<number, unknown>; isBusy?: boolean } } | null;
}

export function startTouchTrace(win: Window, embeds: () => Iterable<unknown>): () => void {
	const req = (win as unknown as { require?: (m: string) => unknown }).require;
	const fs = req?.('fs') as Fs | undefined;
	const os = req?.('os') as { homedir(): string } | undefined;
	if (!fs || !os) return () => undefined;
	const dir = `${os.homedir()}/.cache/tinteiro-diag`;
	const flag = `${dir}/ativo`;

	let on = false;
	let file = '';
	let buf: string[] = [];
	let flushTimer = 0;
	const t0 = performance.now();
	const active = new Map<number, { t: number; x: number; y: number; ink: boolean; lastMove: number; stuck?: boolean }>();
	const moves = { pen: 0, mouse: 0, touch: 0 };
	let clickAfter = 0;

	const rec = (o: Record<string, unknown>) => {
		buf.push(JSON.stringify({ t: Math.round(performance.now() - t0), wall: Date.now(), ...o }));
	};
	const where = (e: Event) => {
		const path = e.composedPath();
		const ink = path.some(n => n instanceof HTMLElement && (n.classList.contains('inkf-host') || n.classList.contains('inkf-full-host')));
		const first = path[0] as Element | undefined;
		const cls = first && 'className' in first && typeof first.className === 'string' ? first.className.slice(0, 40) : '';
		return { ink, tgt: `${first?.nodeName?.toLowerCase() ?? '?'}${cls ? '.' + cls.split(' ').join('.') : ''}` };
	};

	const onPointer = (e: PointerEvent) => {
		if (e.type === 'pointermove') {
			moves[e.pointerType as keyof typeof moves] = (moves[e.pointerType as keyof typeof moves] ?? 0) + 1;
			if (e.pointerType !== 'touch') return;
			const a = active.get(e.pointerId);
			if (!a || e.timeStamp - a.lastMove < TOUCH_MOVE_EVERY_MS) return;
			a.lastMove = e.timeStamp;
			rec({ k: 'move', id: e.pointerId, x: Math.round(e.clientX), y: Math.round(e.clientY) });
			return;
		}
		const w = where(e);
		rec({ k: e.type.slice(7), pt: e.pointerType, id: e.pointerId, x: Math.round(e.clientX), y: Math.round(e.clientY), b: e.buttons, w: Math.round(e.width), h: Math.round(e.height), ...w });
		if (e.pointerType !== 'touch') return;
		if (e.type === 'pointerdown') {
			active.set(e.pointerId, { t: e.timeStamp, x: e.clientX, y: e.clientY, ink: w.ink, lastMove: e.timeStamp });
		} else {
			const a = active.get(e.pointerId);
			active.delete(e.pointerId);
			if (e.type === 'pointerup' && a && !a.ink && e.timeStamp - a.t < TAP_MS && Math.hypot(e.clientX - a.x, e.clientY - a.y) < TAP_PX) {
				const asked = performance.now();
				clickAfter = asked;
				win.setTimeout(() => {
					if (clickAfter === asked) rec({ k: 'TAP-SEM-CLIQUE', id: e.pointerId, x: Math.round(e.clientX), y: Math.round(e.clientY), tgt: w.tgt });
				}, CLICK_WAIT_MS);
			}
		}
	};
	const onTouch = (e: TouchEvent) => {
		const ids = Array.from(e.touches, t => t.identifier);
		rec({ k: e.type, n: e.touches.length, ch: Array.from(e.changedTouches, t => t.identifier), ids });
		if (e.type === 'touchstart' && e.touches.length > active.size) {
			rec({ k: 'FANTASMA', browser: e.touches.length, abertos: [...active.keys()] });
		}
	};
	const onClick = (e: MouseEvent) => {
		clickAfter = 0;
		rec({ k: 'click', pt: (e as PointerEvent).pointerType ?? '', ...where(e) });
	};
	const onCapture = (e: PointerEvent) => rec({ k: e.type, pt: e.pointerType, id: e.pointerId, ...where(e) });
	const onFocus = (e: Event) => rec({ k: e.type });
	const onVis = () => rec({ k: 'visibility', v: win.document.visibilityState });

	const types: Array<[string, (e: never) => void]> = [
		['pointerdown', onPointer], ['pointerup', onPointer], ['pointercancel', onPointer], ['pointermove', onPointer],
		['touchstart', onTouch], ['touchend', onTouch], ['touchcancel', onTouch],
		['click', onClick], ['gotpointercapture', onCapture], ['lostpointercapture', onCapture],
		['contextmenu', onFocus],
	];

	const snapshot = () => {
		const eds: Array<Record<string, unknown>> = [];
		for (const raw of embeds()) {
			const e = raw as EmbedLike;
			if (!e.el?.isConnected) continue;
			const ed = e.surface?.editor;
			if (ed?.touches) eds.push({ mode: e.mode, toques: ed.touches.size, ocupado: !!ed.isBusy });
		}
		const now = performance.now();
		for (const [id, a] of active) {
			if (a.stuck || now - a.lastMove < 3000) continue;
			a.stuck = true;
			rec({ k: 'PRESO', id, ink: a.ink, desdeMs: Math.round(now - a.t) });
		}
		rec({ k: 'estado', abertos: [...active.keys()], moves: { ...moves }, editores: eds });
		moves.pen = moves.mouse = moves.touch = 0;
	};

	const flush = () => {
		if (!buf.length || !file) return;
		const out = buf.join('\n') + '\n';
		buf = [];
		void fs.promises.appendFile(file, out).catch(() => undefined);
	};

	const start = () => {
		on = true;
		fs.mkdirSync(dir, { recursive: true });
		const d = new Date();
		const pad = (n: number) => String(n).padStart(2, '0');
		file = `${dir}/renderer-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.jsonl`;
		for (const [t, fn] of types) win.addEventListener(t, fn as EventListener, { capture: true, passive: true });
		win.addEventListener('focus', onFocus);
		win.addEventListener('blur', onFocus);
		win.document.addEventListener('visibilitychange', onVis);
		rec({ k: 'inicio' });
		flushTimer = win.setInterval(() => { snapshot(); flush(); }, FLUSH_MS);
	};
	const stop = () => {
		if (!on) return;
		on = false;
		for (const [t, fn] of types) win.removeEventListener(t, fn as EventListener, { capture: true });
		win.removeEventListener('focus', onFocus);
		win.removeEventListener('blur', onFocus);
		win.document.removeEventListener('visibilitychange', onVis);
		win.clearInterval(flushTimer);
		snapshot();
		rec({ k: 'fim' });
		flush();
		active.clear();
	};

	const poll = win.setInterval(() => {
		const want = fs.existsSync(flag);
		if (want && !on) start();
		else if (!want && on) stop();
	}, POLL_MS);

	return () => {
		win.clearInterval(poll);
		stop();
	};
}
