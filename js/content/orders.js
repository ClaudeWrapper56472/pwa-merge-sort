/**
 * The townsfolk, and the rule for what they ask for.
 *
 * Requests are rolled rather than written out, because a hand-written list runs
 * out and the game does not. What is written is the flavour: who is asking and
 * why, so a board full of cogs is a harbourmaster with a jammed crane rather
 * than a quota.
 *
 * Pure: give it a seeded generator and it gives back the same order every time.
 */
import * as Chains from "./chains.js";

export const CUSTOMERS = [
	{
		id: "nell",
		name: "Nell",
		role: "harbourmaster",
		prefers: "salvage",
		asks: [
			"The crane's seized again.",
			"For the winch, before the tide turns.",
			"I'm not signing anything off without these.",
		],
	},
	{
		id: "otto",
		name: "Otto",
		role: "boatwright",
		prefers: "salvage",
		asks: [
			"Half a hull to plank and nothing to fix it with.",
			"Bring it to the slipway when you have it.",
			"I can make do, but I'd rather not.",
		],
	},
	{
		id: "marisol",
		name: "Marisol",
		role: "runs the kiosk",
		prefers: "cafe",
		asks: [
			"The morning rush starts in an hour.",
			"I've a queue and an empty counter.",
			"Nobody walks the boardwalk without one of these.",
		],
	},
	{
		id: "sten",
		name: "Sten",
		role: "fisherman",
		prefers: "catch",
		asks: [
			"The bay's been kind. My arms have not.",
			"For the market stall, first thing.",
			"Weigh it, wrap it, don't ask where it came from.",
		],
	},
	{
		id: "pim",
		name: "Pim",
		role: "lighthouse keeper",
		prefers: "salvage",
		asks: [
			"It's a long walk back up if I forget something.",
			"The lamp room eats these.",
			"Dark by five. I'd like to be ready.",
		],
	},
	{
		id: "greta",
		name: "Greta",
		role: "keeps the museum",
		prefers: "catch",
		asks: [
			"For the cabinet by the door.",
			"Everything the sea gives back has a label waiting.",
			"Handle it gently, it's going behind glass.",
		],
	},
	{
		id: "abel",
		name: "Abel",
		role: "ferry captain",
		prefers: "cafe",
		asks: [
			"Four crossings today and I've not sat down.",
			"Something for the wheelhouse.",
			"The passengers can wait. This can't.",
		],
	},
	{
		id: "juno",
		name: "Juno",
		role: "diver",
		prefers: "salvage",
		asks: [
			"There's more down there, but I need this first.",
			"For the wreck on the north bank.",
			"Cold water, short air, long list.",
		],
	},
	{
		id: "wren",
		name: "Wren",
		role: "market trader",
		prefers: "catch",
		asks: [
			"I've buyers and no stock.",
			"Saturday crowd, and they're picky.",
			"Whatever you've got, I'll shift it.",
		],
	},
	{
		id: "hal",
		name: "Hal",
		role: "night watchman",
		prefers: "cafe",
		asks: [
			"It's a long shift and a longer pier.",
			"Keeps me upright until six.",
			"One for the walk, one for the hut.",
		],
	},
];

/** Chains an order may ask for: the goods, never the producers that make them. */
const ASKABLE = ["salvage", "cafe", "catch"];

/** How many separate items an order asks for, as the player gets faster. */
function lineCount(rng, level) {
	if (level < 3) return 1;
	if (level < 8) return rng.randiRange(1, 2);
	return rng.randiRange(1, 3);
}

/**
 * Nothing is ever asked for that a producer makes directly.
 *
 * A tier one is two taps and no thought: an order for three rusty bolts is a
 * chore rather than a puzzle, and it teaches the player that orders are
 * something to be endured. Everything on a card has to have been merged at
 * least once.
 */
const LOWEST_TIER = 2;

/**
 * The tier an order aims at, one step below what the player can comfortably
 * reach. Orders that ask for the top of a chain would be asking for the whole
 * board, so the centre stops two short of it.
 */
function centreTier(chainId, level) {
	const top = Chains.maxTier(chainId);
	const reach = LOWEST_TIER + Math.floor((level - 1) * 0.4);
	return Math.min(Math.max(LOWEST_TIER, reach), Math.max(LOWEST_TIER, top - 2));
}

function rollTier(rng, chainId, level) {
	const centre = centreTier(chainId, level);
	const offset = rng.pickWeighted([25, 50, 25]) - 1;
	const top = Chains.maxTier(chainId);
	return Math.min(Math.max(LOWEST_TIER, centre + offset), Math.max(LOWEST_TIER, top - 1));
}

/** The cheapest tier comes in handfuls; anything the player had to work for comes as one. */
function rollCount(rng, tier) {
	if (tier === LOWEST_TIER) return rng.randiRange(2, 3);
	if (tier === LOWEST_TIER + 1) return rng.randiRange(1, 2);
	return 1;
}

/**
 * One order for a player at `level` who has unlocked `chains`.
 *
 * The customer's preferred chain gets the first line when it is available, so
 * the fisherman asks for fish; the rest are drawn from whatever else is open.
 *
 * `waiting` is who is already on the order board. Nobody stands in the queue
 * twice: two cards from the same person read as a bug rather than as a busy
 * morning, and there are twice as many townsfolk as there are slots.
 */
export function rollOrder(rng, { level, chains, waiting = [] }) {
	const open = ASKABLE.filter((id) => chains.includes(id));
	if (open.length === 0) return null;

	const free = CUSTOMERS.filter((one) => !waiting.includes(one.id));
	// Everyone already waiting can only happen if the slots outgrow the town.
	const available = free.length > 0 ? free : CUSTOMERS;
	const customer = rng.pick(available.filter((one) => open.includes(one.prefers))) ?? rng.pick(available);
	const wanted = Math.min(lineCount(rng, level), open.length);

	const pool = rng.shuffle([...open]);
	if (open.includes(customer.prefers)) {
		pool.splice(pool.indexOf(customer.prefers), 1);
		pool.unshift(customer.prefers);
	}

	const lines = pool.slice(0, wanted).map((chainId) => {
		const tier = rollTier(rng, chainId, level);
		return { chain: chainId, tier, count: rollCount(rng, tier) };
	});

	return {
		customer: customer.id,
		note: rng.pick(customer.asks),
		lines,
	};
}

export function customerById(id) {
	return CUSTOMERS.find((one) => one.id === id) ?? null;
}
