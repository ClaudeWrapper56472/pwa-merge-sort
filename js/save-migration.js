/**
 * The shape of a save, and how an older one becomes a current one.
 *
 * Pure functions over plain objects, so the whole thing runs under the
 * self-check with no browser anywhere near it. Nothing here validates an item:
 * Board and OrderBook drop what they cannot read when they restore, which keeps
 * the rules about what an item is in one place.
 */
import * as Economy from "./economy.js";

export const CURRENT_VERSION = 1;

export function emptyDocument() {
	return {
		version: CURRENT_VERSION,
		level: 1,
		xp: 0,
		coins: Economy.START.coins,
		gems: Economy.START.gems,
		energy: Economy.START.energy,
		energyCap: Economy.START.energyCap,
		energyAt: 0,
		orderSlots: Economy.START.orderSlots,
		board: null,
		orders: null,
		projects: [],
		bought: {},
		seen: [],
		drops: [],
		seed: null,
		stats: { merges: 0, orders: 0, sold: 0, produced: 0 },
		savedAt: 0,
		started: false,
	};
}

/**
 * Brings a stored document up to the current version, filling in anything a new
 * field expects. A document from the future is left alone rather than mangled;
 * the game reads what it recognises and ignores the rest.
 */
export function migrate(stored) {
	const document = { ...emptyDocument(), ...(stored ?? {}) };
	document.version = CURRENT_VERSION;

	document.level = clampInt(document.level, 1, 1);
	document.xp = clampInt(document.xp, 0, 0);
	document.coins = clampInt(document.coins, 0, 0);
	document.gems = clampInt(document.gems, 0, 0);
	document.energyCap = clampInt(document.energyCap, 1, Economy.START.energyCap);
	document.energy = Math.min(clampInt(document.energy, 0, 0), document.energyCap);
	document.orderSlots = clampInt(document.orderSlots, 1, Economy.START.orderSlots);
	document.projects = Array.isArray(document.projects) ? document.projects.filter((id) => typeof id === "string") : [];
	document.drops = Array.isArray(document.drops) ? document.drops : [];
	document.bought = typeof document.bought === "object" && document.bought !== null ? document.bought : {};
	document.seen = Array.isArray(document.seen) ? document.seen.filter((key) => typeof key === "string") : [];
	document.stats = { ...emptyDocument().stats, ...(document.stats ?? {}) };
	return document;
}

function clampInt(value, low, fallback) {
	const number = Math.floor(Number(value));
	return Number.isFinite(number) && number >= low ? number : fallback;
}
