/**
 * The harbour, and what it costs to put it back.
 *
 * The larger of the two things coins are for, the other being the chandler. Each
 * project wants a level as well as a price, so the money from a long night of
 * selling cannot skip the part of the game where you learn to merge.
 *
 * Rewards are deliberately not coins: experience, a bigger bar, another order
 * slot, or a producer dropped straight onto the board.
 */
export const PROJECTS = [
	{
		id: "jetty",
		name: "Clear the Jetty",
		blurb: "The storm left half a boat across it.",
		cost: 250,
		level: 1,
		xp: 120,
		drop: { chain: "crates", tier: 2 },
	},
	{
		id: "shed",
		name: "Re-roof the Sorting Shed",
		blurb: "Everything washed up ends up in here first.",
		cost: 750,
		level: 3,
		xp: 300,
		energyCap: 10,
		gems: 2,
	},
	{
		id: "baitshack",
		name: "Reopen the Bait Shack",
		blurb: "Sten has been fishing off the rocks for a month.",
		cost: 1800,
		level: 4,
		xp: 500,
		drop: { chain: "nets", tier: 2 },
		gems: 2,
	},
	{
		id: "boardwalk",
		name: "Rebuild the Boardwalk",
		blurb: "Visitors, and somewhere for them to walk.",
		cost: 4000,
		level: 6,
		xp: 900,
		orderSlots: 1,
		gems: 3,
	},
	{
		id: "kiosk",
		name: "Paint the Café Kiosk",
		blurb: "Marisol has opinions about the colour.",
		cost: 8000,
		level: 8,
		xp: 1400,
		drop: { chain: "galley", tier: 3 },
		gems: 3,
	},
	{
		id: "crane",
		name: "Restore the Cargo Crane",
		blurb: "Nothing heavy comes off a boat without it.",
		cost: 16000,
		level: 10,
		xp: 2200,
		energyCap: 15,
		gems: 4,
	},
	{
		id: "lighthouse",
		name: "Relight the Lighthouse",
		blurb: "Dark since the night of the storm.",
		cost: 32000,
		level: 12,
		xp: 3500,
		drop: { chain: "crates", tier: 3 },
		gems: 5,
	},
	{
		id: "slipway",
		name: "Rebuild the Slipway",
		blurb: "So the fleet can be hauled out and mended.",
		cost: 60000,
		level: 15,
		xp: 5000,
		orderSlots: 1,
		gems: 6,
	},
	{
		id: "museum",
		name: "Open the Salvage Museum",
		blurb: "Every strange thing the sea gave back.",
		cost: 120000,
		level: 18,
		xp: 8000,
		gems: 25,
	},
];

export function projectById(id) {
	return PROJECTS.find((project) => project.id === id) ?? null;
}
