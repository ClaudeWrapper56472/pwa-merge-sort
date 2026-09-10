/**
 * Keeps the browser from zooming the app.
 *
 * There is nothing here to zoom to. The board is sized to the screen and the
 * panels are already at reading size, so a browser zoom only pushes the bar,
 * the dock and the sheet's own buttons off the edges. The stylesheet's
 * touch-action states the rule where it is honoured. iOS Safari honours none of
 * it, so the gestures it zooms with are refused here one at a time.
 *
 * The keyboard's zoom is left alone: it is the browser's own chrome, and someone
 * who needs bigger text should still get it.
 */

/** How close together two taps have to be to be one double tap. */
const DOUBLE_TAP_MS = 350;
const DOUBLE_TAP_PX = 40;

export function lockPageZoom() {
	for (const type of ["gesturestart", "gesturechange", "gestureend"]) {
		document.addEventListener(type, (event) => event.preventDefault(), { passive: false });
	}
	document.addEventListener("wheel", (event) => {
		if (event.ctrlKey) event.preventDefault();
	}, { passive: false });
	lockDoubleTap();
}

/**
 * Refuses the second tap of a double tap over the chrome, which is the gesture
 * that zooms to whatever block sits under the finger. A panel is what usually
 * catches it, being the only part of the app with a paragraph to zoom to.
 *
 * The board is left out. It is the one place where tapping the same spot twice
 * quickly is the point -- two pops from a producer, not a request to zoom.
 *
 * Refusing a tap also cancels the click the browser would have made from it, so
 * a button is clicked by hand instead. Every control in the app is a button, so
 * nothing loses a tap it was meant to get.
 */
function lockDoubleTap() {
	let last = null;
	document.addEventListener("touchend", (event) => {
		if (event.touches.length > 0 || event.changedTouches.length !== 1) {
			last = null;
			return;
		}
		if (event.target.closest(".board") !== null) return;

		const touch = event.changedTouches[0];
		const now = performance.now();
		const again = last !== null
			&& now - last.at < DOUBLE_TAP_MS
			&& Math.hypot(touch.clientX - last.x, touch.clientY - last.y) < DOUBLE_TAP_PX;
		last = again ? null : { at: now, x: touch.clientX, y: touch.clientY };
		if (!again) return;

		event.preventDefault();
		event.target.closest("button")?.click();
	}, { passive: false });
}
