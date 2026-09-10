/**
 * The strip under the board that says what you just touched.
 *
 * It is also where an item leaves the game: selling is the only way to make
 * room on a full board, so the button sits on whatever the player last put a
 * finger on rather than behind a menu.
 *
 * Emits: sellRequested(index), rechargeRequested(index), closed()
 */
import { Emitter } from "../util/emitter.js";
import { itemSprite, glyph } from "./sprites.js";
import * as Chains from "../content/chains.js";
import * as Producers from "../producers.js";
import * as Economy from "../economy.js";
import * as Format from "../util/format.js";

export class ItemBar extends Emitter {
	constructor(root, game, settings) {
		super();
		this._root = root;
		this._game = game;
		this._settings = settings;
		this._index = -1;
		this._confirming = false;

		this._art = root.querySelector(".item-art");
		this._name = root.querySelector(".item-name");
		this._detail = root.querySelector(".item-detail");
		this._sell = root.querySelector(".item-sell");
		this._recharge = root.querySelector(".item-recharge");

		this._sell.addEventListener("click", () => this._onSell());
		this._recharge.addEventListener("click", () => this.emit("rechargeRequested", this._index));
		root.querySelector(".item-close").addEventListener("click", () => {
			this.hide();
			this.emit("closed");
		});
	}

	get index() {
		return this._index;
	}

	show(index, now = Date.now()) {
		const item = this._game.board.at(index);
		if (item === null) {
			this.hide();
			return;
		}
		this._index = index;
		this._confirming = false;
		this._root.hidden = false;
		this.refresh(now);
	}

	hide() {
		this._index = -1;
		this._confirming = false;
		this._root.hidden = true;
	}

	refresh(now = Date.now()) {
		if (this._index < 0) return;
		const item = this._game.board.at(this._index);
		if (item === null) {
			this.hide();
			return;
		}

		this._art.innerHTML = itemSprite(item);
		this._name.textContent = Chains.name(item);
		this._detail.innerHTML = this._detailFor(item, now);

		this._sell.innerHTML = this._confirming
			? "Sure?"
			: `Sell ${glyph("coin")}${Format.count(Economy.sellValue(item))}`;
		this._sell.classList.toggle("confirming", this._confirming);

		const producer = Chains.isProducer(item);
		const full = producer && item.charges >= Producers.capacity(item);
		this._recharge.hidden = !producer || full;
		if (producer && !full) {
			this._recharge.innerHTML = `Fill ${glyph("gem")}${Economy.GEM_COSTS.recharge}`;
			this._recharge.disabled = this._game.gems < Economy.GEM_COSTS.recharge;
		}
	}

	/** The one line under the name: what this item is for. */
	_detailFor(item, now) {
		const tier = `Tier ${item.tier} of ${Chains.maxTier(item.chain)}`;
		if (Chains.isProducer(item)) {
			const capacity = Producers.capacity(item);
			const waiting = Producers.nextChargeIn(item, now);
			const clock = item.charges >= capacity ? "full" : `next in ${Format.clock(waiting / 1000)}`;
			return `${tier} · ${item.charges}/${capacity} taps · ${clock} · ${Producers.energyCost(item)} energy a tap`;
		}
		if (Chains.isEnergy(item)) return `${tier} · tap to drink for ${Chains.energyOf(item)} energy`;
		if (Chains.isMaxed(item)) return `${tier} · the top of its chain`;
		return `${tier} · merge two for a ${Chains.name({ chain: item.chain, tier: item.tier + 1 })}`;
	}

	/**
	 * Selling a producer you spent an evening merging would be a disaster in one
	 * tap, so anything worth confirming asks once. The setting turns it off for
	 * players clearing tier-one clutter by the handful.
	 */
	_onSell() {
		const item = this._game.board.at(this._index);
		if (item === null) return;
		const risky = Chains.isProducer(item) || item.tier >= 3;
		if (this._settings.get("confirmSell") && risky && !this._confirming) {
			this._confirming = true;
			this.refresh();
			return;
		}
		this.emit("sellRequested", this._index);
	}
}
