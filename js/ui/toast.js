/**
 * The line of messages above the dock.
 *
 * One line at a time, oldest pushed out. Everything the game says to the player
 * that is not worth stopping them for comes through here.
 */
const LIFETIME_MS = 2600;
const MAX_ON_SCREEN = 3;

export class Toasts {
	constructor(root) {
		this._root = root;
	}

	show(text, kind = "info") {
		const toast = document.createElement("p");
		toast.className = `toast ${kind}`;
		toast.textContent = text;
		this._root.append(toast);
		while (this._root.childElementCount > MAX_ON_SCREEN) this._root.firstElementChild.remove();
		setTimeout(() => {
			toast.classList.add("leaving");
			setTimeout(() => toast.remove(), 300);
		}, LIFETIME_MS);
	}
}
