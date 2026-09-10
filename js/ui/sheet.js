/**
 * The bottom sheet every panel appears in.
 *
 * One sheet, whatever is in it. Panels build their own contents and hand a node
 * over; the sheet owns the scrim, the escape key and the fact that only one
 * thing can be open at a time.
 */
export class Sheet {
	constructor(root, scrim) {
		this._root = root;
		this._scrim = scrim;
		this._title = root.querySelector(".sheet-title");
		this._body = root.querySelector(".sheet-body");
		this._name = "";

		root.querySelector(".sheet-close").addEventListener("click", () => this.close());
		scrim.addEventListener("click", () => this.close());
		window.addEventListener("keydown", (event) => {
			if (event.key === "Escape" && this.isOpen()) this.close();
		});
	}

	isOpen() {
		return !this._root.hidden;
	}

	/** Which panel is showing, so a caller can rebuild only the one on screen. */
	showing() {
		return this.isOpen() ? this._name : "";
	}

	open(name, title, node) {
		this._name = name;
		this._title.textContent = title;
		this._body.replaceChildren(node);
		this._body.scrollTop = 0;
		this._root.hidden = false;
		this._scrim.hidden = false;
	}

	/** Swaps the contents of the sheet that is already open, keeping its scroll. */
	replace(node) {
		const scroll = this._body.scrollTop;
		this._body.replaceChildren(node);
		this._body.scrollTop = scroll;
	}

	close() {
		this._name = "";
		this._root.hidden = true;
		this._scrim.hidden = true;
	}
}
