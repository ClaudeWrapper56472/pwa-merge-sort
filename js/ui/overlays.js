/**
 * The cards that stop the game for a moment.
 *
 * A level and a welcome-back can land in the same instant -- coming back to a
 * full bar and delivering the order that was already filled -- so they queue
 * rather than overwrite each other, and the player reads them one at a time.
 */
import { itemSprite, glyph } from "./sprites.js";
import * as Chains from "../content/chains.js";
import * as Format from "../util/format.js";

export class Overlays {
	constructor(root) {
		this._root = root;
		this._title = root.querySelector(".card-title");
		this._lead = root.querySelector(".card-lead");
		this._list = root.querySelector(".card-list");
		this._queue = [];

		root.querySelector(".card-close").addEventListener("click", () => this._next());
	}

	/** A level gained, and what came with it. */
	levelUp(level, reward) {
		const lines = [`${glyph("energy")}Energy bar filled`];
		if (reward.coins) lines.push(`${glyph("coin")}${Format.count(reward.coins)} coins`);
		if (reward.gems) lines.push(`${glyph("gem")}${reward.gems} gems`);
		if (reward.energyCap) lines.push(`${glyph("energy")}+${reward.energyCap} to the bar`);
		if (reward.orderSlots) lines.push(`${glyph("basket")}Another order at a time`);
		if (reward.drop) lines.push(`${itemSprite(reward.drop)}${Chains.name(reward.drop)}`);
		this._push({ title: `Level ${level}`, lead: reward.note ?? "The depot is getting somewhere.", lines });
	}

	/** What came in while the tab was closed. */
	caughtUp({ away, energy, charges }) {
		const lines = [];
		if (energy > 0) lines.push(`${glyph("energy")}+${energy} energy`);
		if (charges > 0) lines.push(`${glyph("clock")}+${charges} producer taps`);
		this._push({
			title: "Welcome back",
			lead: `The depot kept working for ${Format.clock(away / 1000)}.`,
			lines,
		});
	}

	_push(card) {
		this._queue.push(card);
		if (this._root.hidden) this._show();
	}

	_show() {
		const card = this._queue[0];
		if (card === undefined) return;
		this._title.textContent = card.title;
		this._lead.textContent = card.lead;
		this._list.replaceChildren(...card.lines.map((line) => {
			const item = document.createElement("li");
			item.innerHTML = line;
			return item;
		}));
		this._root.hidden = false;
	}

	_next() {
		this._queue.shift();
		this._root.hidden = true;
		if (this._queue.length > 0) this._show();
	}
}
