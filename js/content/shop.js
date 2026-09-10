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
 * takes to raise.
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
	return Math.round(entry.base * Math.pow(1.7, bought));
}

export function stockFor(chainId) {
	return STOCK.find((entry) => entry.chain === chainId) ?? null;
}
