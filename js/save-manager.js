import * as Migration from "./save-migration.js";
import { Emitter } from "./util/emitter.js";

/**
 * The save document in localStorage.
 *
 * Writing is driven by an event rather than a direct call: SaveManager announces
 * that it is about to write, whoever owns live state hands it over, and the
 * write happens. That keeps this file free of any knowledge of GameState.
 *
 * localStorage.setItem is already all-or-nothing, so there is no torn write to
 * defend against. What needs care is *when* we write, because a browser tab can
 * be discarded without warning -- so every hook that might be the last one
 * flushes, and every action that changes the board writes straight through. A
 * board is hours of merging; losing an evening of it because the OS reclaimed a
 * tab is not a trade worth making for fewer writes.
 *
 * Emits: saveRequested(), loaded()
 */
export class SaveManager extends Emitter {
	static STORAGE_KEY = "mergesort.save";

	constructor(settings) {
		super();
		this._settings = settings;
		this._document = Migration.emptyDocument();
		this._loaded = false;
		this._wiped = false;
	}

	/**
	 * Browsers give no warning before a background tab is discarded, so every
	 * hook that might be the last one we get writes the document.
	 *
	 *   visibilitychange -> hidden   backgrounded, or the screen locked
	 *   pagehide                     navigating away or being unloaded
	 *   freeze                       the browser is suspending the tab entirely
	 */
	installSuspendHooks() {
		const flush = () => this.flush();
		document.addEventListener("visibilitychange", () => {
			if (document.visibilityState === "hidden") flush();
		});
		window.addEventListener("pagehide", flush);
		window.addEventListener("freeze", flush);
	}

	/** Collects live state from whoever is listening, then writes. */
	flush() {
		if (!this._loaded || this._wiped) return;
		this.emit("saveRequested");
		this._settings?.save();
		this._write();
	}

	/** Called from a saveRequested handler. */
	submit(state) {
		this._document = { ...this._document, ...state, version: Migration.CURRENT_VERSION };
	}

	document() {
		return this._document;
	}

	load() {
		this._loaded = true;
		let text = null;
		try {
			text = localStorage.getItem(SaveManager.STORAGE_KEY);
		} catch {
			// Private mode, or storage disabled. The game still plays; it just
			// cannot remember anything between visits.
			this._document = Migration.emptyDocument();
			this.emit("loaded");
			return;
		}

		let parsed = null;
		if (text !== null) {
			try {
				parsed = JSON.parse(text);
			} catch {
				console.warn("Save document is not valid JSON; starting a new depot.");
			}
		}
		this._document = parsed === null ? Migration.emptyDocument() : Migration.migrate(parsed);
		this.emit("loaded");
	}

	/**
	 * Throws the depot away, and stops writing for the rest of the page's life.
	 *
	 * Both halves matter. A wipe is followed by a reload, and a reload fires
	 * pagehide, which is one of the hooks above: the flush it triggers would ask
	 * the running game for its state and hand the depot that was just thrown away
	 * straight back to storage, so the reload would find it there again.
	 *
	 * Only the settings sheet calls this.
	 */
	wipe() {
		this._document = Migration.emptyDocument();
		this._wiped = true;
		try {
			localStorage.removeItem(SaveManager.STORAGE_KEY);
		} catch {
			// Nothing to do; the fresh document in memory is what matters.
		}
	}

	_write() {
		try {
			localStorage.setItem(SaveManager.STORAGE_KEY, JSON.stringify(this._document));
		} catch (error) {
			// Out of quota, or storage blocked. Losing the write is bad; taking the
			// running game down with it would be worse.
			console.warn("Could not write the save document.", error);
		}
	}
}
