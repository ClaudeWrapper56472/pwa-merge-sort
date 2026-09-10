/**
 * A named-event emitter.
 *
 * The whole app is wired this way: nothing reaches into another view's DOM. The
 * board listens for boardChanged and repaints, the HUD listens for
 * walletChanged and energyChanged. Input travels back up as events, so a view
 * can be swapped for another with the same controller behind it.
 */
export class Emitter {
	#listeners = new Map();

	/** Returns a function that removes the listener again. */
	on(name, handler) {
		let handlers = this.#listeners.get(name);
		if (handlers === undefined) {
			handlers = new Set();
			this.#listeners.set(name, handlers);
		}
		handlers.add(handler);
		return () => handlers.delete(handler);
	}

	off(name, handler) {
		this.#listeners.get(name)?.delete(handler);
	}

	emit(name, ...args) {
		const handlers = this.#listeners.get(name);
		if (handlers === undefined) return;
		// Copied so a handler may unsubscribe itself mid-emit.
		for (const handler of [...handlers]) handler(...args);
	}
}
