/**
 * The grid, and the one gesture the whole game is played with.
 *
 * Cells are built once and repainted in place, keyed by what they hold, so an
 * animation running on a cell is not thrown away by a repaint of its neighbour.
 *
 * Pointer events on window for the length of a drag, one path for touch and
 * mouse alike. A press that never travels far enough is a tap; anything past
 * the threshold picks the item up, and the cell under the finger is found by
 * dividing the board's own box rather than by hit-testing, which keeps the
 * answer the same whether the finger is over an item or the gap beside it.
 *
 * Emits: tapped(index), dragged(from, to), pickedUp(index)
 */
import { Emitter } from "../util/emitter.js";
import { COLUMNS, ROWS } from "../board.js";
import { itemSprite } from "./sprites.js";
import * as Chains from "../content/chains.js";
import * as Producers from "../producers.js";
import * as Format from "../util/format.js";

/** How far a press has to travel before it stops being a tap. */
const DRAG_THRESHOLD = 8;

export class BoardView extends Emitter {
	constructor(root, game) {
		super();
		this._root = root;
		this._game = game;
		this._cells = [];
		this._signatures = [];
		this._selected = -1;
		this._drag = null;

		this._build();
		this._root.addEventListener("pointerdown", (event) => this._onPointerDown(event));
		// The board is a thing you drag across, so the browser must not decide
		// halfway through that it was a scroll after all.
		this._root.addEventListener("contextmenu", (event) => event.preventDefault());
	}

	_build() {
		this._root.style.setProperty("--columns", COLUMNS);
		this._root.style.setProperty("--rows", ROWS);
		const fragment = document.createDocumentFragment();
		for (let index = 0; index < COLUMNS * ROWS; index += 1) {
			const cell = document.createElement("button");
			cell.type = "button";
			cell.className = "cell";
			cell.dataset.index = String(index);
			cell.innerHTML = '<span class="art"></span><span class="badge" hidden></span>';
			this._cells.push(cell);
			this._signatures.push("");
			fragment.append(cell);
		}
		this._root.append(fragment);
	}

	select(index) {
		this._selected = index;
		this.paint();
	}

	get selected() {
		return this._selected;
	}

	/** Repaints every cell whose contents changed, and the selection either way. */
	paint() {
		const board = this._game.board;
		for (let index = 0; index < this._cells.length; index += 1) {
			const cell = this._cells[index];
			const item = board.at(index);
			const signature = this._signatureOf(item);
			if (signature !== this._signatures[index]) {
				this._signatures[index] = signature;
				this._paintCell(cell, item);
			}
			cell.classList.toggle("selected", index === this._selected);
			cell.classList.toggle("match", this._matches(item));
		}
	}

	/**
	 * Everything a cell draws, so a repaint happens exactly when one is needed.
	 * Deliberately not the countdown to the next charge: a tile that rewrote its
	 * own art every second would flicker and would cancel its own pop animation.
	 * The clock belongs on the item bar, which has room to show it.
	 */
	_signatureOf(item) {
		if (item === null) return "";
		if (Chains.isProducer(item)) return `${item.chain}:${item.tier}:${item.charges}`;
		return `${item.chain}:${item.tier}`;
	}

	_matches(item) {
		if (item === null || this._selected < 0) return false;
		const chosen = this._game.board.at(this._selected);
		return chosen !== null && Chains.canMerge(chosen, item) && item !== chosen;
	}

	_paintCell(cell, item) {
		const art = cell.querySelector(".art");
		const badge = cell.querySelector(".badge");
		if (item === null) {
			art.innerHTML = "";
			badge.hidden = true;
			cell.classList.remove("filled", "producer", "spent", "maxed");
			cell.setAttribute("aria-label", "Empty cell");
			return;
		}

		art.innerHTML = itemSprite(item);
		cell.classList.add("filled");
		cell.classList.toggle("producer", Chains.isProducer(item));
		cell.classList.toggle("maxed", Chains.isMaxed(item));

		if (Chains.isProducer(item)) {
			const empty = item.charges <= 0;
			cell.classList.toggle("spent", empty);
			badge.hidden = false;
			badge.className = `badge charges${empty ? " empty" : ""}`;
			this._paintCharges(badge, item);
		} else if (Chains.isEnergy(item)) {
			cell.classList.remove("spent");
			badge.hidden = false;
			badge.className = "badge energy";
			badge.textContent = `+${Chains.energyOf(item)}`;
		} else {
			cell.classList.remove("spent");
			badge.hidden = true;
		}
		cell.setAttribute("aria-label", Chains.name(item));
	}

	/**
	 * A producer with taps left says how many; one that has run dry says how long
	 * until the next, because "wait" without a number is the most annoying thing
	 * a tile can say.
	 */
	_paintCharges(badge, item, now = Date.now()) {
		badge.textContent = item.charges > 0
			? String(item.charges)
			: Format.clock(Producers.nextChargeIn(item, now) / 1000);
	}

	/**
	 * The countdowns, and nothing else. Run every second, so it must not touch
	 * the art: rewriting a tile's sprite once a second would flicker and would
	 * cancel the pop it is in the middle of.
	 */
	tickBadges(now = Date.now()) {
		for (let index = 0; index < this._cells.length; index += 1) {
			const item = this._game.board.at(index);
			if (item === null || !Chains.isProducer(item) || item.charges > 0) continue;
			this._paintCharges(this._cells[index].querySelector(".badge"), item, now);
		}
	}

	/** Runs the pop on one cell, if it is still showing what popped. */
	celebrate(index) {
		const cell = this._cells[index];
		if (cell === undefined) return;
		cell.classList.remove("pop");
		// Reading the layout is what lets the same class animate twice in a row.
		void cell.offsetWidth;
		cell.classList.add("pop");
	}

	// --- The gesture -----------------------------------------------------------

	_onPointerDown(event) {
		if (event.button !== undefined && event.button > 0) return;
		const cell = event.target.closest(".cell");
		if (cell === null) return;
		const index = Number(cell.dataset.index);
		if (this._game.board.at(index) === null) {
			this.emit("tapped", index);
			return;
		}

		this._drag = {
			from: index,
			pointer: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			moved: false,
			ghost: null,
			over: -1,
		};

		const move = (moveEvent) => this._onPointerMove(moveEvent);
		const up = (upEvent) => {
			window.removeEventListener("pointermove", move);
			window.removeEventListener("pointerup", up);
			window.removeEventListener("pointercancel", up);
			this._onPointerUp(upEvent);
		};
		window.addEventListener("pointermove", move, { passive: false });
		window.addEventListener("pointerup", up);
		window.addEventListener("pointercancel", up);
	}

	_onPointerMove(event) {
		const drag = this._drag;
		if (drag === null || event.pointerId !== drag.pointer) return;

		if (!drag.moved) {
			const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
			if (distance < DRAG_THRESHOLD) return;
			drag.moved = true;
			this._lift(drag);
		}
		event.preventDefault();

		drag.ghost.style.transform = `translate(${event.clientX}px, ${event.clientY}px) translate(-50%, -50%)`;
		const over = this._cellAt(event.clientX, event.clientY);
		if (over !== drag.over) {
			this._markTarget(drag, over);
			drag.over = over;
		}
	}

	_onPointerUp(event) {
		const drag = this._drag;
		this._drag = null;
		if (drag === null) return;

		if (!drag.moved) {
			this.emit("tapped", drag.from);
			return;
		}

		drag.ghost.remove();
		this._cells[drag.from].classList.remove("lifted");
		this._markTarget(drag, -1);
		const to = this._cellAt(event.clientX, event.clientY);
		if (to !== -1 && to !== drag.from) this.emit("dragged", drag.from, to);
		else this.paint();
	}

	/** Picks the item up: a ghost under the finger, a hole where it was. */
	_lift(drag) {
		const item = this._game.board.at(drag.from);
		const ghost = document.createElement("div");
		ghost.className = "ghost";
		ghost.innerHTML = itemSprite(item);
		const box = this._cells[drag.from].getBoundingClientRect();
		ghost.style.width = `${box.width}px`;
		ghost.style.height = `${box.height}px`;
		document.body.append(ghost);
		drag.ghost = ghost;
		this._cells[drag.from].classList.add("lifted");
		this.emit("pickedUp", drag.from);
	}

	/** Rings the cell under the finger, and says whether letting go would merge. */
	_markTarget(drag, index) {
		for (const cell of this._cells) cell.classList.remove("over", "over-merge");
		if (index === -1 || index === drag.from) return;
		const source = this._game.board.at(drag.from);
		const target = this._game.board.at(index);
		this._cells[index].classList.add(Chains.canMerge(source, target) ? "over-merge" : "over");
	}

	/**
	 * Which cell a point is over, by dividing the board's box. The gap between
	 * two cells belongs to whichever is nearer, which is what a finger expects.
	 */
	_cellAt(clientX, clientY) {
		const box = this._root.getBoundingClientRect();
		if (clientX < box.left || clientX > box.right || clientY < box.top || clientY > box.bottom) return -1;
		const column = Math.min(COLUMNS - 1, Math.floor(((clientX - box.left) / box.width) * COLUMNS));
		const row = Math.min(ROWS - 1, Math.floor(((clientY - box.top) / box.height) * ROWS));
		return row * COLUMNS + column;
	}
}
