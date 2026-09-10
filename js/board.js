/**
 * The grid the game is played on.
 *
 * A flat array of cells, each holding an item or nothing. The board knows the
 * three things a drag can mean and nothing about what any of them are worth --
 * merging pays out in coins and experience, and that is GameState's business.
 */
import * as Chains from "./content/chains.js";
import * as Producers from "./producers.js";

export const COLUMNS = 7;
export const ROWS = 9;
export const CELLS = COLUMNS * ROWS;

export class Board {
	constructor() {
		this._cells = new Array(CELLS).fill(null);
	}

	at(index) {
		return this._cells[index] ?? null;
	}

	cells() {
		return this._cells;
	}

	isEmpty(index) {
		return this._cells[index] === null;
	}

	occupied() {
		return this._cells.reduce((total, cell) => total + (cell === null ? 0 : 1), 0);
	}

	isFull() {
		return this.occupied() >= CELLS;
	}

	put(index, item) {
		this._cells[index] = item;
	}

	clear(index) {
		this._cells[index] = null;
	}

	/** How many of a given item are on the board, for an order's have-count. */
	countOf(chain, tier) {
		let total = 0;
		for (const cell of this._cells) {
			if (cell !== null && cell.chain === chain && cell.tier === tier) total += 1;
		}
		return total;
	}

	/** Every index holding a given item, low to high. */
	indexesOf(chain, tier) {
		const found = [];
		for (let index = 0; index < CELLS; index += 1) {
			const cell = this._cells[index];
			if (cell !== null && cell.chain === chain && cell.tier === tier) found.push(index);
		}
		return found;
	}

	/**
	 * Whether the board holds every one of a list of `{ chain, tier, count }`.
	 * What an order asks for, and what a project does.
	 */
	holds(wants) {
		return wants.every((want) => this.countOf(want.chain, want.tier) >= want.count);
	}

	/** Takes a list of wants off the board. Checked with `holds` first. */
	take(wants) {
		for (const want of wants) {
			for (const index of this.indexesOf(want.chain, want.tier).slice(0, want.count)) {
				this.clear(index);
			}
		}
	}

	firstEmpty() {
		return this._cells.indexOf(null);
	}

	/**
	 * The free cell closest to `index`, searched in rings so a produced item
	 * lands beside the thing that made it rather than at the top of the board.
	 */
	nearestEmpty(index) {
		if (this.isEmpty(index)) return index;
		const fromColumn = index % COLUMNS;
		const fromRow = Math.floor(index / COLUMNS);
		for (let ring = 1; ring < Math.max(COLUMNS, ROWS); ring += 1) {
			let best = -1;
			let bestDistance = Infinity;
			for (let row = fromRow - ring; row <= fromRow + ring; row += 1) {
				for (let column = fromColumn - ring; column <= fromColumn + ring; column += 1) {
					if (row < 0 || row >= ROWS || column < 0 || column >= COLUMNS) continue;
					if (Math.max(Math.abs(row - fromRow), Math.abs(column - fromColumn)) !== ring) continue;
					const candidate = row * COLUMNS + column;
					if (!this.isEmpty(candidate)) continue;
					// Ties inside a ring go to the nearest in a straight line, which
					// keeps a pile growing outwards rather than along a diagonal.
					const distance = (row - fromRow) ** 2 + (column - fromColumn) ** 2;
					if (distance < bestDistance) {
						bestDistance = distance;
						best = candidate;
					}
				}
			}
			if (best !== -1) return best;
		}
		return -1;
	}

	/**
	 * A drag from one cell to another. Everything a drag can mean is here, and
	 * the caller is told which of them happened:
	 *
	 *   merge   two of a kind, one tier up in the cell the drag ended on
	 *   move    onto empty space
	 *   swap    onto anything else
	 *   none    the same cell, or a drag from nothing
	 */
	drag(from, to, now) {
		if (from === to) return { type: "none" };
		const source = this.at(from);
		if (source === null) return { type: "none" };
		const target = this.at(to);

		if (target === null) {
			this._cells[to] = source;
			this._cells[from] = null;
			return { type: "move", item: source, at: to };
		}

		if (Chains.canMerge(source, target)) {
			const tier = source.tier + 1;
			const item = Chains.isProducer(source)
				? Producers.merged(source.chain, tier, source, target, now)
				: { chain: source.chain, tier };
			this._cells[to] = item;
			this._cells[from] = null;
			return { type: "merge", item, at: to, from: source };
		}

		this._cells[to] = source;
		this._cells[from] = target;
		return { type: "swap", item: source, at: to };
	}

	/** Brings every producer's charges up to date. True if any of them moved. */
	refresh(now) {
		let changed = false;
		for (const cell of this._cells) {
			if (cell !== null && Producers.refresh(cell, now)) changed = true;
		}
		return changed;
	}

	serialize() {
		return this._cells.map((cell) => {
			if (cell === null) return null;
			const record = { c: cell.chain, t: cell.tier };
			if (cell.charges !== undefined) {
				record.n = cell.charges;
				record.a = cell.chargedAt;
			}
			return record;
		});
	}

	/**
	 * Rebuilds from a saved board, dropping anything that no longer names a real
	 * item. A chain removed in an update costs the player those cells and not the
	 * whole save.
	 */
	restore(records, now) {
		this._cells = new Array(CELLS).fill(null);
		if (!Array.isArray(records)) return;
		for (let index = 0; index < Math.min(records.length, CELLS); index += 1) {
			const record = records[index];
			if (record === null || typeof record !== "object") continue;
			const item = { chain: record.c, tier: record.t };
			if (Chains.tierOf(item) === null) continue;
			if (Chains.isProducer(item)) {
				item.charges = Math.min(Producers.capacity(item), Math.max(0, record.n ?? 0));
				item.chargedAt = Number.isFinite(record.a) ? record.a : now;
			}
			this._cells[index] = item;
		}
	}
}
