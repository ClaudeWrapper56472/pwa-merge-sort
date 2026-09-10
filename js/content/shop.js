/**
 * The chandler: producers, for coins.
 *
 * The harbour is a finite list, so without this coins stop meaning anything the
 * moment the last project is paid for -- and a player who has been selling all
 * evening ends up with a purse and nothing to want. A producer is the one thing
 * worth buying: another sack is another six taps an hour, which is the only
 * thing that actually makes a board move faster.
 *
 * The price climbs with every one bought, so coins never buy a floor covered in
 * producers, and each new one costs the sort of money the sale of a good tier
 * takes to raise. That last part sets the rate: a chain tops out at its fifth
 * tier, which is sixteen tier ones, and the levels and the harbour hand over
 * only some of them. The rest are bought, so the tenth has to still be priced
 * like an item rather than like a harbour project.
 */
export const STOCK = [
	{
		chain: "crates",
		name: "Canvas Sack",
		blurb: "Another pair of hands on the salvage.",
		base: 350,
		level: 1,
	},
	{
		chain: "galley",
		name: "Camp Kettle",
		blurb: "More coffee is more energy.",
		base: 700,
		level: 2,
	},
	{
		chain: "nets",
		name: "Hand Line",
		blurb: "Another line in the water.",
		base: 1100,
		level: 4,
	},
];

/** Each one bought makes the next dearer, so this is a sink and never a strategy. */
export function priceOf(entry, bought) {
	return Math.round(entry.base * Math.pow(CLIMB, bought));
}

/**
 * How much dearer each one makes the next. Enough that a floor of producers is
 * never the cheap answer, and no more: a tenth sack costs twenty times the
 * first, not two hundred times it, so the top of a chain is somewhere a player
 * gets to rather than somewhere the price list quietly closes off.
 */
const CLIMB = 1.35;

export function stockFor(chainId) {
	return STOCK.find((entry) => entry.chain === chainId) ?? null;
}
