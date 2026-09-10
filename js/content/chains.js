/**
 * Every item in the game, grouped into the chains you merge along.
 *
 * A chain is an ordered list of tiers. Two items of the same chain and tier
 * merge into one of the next tier up, and that single rule is the whole game;
 * everything else here is what a tier is worth, what it does when tapped, and
 * what a producer pops out.
 *
 * Three kinds of chain:
 *
 *   item      Plain goods. Orders ask for these, and they sell for coins.
 *   producer  Tapped to spend energy and pop out an item from the chain it
 *             feeds. Producers merge like anything else, and a bigger one is
 *             faster, deeper and holds more charges.
 *   energy    Tapped to be drunk. Gives energy back and leaves the board.
 *
 * An item is identified by `{ chain, tier }` everywhere, tier counting from 1.
 * Nothing stores a tier's name or value; those are looked up here so a rebalance
 * never has to touch a save.
 */

/**
 * The top tier of an item chain is worth more than its place on the curve, and
 * on purpose. Every other tier is worth about two and a half times the one
 * below, which an order for two of that lower tier beats on its own -- so the
 * last merge of a chain would be the one merge in the game that loses money.
 * A trophy pays for itself instead.
 *
 * The cafe needs none of this. Its top tier is drunk rather than sold, and
 * ninety energy already beats the two lattes that went into it.
 */

/**
 * Energy is only ever won back by merging. A tier-1 coffee cherry gives back
 * exactly what the tap that produced it cost, so a player who never merges runs
 * level for a while and then stops -- and two cherries make a bean worth three.
 * That is the pressure the whole economy sits on.
 *
 * Charges deliberately come back faster than energy does. Energy is the limiter;
 * charges are only a cap on how much of it can go into one producer at once, so
 * a full bar cannot be poured through a single sack in a minute. Two things
 * rationing the same tap at the same rate would just be a board that sits still.
 */
export const CHAINS = {
	crates: {
		id: "crates",
		name: "Salvage carts",
		kind: "producer",
		produces: "salvage",
		tiers: [
			{ name: "Canvas Sack", value: 12, cost: 1, charges: 8, recharge: 30, output: [85, 15] },
			{ name: "Salvage Crate", value: 30, cost: 1, charges: 12, recharge: 27, output: [60, 33, 7] },
			{ name: "Toolbox", value: 75, cost: 2, charges: 16, recharge: 24, output: [40, 38, 18, 4] },
			{ name: "Workbench", value: 190, cost: 2, charges: 20, recharge: 21, output: [0, 45, 33, 17, 5] },
			{ name: "Salvage Yard", value: 460, cost: 3, charges: 25, recharge: 18, output: [0, 30, 34, 24, 10, 2] },
		],
	},

	salvage: {
		id: "salvage",
		name: "Salvage",
		kind: "item",
		tiers: [
			{ name: "Rusty Bolt", value: 3 },
			{ name: "Brass Hinge", value: 8 },
			{ name: "Cog", value: 20 },
			{ name: "Block and Tackle", value: 48 },
			{ name: "Storm Lantern", value: 110 },
			{ name: "Ship's Anchor", value: 260 },
			{ name: "Brass Compass", value: 600 },
			{ name: "Ship in a Bottle", value: 2800 },
		],
	},

	galley: {
		id: "galley",
		name: "Galley",
		kind: "producer",
		produces: "cafe",
		tiers: [
			{ name: "Camp Kettle", value: 14, cost: 1, charges: 7, recharge: 34, output: [90, 10] },
			{ name: "Coffee Pot", value: 34, cost: 1, charges: 11, recharge: 30, output: [64, 30, 6] },
			{ name: "Coffee Cart", value: 84, cost: 2, charges: 15, recharge: 26, output: [44, 36, 16, 4] },
			{ name: "Café Counter", value: 210, cost: 2, charges: 19, recharge: 23, output: [0, 48, 33, 15, 4] },
			{ name: "Roastery", value: 500, cost: 3, charges: 24, recharge: 20, output: [0, 32, 36, 22, 8, 2] },
		],
	},

	cafe: {
		id: "cafe",
		name: "Café",
		kind: "energy",
		tiers: [
			{ name: "Coffee Cherry", value: 2, energy: 1 },
			{ name: "Roasted Bean", value: 5, energy: 3 },
			{ name: "Cup of Drip", value: 12, energy: 8 },
			{ name: "Espresso", value: 28, energy: 18 },
			{ name: "Latte", value: 65, energy: 40 },
			{ name: "Mocha Grande", value: 150, energy: 90 },
		],
	},

	nets: {
		id: "nets",
		name: "Tackle",
		kind: "producer",
		produces: "catch",
		tiers: [
			{ name: "Hand Line", value: 16, cost: 2, charges: 7, recharge: 36, output: [88, 12] },
			{ name: "Fishing Rod", value: 40, cost: 2, charges: 11, recharge: 32, output: [62, 31, 7] },
			{ name: "Cast Net", value: 96, cost: 3, charges: 15, recharge: 28, output: [42, 37, 17, 4] },
			{ name: "Trawl Net", value: 240, cost: 3, charges: 19, recharge: 24, output: [0, 46, 34, 16, 4] },
			{ name: "Fishing Boat", value: 560, cost: 4, charges: 24, recharge: 21, output: [0, 30, 36, 23, 9, 2] },
		],
	},

	catch: {
		id: "catch",
		name: "Catch",
		kind: "item",
		tiers: [
			{ name: "Minnow", value: 5 },
			{ name: "Sardine", value: 14 },
			{ name: "Mackerel", value: 34 },
			{ name: "Sea Bass", value: 80 },
			{ name: "Lobster", value: 190 },
			{ name: "Swordfish", value: 440 },
			{ name: "Pearl", value: 2200 },
		],
	},
};

/** Chain ids in the order panels list them: each producer, then what it feeds. */
export const CHAIN_ORDER = ["crates", "salvage", "galley", "cafe", "nets", "catch"];

export function chain(chainId) {
	return CHAINS[chainId] ?? null;
}

/** The tier record, or null for an item that names a chain or tier that is gone. */
export function tierOf(item) {
	const found = CHAINS[item?.chain];
	if (found === undefined) return null;
	return found.tiers[item.tier - 1] ?? null;
}

export function maxTier(chainId) {
	return CHAINS[chainId]?.tiers.length ?? 0;
}

export function name(item) {
	return tierOf(item)?.name ?? "Unknown";
}

export function isProducer(item) {
	return CHAINS[item?.chain]?.kind === "producer";
}

export function isEnergy(item) {
	return CHAINS[item?.chain]?.kind === "energy";
}

/** What tapping an energy item gives back. Zero for everything else. */
export function energyOf(item) {
	return isEnergy(item) ? tierOf(item)?.energy ?? 0 : 0;
}

/** What the item sells for. */
export function value(item) {
	return tierOf(item)?.value ?? 0;
}

/** At the top of its chain there is nothing left to merge into. */
export function isMaxed(item) {
	return item !== null && item.tier >= maxTier(item.chain);
}

export function canMerge(a, b) {
	if (a === null || b === null) return false;
	if (a.chain !== b.chain || a.tier !== b.tier) return false;
	return !isMaxed(a);
}

/** Rolls one item out of a producer. */
export function rollOutput(rng, producer) {
	const tier = tierOf(producer);
	if (tier?.output === undefined) return null;
	const produces = CHAINS[producer.chain].produces;
	return { chain: produces, tier: rng.pickWeighted(tier.output) + 1 };
}

/** Every tier of every chain, for the catalogue and for the self-check. */
export function allItems() {
	const items = [];
	for (const chainId of CHAIN_ORDER) {
		for (let tier = 1; tier <= maxTier(chainId); tier += 1) items.push({ chain: chainId, tier });
	}
	return items;
}
