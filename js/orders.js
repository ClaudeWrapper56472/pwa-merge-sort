/**
 * The order board: who is waiting, and what for.
 *
 * Orders are the reason to merge. A slot is never left empty -- one goes out,
 * another comes in -- so the question in front of the player is always which of
 * the three or four to work towards rather than whether there is anything to do.
 *
 * An order is only ever handed over whole. Filling half of one and losing the
 * rest to a sell would be a trap, and a half-filled order that the player has to
 * remember the state of is a worse one.
 */
import * as Chains from "./content/chains.js";
import * as Content from "./content/orders.js";
import * as Economy from "./economy.js";

export class OrderBook {
	constructor(rng) {
		this._rng = rng;
		this._orders = [];
		this._nextId = 1;
	}

	list() {
		return this._orders;
	}

	byId(id) {
		return this._orders.find((order) => order.id === id) ?? null;
	}

	/** Tops the board up to `slots`, and trims it when a slot is somehow lost. */
	refill(slots, level, chains) {
		let added = 0;
		while (this._orders.length > slots) this._orders.pop();
		while (this._orders.length < slots) {
			const waiting = this._orders.map((order) => order.customer);
			const rolled = Content.rollOrder(this._rng, { level, chains, waiting });
			if (rolled === null) break;
			this._orders.push({ id: this._nextId, ...rolled });
			this._nextId += 1;
			added += 1;
		}
		return added;
	}

	/** Line by line, what the board has against what the order wants. */
	progress(board, order) {
		return order.lines.map((line) => ({
			...line,
			have: Math.min(board.countOf(line.chain, line.tier), line.count),
		}));
	}

	canDeliver(board, order) {
		return order.lines.every((line) => board.countOf(line.chain, line.tier) >= line.count);
	}

	/**
	 * Takes the items off the board and gives back the reward, or null when the
	 * order is not actually filled. Checked here rather than trusted from the
	 * panel, because the board can change between a button being drawn and pressed.
	 */
	deliver(board, order, level) {
		if (!this.canDeliver(board, order)) return null;
		for (const line of order.lines) {
			for (const index of board.indexesOf(line.chain, line.tier).slice(0, line.count)) {
				board.clear(index);
			}
		}
		this._remove(order.id);
		return Economy.orderReward(order.lines, level);
	}

	/** Sends one order away unfilled. The slot refills on the next top-up. */
	skip(id) {
		const order = this.byId(id);
		if (order === null) return false;
		this._remove(id);
		return true;
	}

	_remove(id) {
		this._orders = this._orders.filter((order) => order.id !== id);
	}

	serialize() {
		return { next: this._nextId, orders: this._orders };
	}

	restore(record) {
		if (record === null || typeof record !== "object") return;
		this._nextId = Number.isFinite(record.next) ? record.next : 1;
		const orders = Array.isArray(record.orders) ? record.orders : [];
		// Anything that no longer names a real customer or a real item is dropped;
		// the next top-up fills the slot it leaves.
		this._orders = orders.filter((order) => (
			order !== null
			&& Content.customerById(order.customer) !== null
			&& Array.isArray(order.lines)
			&& order.lines.length > 0
			&& order.lines.every((line) => Chains.tierOf(line) !== null && Number.isFinite(line.count))
		));
		for (const order of this._orders) {
			if (!Number.isFinite(order.id)) order.id = this._nextId++;
		}
	}
}
