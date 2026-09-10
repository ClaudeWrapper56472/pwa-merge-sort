/**
 * Every number the economy turns on, in one file.
 *
 * Shared by the running game, the panels that quote a price before you pay it,
 * and the self-check that proves an order is still worth more than selling the
 * items it asks for. Nothing here holds state.
 */
import * as Chains from "./content/chains.js";

/** One energy every two minutes, awake or closed. A full bar takes a little over three hours. */
export const ENERGY_REGEN_SECONDS = 120;

/** What a wallet starts with, and the bar it starts under. */
export const START = {
	energy: 60,
	energyCap: 100,
	coins: 120,
	gems: 3,
	orderSlots: 3,
};

/**
 * Gems buy time, never items: a full bar, or a producer that is ready now.
 *
 * They come from levels, which always pay at least one, from any order worth
 * enough to bother with, and from the harbour. Nothing about them is for sale.
 */
export const GEM_COSTS = {
	refill: 10,
	recharge: 3,
	skip: 1,
};

/**
 * An order pays more than the sum of what it asks for, or nobody would ever
 * hand anything over. The premium is what makes an order the reason to merge
 * and selling the thing you do with the leftovers.
 */
export const ORDER_PREMIUM = 1.9;

export function sellValue(item) {
	return Chains.value(item);
}

/** The coins, experience and gems for handing over a filled order. */
export function orderReward(lines, level) {
	let worth = 0;
	for (const line of lines) worth += Chains.value(line) * line.count;
	return {
		coins: Math.round(worth * ORDER_PREMIUM) + 8 * level,
		xp: Math.round(6 + worth * 0.5),
		gems: worth >= 500 ? 2 : worth >= 150 ? 1 : 0,
	};
}

/**
 * Experience to climb out of `level`.
 *
 * A tier is worth about two and a half times the one below it and orders climb a
 * tier every few levels, so the bar has to climb the same way or the early
 * levels take five orders and the late ones take fifty. It grows by a third a
 * level while orders are still climbing tiers. Around level fourteen they stop,
 * because there is no tier left to aim at, and the bar nearly stops with them.
 * The trophy that turns up after that is occasional rather than a rung, so it
 * pays for itself in one card instead of raising what a level asks for.
 */
export function xpForLevel(level) {
	let xp = 50;
	for (let step = 1; step < level; step += 1) xp *= step < 14 ? 1.34 : 1.06;
	return Math.round(xp);
}
