/**
 * What each level hands over, and when a chain first appears.
 *
 * Levels do two jobs. They pace the chains -- coffee at 2, fishing at 4, so the
 * first board is one producer and one thing to merge rather than six of each --
 * and they top the player back up: every level refills the energy bar, which is
 * what makes an order worth filling on the evening you run dry.
 */

/**
 * Filling the bar and a gem are what every level carries; the table adds to it.
 * A gem a level is the floor under the only currency the game does not sell,
 * and it is what makes an energy refill something a patient player can reach.
 *
 * The producers dropped here are aimed at the chains the chandler charges most
 * for. Salvage already has the opening board and the jetty behind it, so a
 * fourth free cart would top the chain out on its own and leave the roastery and
 * the fishing boat to be paid for alone.
 */
export const LEVEL_REWARDS = {
	2: { coins: 150, gems: 1, drop: { chain: "galley", tier: 1 }, note: "The galley opens. Coffee gives energy back." },
	3: { coins: 250, gems: 2 },
	4: { coins: 400, gems: 1, drop: { chain: "nets", tier: 1 }, note: "Tackle unlocked. The bay is full of fish." },
	5: { coins: 600, gems: 1, orderSlots: 1, note: "A fourth order at a time." },
	6: { coins: 900, gems: 1, energyCap: 10, drop: { chain: "crates", tier: 2 } },
	7: { coins: 1300, gems: 3 },
	8: { coins: 1800, gems: 1, drop: { chain: "galley", tier: 2 } },
	9: { coins: 2400, gems: 1, energyCap: 10 },
	10: { coins: 3200, orderSlots: 1, gems: 4, note: "A fifth order at a time." },
	11: { coins: 4200, gems: 1, drop: { chain: "nets", tier: 2 } },
	12: { coins: 5500, gems: 1, energyCap: 10 },
	13: { coins: 7000, gems: 3 },
	14: { coins: 9000, gems: 1, drop: { chain: "nets", tier: 3 } },
	15: { coins: 12000, gems: 2, energyCap: 15 },
};

/** Past the table, every level is coins on a curve and a gem. */
export function rewardFor(level) {
	const listed = LEVEL_REWARDS[level];
	if (listed !== undefined) return listed;
	return { coins: Math.round(12000 * Math.pow(1.22, level - 15)), gems: 1 };
}

/** A chain the player has no producer for is a chain orders must not ask about. */
export const CHAIN_UNLOCK_LEVEL = {
	crates: 1,
	salvage: 1,
	galley: 2,
	cafe: 2,
	nets: 4,
	catch: 4,
};

export function chainsUnlockedAt(level) {
	return Object.keys(CHAIN_UNLOCK_LEVEL).filter((id) => level >= CHAIN_UNLOCK_LEVEL[id]);
}

/** What sits on the board the first time the game is opened. */
export const OPENING_BOARD = [
	{ chain: "crates", tier: 1 },
	{ chain: "crates", tier: 1 },
	{ chain: "salvage", tier: 1 },
	{ chain: "salvage", tier: 1 },
	{ chain: "salvage", tier: 2 },
];
