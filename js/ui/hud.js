/**
 * The top bar: level and experience, the purse, and the energy bar.
 *
 * Reads the game and writes text. The countdown to the next energy is the one
 * thing here that moves on its own, so the bar is ticked from the main loop
 * rather than only on an event.
 *
 * Emits: energyPressed(), coinsPressed(), levelPressed()
 */
import { Emitter } from "../util/emitter.js";
import { glyph } from "./sprites.js";
import * as Format from "../util/format.js";

export class Hud extends Emitter {
	constructor(root, game) {
		super();
		this._game = game;
		this._level = root.querySelector(".level-number");
		this._xpFill = root.querySelector(".xp-fill");
		this._xpText = root.querySelector(".xp-text");
		this._coins = root.querySelector("#coin-chip b");
		this._gems = root.querySelector("#gem-chip b");
		this._energy = root.querySelector("#energy-chip b");
		this._energyCap = root.querySelector("#energy-chip small");
		this._energyNext = root.querySelector("#energy-chip em");

		root.querySelector("#coin-chip .glyph").innerHTML = glyph("coin");
		root.querySelector("#gem-chip .glyph").innerHTML = glyph("gem");
		root.querySelector("#energy-chip .glyph").innerHTML = glyph("energy");

		root.querySelector("#energy-chip").addEventListener("click", () => this.emit("energyPressed"));
		root.querySelector("#coin-chip").addEventListener("click", () => this.emit("coinsPressed"));
		root.querySelector("#level-chip").addEventListener("click", () => this.emit("levelPressed"));

		for (const event of ["walletChanged", "energyChanged", "xpChanged", "levelUp"]) {
			game.on(event, () => this.refresh());
		}
	}

	refresh(now = Date.now()) {
		const game = this._game;
		this._level.textContent = String(game.level);
		const share = Math.max(0, Math.min(1, game.xp / game.xpNeeded));
		this._xpFill.style.width = `${(share * 100).toFixed(1)}%`;
		this._xpText.textContent = `${Format.count(game.xp)} / ${Format.count(game.xpNeeded)}`;
		this._coins.textContent = Format.count(game.coins);
		this._gems.textContent = Format.count(game.gems);
		this._energy.textContent = String(game.energy);
		this._energyCap.textContent = `/${game.energyCap}`;
		this.tick(now);
	}

	/** Only the countdown, cheap enough to run every second. */
	tick(now = Date.now()) {
		const waiting = this._game.energyIn(now);
		this._energyNext.textContent = waiting === 0 ? "full" : Format.clock(waiting / 1000);
	}
}
