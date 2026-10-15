/**
 * Gives the window the compositor's mouse focus when the pen arrives without it.
 *
 * Chromium on Wayland gives the pen the default arrow whenever it comes into range and sends
 * the page's cursor only through wl_pointer, which niri accepts only while the mouse is over
 * the window. Any touch makes niri drop that focus, so after scrolling with a finger the pen
 * kept the arrow over the page. `wlrctl pointer move` (wlr virtual pointer: one shot, no
 * daemon, no device) moves the mouse from where it is to the pen; niri hands the window its
 * focus back and Chromium sends the page's cursor again.
 *
 * Where the mouse is comes from the page: niri parks it where the pen leaves range, touches
 * do not move it, and every mouse event over the window says where it is.
 */

type Mover = (dx: number, dy: number) => void;

let at: { x: number; y: number } | null = null;
let quietUntil = 0;
let mover: Mover | null | undefined;
let zoom: () => number = () => 1;

/** How long the mouse events our own move produces are told apart from the user's. */
const OWN_MOVE_MS = 250;

function defaultMover(): Mover | null {
	const req = (window as unknown as { require?: (m: string) => unknown }).require;
	const cp = req?.('child_process') as
		{ execFile(file: string, args: string[], opts: { timeout: number }, cb: (err: Error | null) => void): void } | undefined;
	if (!cp) return null;
	try {
		const electron = req?.('electron') as { webFrame?: { getZoomFactor(): number } } | undefined;
		if (electron?.webFrame) zoom = () => electron.webFrame!.getZoomFactor();
	} catch {
		// No zoom factor: page px are taken as logical px.
	}
	let missing = false;
	return (dx, dy) => {
		if (missing) return;
		cp.execFile('wlrctl', ['pointer', 'move', String(dx), String(dy)], { timeout: 1000 }, err => {
			// Not installed (or no virtual pointer): stop trying.
			if (err && (err as NodeJS.ErrnoException).code === 'ENOENT') missing = true;
		});
	};
}

/** Tracks where the mouse is over this window. Returns the disposer. */
export function watchPointer(win: Window, move?: Mover): () => void {
	if (move) mover = move;
	const onMouse = (e: PointerEvent) => {
		if (e.pointerType === 'mouse') at = { x: e.clientX, y: e.clientY };
	};
	const onOut = (e: PointerEvent) => {
		if (e.pointerType !== 'mouse' || e.relatedTarget) return;
		// Left across the edge: it is somewhere else now. Focus taken in place (a touch): still here.
		const edge = 3;
		if (e.clientX <= edge || e.clientY <= edge || e.clientX >= win.innerWidth - edge || e.clientY >= win.innerHeight - edge) at = null;
	};
	win.addEventListener('pointermove', onMouse, true);
	win.addEventListener('pointerover', onMouse, true);
	win.addEventListener('pointerdown', onMouse, true);
	win.addEventListener('pointerout', onOut, true);
	return () => {
		win.removeEventListener('pointermove', onMouse, true);
		win.removeEventListener('pointerover', onMouse, true);
		win.removeEventListener('pointerdown', onMouse, true);
		win.removeEventListener('pointerout', onOut, true);
	};
}

/** Moves the mouse under the pen (viewport css px), when where it is now is known. */
export function bringMouseTo(x: number, y: number): void {
	if (!at) return;
	if (mover === undefined) mover = defaultMover();
	if (!mover) return;
	const z = zoom();
	const dx = Math.round((x - at.x) * z);
	const dy = Math.round((y - at.y) * z);
	at = { x, y };
	quietUntil = performance.now() + OWN_MOVE_MS;
	mover(dx, dy);
}

/** A mouse event caused by bringMouseTo, not by the user. */
export function isOwnMouseMove(): boolean {
	return performance.now() < quietUntil;
}

/** For tests. */
export function resetPointerFocus(): void {
	at = null;
	quietUntil = 0;
	mover = undefined;
	zoom = () => 1;
}
