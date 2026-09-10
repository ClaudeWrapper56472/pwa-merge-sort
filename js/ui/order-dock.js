/**
 * The strip of orders along the bottom.
 *
 * Cards are rebuilt when the set of orders changes and only their tallies are
 * touched otherwise, so a board that changes twice a second does not throw away
 * the player's scroll position in the strip.
 *
 * Emits: deliverRequested(id), skipRequested(id)
 */
import { Emitter } from "../util/emitter.js";
import { itemSprite, glyph, portrait } from "./sprites.js";
import * as Chains from "../content/chains.js";
import * as Content from "../content/orders.js";
import * as Economy from "../economy.js";
import * as Format from "../util/format.js";

export class OrderDock extends Emitter {
	constructor(root, game) {
		super();
		this._root = root;
		this._game = game;
		this._built = "";

		root.addEventListener("click", (event) => {
			const card = event.target.closest(".order");
			if (card === null) return;
			const id = Number(card.dataset.id);
			if (event.target.closest(".skip") !== null) this.emit("skipRequested", id);
			else if (event.target.closest(".deliver") !== null) this.emit("deliverRequested", id);
		});
	}

	refresh() {
		const orders = this._game.orders;
		const signature = orders.map((order) => order.id).join(",");
		if (signature !== this._built) {
			this._built = signature;
			this._rebuild(orders);
			return;
		}
		for (const order of orders) this._paintTallies(order);
	}

	_rebuild(orders) {
		this._root.replaceChildren(...orders.map((order) => this._card(order)));
		for (const order of orders) this._paintTallies(order);
	}

	_card(order) {
		const customer = Content.customerById(order.customer);
		const reward = Economy.orderReward(order.lines, this._game.level);
		const card = document.createElement("article");
		card.className = "order";
		card.dataset.id = String(order.id);
		card.innerHTML = `
			<button type="button" class="skip" aria-label="Send this order away">×</button>
			<header>
				<span class="face">${portrait(order.customer)}</span>
				<span class="who">
					<b>${customer?.name ?? "Someone"}</b>
					<span>${customer?.role ?? ""}</span>
				</span>
			</header>
			<p class="note">${order.note ?? ""}</p>
			<ul class="wants"></ul>
			<p class="pay">
				<span>${glyph("coin")}${Format.count(reward.coins)}</span>
				<span>${glyph("xp")}${Format.count(reward.xp)}</span>
				${reward.gems > 0 ? `<span>${glyph("gem")}${reward.gems}</span>` : ""}
			</p>
			<button type="button" class="deliver">Deliver</button>`;

		const wants = card.querySelector(".wants");
		for (const line of order.lines) {
			const want = document.createElement("li");
			want.className = "want";
			want.dataset.key = `${line.chain}:${line.tier}`;
			want.innerHTML = `<span class="art">${itemSprite(line)}</span><span class="tally"></span>`;
			want.title = Chains.name(line);
			wants.append(want);
		}
		return card;
	}

	_paintTallies(order) {
		const card = this._root.querySelector(`.order[data-id="${order.id}"]`);
		if (card === null) return;
		for (const line of this._game.orderProgress(order)) {
			const want = card.querySelector(`.want[data-key="${line.chain}:${line.tier}"]`);
			if (want === null) continue;
			want.querySelector(".tally").textContent = `${line.have}/${line.count}`;
			want.classList.toggle("done", line.have >= line.count);
		}
		const ready = this._game.canDeliver(order);
		card.classList.toggle("ready", ready);
		card.querySelector(".deliver").disabled = !ready;
	}
}
