/**
 * Self-check for the game layer.
 *
 *     node tests/verify.mjs
 *
 * Nothing here touches the DOM, so the whole layer runs under plain Node. Plain
 * assertions rather than a framework, so it runs with nothing installed.
 *
 * The one view file included is sprites.js, which is string building rather than
 * drawing: it is here because a typo in a path attribute produces markup that
 * renders as nothing at all, and nothing at all is exactly what a board of items
 * looks like when it is working.
 */
import * as Chains from "../js/content/chains.js";
import * as Content from "../js/content/orders.js";
import * as Progression from "../js/content/progression.js";
import * as Projects from "../js/content/projects.js";
import * as Shop from "../js/content/shop.js";
import * as Economy from "../js/economy.js";
import * as Producers from "../js/producers.js";
import * as Migration from "../js/save-migration.js";
import { Board, CELLS, COLUMNS } from "../js/board.js";
import { OrderBook } from "../js/orders.js";
import { GameState } from "../js/game-state.js";
import { Emitter } from "../js/util/emitter.js";
import { Rng } from "../js/util/rng.js";
import * as Format from "../js/util/format.js";
import { itemSprite, glyph, portrait } from "../js/ui/sprites.js";

// GameState draws its first seed from the platform, which Node has had as a
// global since 18 and under another name before that.
globalThis.crypto ??= (await import("node:crypto")).webcrypto;

let passed = 0;
const failures = [];
let suite = "";

function group(name) {
	suite = name;
	process.stdout.write(`\n${name}\n`);
}

function check(message, condition) {
	if (condition) {
		passed += 1;
		return;
	}
	failures.push(`${suite}: ${message}`);
	process.stdout.write(`  FAIL  ${message}\n`);
}

function eq(message, actual, expected) {
	const ok = JSON.stringify(actual) === JSON.stringify(expected);
	if (!ok) process.stdout.write(`         got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}\n`);
	check(message, ok);
}

const MINUTE = 60 * 1000;

/** Stands in for SaveManager: holds a document, and hands it back on request. */
class FakeSave extends Emitter {
	constructor(document = Migration.emptyDocument()) {
		super();
		this._document = document;
		this.writes = 0;
	}

	document() {
		return this._document;
	}

	flush() {
		this.writes += 1;
		this.emit("saveRequested");
	}

	submit(state) {
		this._document = { ...this._document, ...state };
	}
}

/** A game that has been started, with the clock held still at `now`. */
function startedGame(now, document) {
	const save = new FakeSave(document);
	const game = new GameState(save);
	game.start(now);
	return { game, save };
}

const findIndex = (board, chain) => board.cells().findIndex((cell) => cell !== null && cell.chain === chain);

// --- Content ----------------------------------------------------------------

group("Chains");
{
	eq("thirty-six items", Chains.allItems().length, 36);
	eq("every chain is listed once", new Set(Chains.CHAIN_ORDER).size, Chains.CHAIN_ORDER.length);

	for (const chainId of Chains.CHAIN_ORDER) {
		const chain = Chains.chain(chainId);
		check(`${chainId} has a name`, typeof chain.name === "string" && chain.name.length > 0);
		check(`${chainId} has tiers`, chain.tiers.length >= 5);

		let previous = 0;
		let rising = true;
		for (const tier of chain.tiers) {
			if (!(tier.value > previous)) rising = false;
			previous = tier.value;
			check(`${chainId}: every tier is named`, typeof tier.name === "string" && tier.name.length > 0);
		}
		check(`${chainId}: a tier is always worth more than the one below`, rising);
	}

	for (const chainId of Chains.CHAIN_ORDER) {
		const chain = Chains.chain(chainId);
		if (chain.kind !== "producer") continue;
		check(`${chainId} produces a real chain`, Chains.chain(chain.produces) !== null);
		const produced = Chains.maxTier(chain.produces);
		for (const tier of chain.tiers) {
			check(`${chainId}: a tap costs energy`, tier.cost >= 1);
			check(`${chainId}: taps to spend`, tier.charges >= 1);
			check(`${chainId}: charges come back`, tier.recharge > 0);
			check(`${chainId}: outputs stay inside the chain it feeds`, tier.output.length <= produced);
			check(`${chainId}: some output is possible`, tier.output.some((weight) => weight > 0));
		}
	}

	for (const tier of Chains.chain("cafe").tiers) {
		check("every café tier gives energy back", tier.energy >= 1);
	}
	// The whole economy leans on this: two of a thing are worth more than the
	// two taps that made them, and only because merging multiplies.
	const cafe = Chains.chain("cafe").tiers;
	let multiplies = true;
	for (let tier = 1; tier < cafe.length; tier += 1) {
		if (cafe[tier].energy <= cafe[tier - 1].energy * 2) multiplies = false;
	}
	check("merging coffee beats drinking both halves", multiplies);
}

group("Item rules");
{
	const bolt = { chain: "salvage", tier: 1 };
	const hinge = { chain: "salvage", tier: 2 };
	const bottle = { chain: "salvage", tier: 8 };
	const minnow = { chain: "catch", tier: 1 };

	eq("names come from the chain", Chains.name(hinge), "Brass Hinge");
	eq("an unknown item has no tier", Chains.tierOf({ chain: "nope", tier: 1 }), null);
	check("two of a kind merge", Chains.canMerge(bolt, { ...bolt }));
	check("different tiers do not", !Chains.canMerge(bolt, hinge));
	check("different chains do not", !Chains.canMerge(bolt, minnow));
	check("the top of a chain does not", !Chains.canMerge(bottle, { ...bottle }));
	check("the top of a chain knows it", Chains.isMaxed(bottle) && !Chains.isMaxed(bolt));
	check("producers are producers", Chains.isProducer({ chain: "crates", tier: 1 }));
	check("goods are not", !Chains.isProducer(bolt));
	eq("energy only comes from the café", Chains.energyOf(bolt), 0);
	check("the café gives energy", Chains.energyOf({ chain: "cafe", tier: 3 }) > 0);
}

group("Producer output");
{
	const rng = new Rng(11);
	const producer = { chain: "crates", tier: 1 };
	const seen = new Set();
	for (let roll = 0; roll < 400; roll += 1) {
		const item = Chains.rollOutput(rng, producer);
		seen.add(item.tier);
		check("a sack only ever makes salvage", item.chain === "salvage");
		check("a sack never makes more than it should", item.tier <= 2);
	}
	eq("both of a sack's outcomes turn up", [...seen].sort(), [1, 2]);

	// A zero weight is a promise that the tier never appears, which is what makes
	// the bigger producers feel different rather than merely luckier.
	const yard = { chain: "crates", tier: 5 };
	let lowest = 9;
	for (let roll = 0; roll < 400; roll += 1) lowest = Math.min(lowest, Chains.rollOutput(rng, yard).tier);
	eq("a salvage yard never drops the bottom tier", lowest, 2);
}

group("Progression and the harbour");
{
	for (const [level, reward] of Object.entries(Progression.LEVEL_REWARDS)) {
		if (reward.drop === undefined) continue;
		check(`level ${level} drops a real item`, Chains.tierOf(reward.drop) !== null);
	}
	for (const item of Progression.OPENING_BOARD) {
		check("the opening board is all real items", Chains.tierOf(item) !== null);
	}
	check("a producer opens before the chain it feeds is asked for",
		Progression.CHAIN_UNLOCK_LEVEL.galley <= Progression.CHAIN_UNLOCK_LEVEL.cafe
		&& Progression.CHAIN_UNLOCK_LEVEL.nets <= Progression.CHAIN_UNLOCK_LEVEL.catch);
	eq("nothing but salvage at the start", Progression.chainsUnlockedAt(1).sort(), ["crates", "salvage"]);
	check("the café opens at two", Progression.chainsUnlockedAt(2).includes("cafe"));
	check("fishing opens at four", Progression.chainsUnlockedAt(4).includes("catch"));
	check("past the table, levels still pay", Progression.rewardFor(40).coins > 0);

	let cost = 0;
	let level = 0;
	let ordered = true;
	for (const project of Projects.PROJECTS) {
		if (project.cost <= cost || project.level < level) ordered = false;
		cost = project.cost;
		level = project.level;
		check(`${project.id} pays experience`, project.xp > 0);
		if (project.drop !== undefined) {
			check(`${project.id} drops a real item`, Chains.tierOf(project.drop) !== null);
		}
	}
	check("projects get dearer and later as the list goes on", ordered);
	eq("projects are found by id", Projects.projectById("jetty").name, "Clear the Jetty");
	eq("an unknown project is nothing", Projects.projectById("nope"), null);
}

group("The chandler");
{
	for (const entry of Shop.STOCK) {
		check(`${entry.name} is a real producer`, Chains.isProducer({ chain: entry.chain, tier: 1 }));
		check(`${entry.name} costs something`, entry.base > 0);
		check(`${entry.name} is not for sale before its chain opens`,
			entry.level >= Progression.CHAIN_UNLOCK_LEVEL[entry.chain]);
	}
	const sack = Shop.stockFor("crates");
	check("the second one costs more than the first", Shop.priceOf(sack, 1) > Shop.priceOf(sack, 0));
	check("and the tenth a great deal more", Shop.priceOf(sack, 10) > Shop.priceOf(sack, 1) * 10);
	eq("nothing else is for sale", Shop.stockFor("salvage"), null);

	const now = 650_000_000;
	const { game } = startedGame(now);
	const before = game.board.occupied();
	eq("an empty purse buys nothing", game.buyProducer("crates", now), false);
	eq("and nothing arrived", game.board.occupied(), before);

	game._coins = 100_000;
	const price = game.shopList().find((entry) => entry.chain === "crates").price;
	check("with coins, it does", game.buyProducer("crates", now));
	eq("it is paid for", game.coins, 100_000 - price);
	eq("and it is on the board", game.board.occupied(), before + 1);
	check("the next one costs more",
		game.shopList().find((entry) => entry.chain === "crates").price > price);
	eq("what is not unlocked cannot be bought", game.buyProducer("nets", now), false);
	eq("neither can what is not stocked", game.buyProducer("salvage", now), false);

	game._level = 20;
	check("once the level is there, it can", game.buyProducer("nets", now));
	check("a producer arrives full", game.board.cells()
		.some((cell) => cell !== null && cell.chain === "nets" && cell.charges === Producers.capacity(cell)));
}

group("Topping out a producer");
{
	// Every producer chain ends at its fifth tier, which is sixteen tier ones.
	// Levels and the harbour give some away and the chandler sells the rest, and
	// the three chains have to come out somewhere near each other: a salvage yard
	// that arrives free while the fishing boat costs more than the whole harbour
	// is two different games played on the same board.
	const units = (item) => Math.pow(2, item.tier - 1);
	const given = { crates: 0, galley: 0, nets: 0 };
	const add = (item) => {
		if (item !== undefined && given[item.chain] !== undefined) given[item.chain] += units(item);
	};
	for (const item of Progression.OPENING_BOARD) add(item);
	for (const reward of Object.values(Progression.LEVEL_REWARDS)) add(reward.drop);
	for (const project of Projects.PROJECTS) add(project.drop);

	const bill = {};
	for (const chainId of Object.keys(given)) {
		const needed = units({ chain: chainId, tier: Chains.maxTier(chainId) });
		check(`${chainId}: the free ones do not top the chain out on their own`, given[chainId] < needed);
		const entry = Shop.stockFor(chainId);
		let coins = 0;
		for (let bought = 0; bought < needed - given[chainId]; bought += 1) {
			coins += Shop.priceOf(entry, bought);
		}
		bill[chainId] = coins;
		check(`${chainId}: the last one bought is still priced like an item`,
			Shop.priceOf(entry, needed - given[chainId] - 1) < Chains.value({ chain: "salvage", tier: 8 }) * 8);
	}

	const harbour = Projects.PROJECTS.reduce((total, project) => total + project.cost, 0);
	check("no chain costs more to finish than the whole harbour", Math.max(...Object.values(bill)) < harbour);
	check("salvage is the cheapest chain to finish, being the one you start with",
		bill.crates < Math.min(bill.galley, bill.nets));
	check("but not so much cheaper that it is the only one anybody finishes",
		Math.max(...Object.values(bill)) < bill.crates * 10);
}

group("Economy");
{
	check("experience to level climbs", Economy.xpForLevel(2) > Economy.xpForLevel(1));
	check("and keeps climbing", Economy.xpForLevel(20) > Economy.xpForLevel(10));

	// An order has to beat the till, or nobody would ever hand anything over.
	const lines = [{ chain: "salvage", tier: 3, count: 2 }, { chain: "catch", tier: 2, count: 1 }];
	const reward = Economy.orderReward(lines, 5);
	const overTheCounter = Chains.value(lines[0]) * 2 + Chains.value(lines[1]);
	check("an order pays more than selling the same items", reward.coins > overTheCounter);
	check("an order pays experience", reward.xp > 0);
	eq("small orders pay no gems", Economy.orderReward([{ chain: "salvage", tier: 1, count: 1 }], 1).gems, 0);
	check("large ones do", Economy.orderReward([{ chain: "salvage", tier: 7, count: 2 }], 9).gems > 0);
	eq("selling pays the item's value", Economy.sellValue({ chain: "catch", tier: 4 }), 80);

	// The last merge of a chain has to pay for itself. Every other tier is worth
	// about two and a half times the one below, which an order for two of that
	// lower tier beats on its own -- so without a premium the top of a chain
	// would be the one merge in the game that loses money.
	for (const chainId of ["salvage", "catch"]) {
		const top = Chains.maxTier(chainId);
		const halves = [{ chain: chainId, tier: top - 1, count: 2 }];
		const trophy = Chains.value({ chain: chainId, tier: top });
		check(`${chainId}: the trophy beats selling both halves`,
			trophy > Chains.value(halves[0]) * 2);
		check(`${chainId}: and beats an order for them, at any level anyone reaches`,
			trophy > Economy.orderReward(halves, 50).coins);
	}
	// The cafe pays in energy instead, and its top tier beats its halves there.
	check("a mocha grande beats the two lattes that made it",
		Chains.energyOf({ chain: "cafe", tier: 6 }) > Chains.energyOf({ chain: "cafe", tier: 5 }) * 2);
}

// --- The board ---------------------------------------------------------------

group("Board");
{
	const board = new Board();
	const now = 1_000_000;
	eq("empty to start", board.occupied(), 0);
	eq("every cell is free", board.firstEmpty(), 0);

	board.put(10, { chain: "salvage", tier: 1 });
	board.put(11, { chain: "salvage", tier: 1 });
	board.put(12, { chain: "catch", tier: 1 });
	eq("counted by kind", board.countOf("salvage", 1), 2);
	eq("and found by kind", board.indexesOf("salvage", 1), [10, 11]);

	eq("a drag onto nothing moves", board.drag(12, 20, now).type, "move");
	eq("a drag onto a different item swaps", board.drag(10, 11, now).type, "merge");
	eq("the merge landed where the drag ended", board.at(11), { chain: "salvage", tier: 2 });
	eq("and left nothing behind", board.at(10), null);
	eq("a drag from nothing does nothing", board.drag(0, 1, now).type, "none");
	eq("a drag onto itself does nothing", board.drag(11, 11, now).type, "none");

	board.put(30, { chain: "catch", tier: 3 });
	board.put(31, { chain: "salvage", tier: 5 });
	eq("mismatched items swap", board.drag(30, 31, now).type, "swap");
	eq("the dragged one arrives", board.at(31), { chain: "catch", tier: 3 });
	eq("and the other goes back", board.at(30), { chain: "salvage", tier: 5 });
}

group("Where a produced item lands");
{
	const board = new Board();
	board.put(20, { chain: "crates", tier: 1 });
	eq("beside the producer", board.nearestEmpty(20), 20 - COLUMNS);

	const crowded = new Board();
	for (let index = 0; index < CELLS; index += 1) crowded.put(index, { chain: "salvage", tier: 1 });
	eq("a full board has nowhere", crowded.nearestEmpty(20), -1);
	check("and knows it", crowded.isFull());
	crowded.clear(CELLS - 1);
	eq("one free cell is found however far away", crowded.nearestEmpty(0), CELLS - 1);
}

group("Saving the board");
{
	const board = new Board();
	const now = 5_000_000;
	board.put(3, Producers.make("galley", 2, now));
	board.put(4, { chain: "cafe", tier: 3 });

	const copy = new Board();
	copy.restore(board.serialize(), now);
	eq("goods come back", copy.at(4), { chain: "cafe", tier: 3 });
	eq("producers come back with their charges", copy.at(3).charges, Producers.capacity({ chain: "galley", tier: 2 }));
	eq("and with their clock", copy.at(3).chargedAt, now);

	const patched = new Board();
	patched.restore([{ c: "ghost", t: 1 }, { c: "salvage", t: 99 }, { c: "salvage", t: 2 }], now);
	eq("an item that no longer exists is dropped", patched.at(0), null);
	eq("so is a tier that no longer exists", patched.at(1), null);
	eq("the rest survives", patched.at(2), { chain: "salvage", tier: 2 });
	patched.restore(null, now);
	eq("a missing board is an empty one", patched.occupied(), 0);
}

group("Wants against the board");
{
	const board = new Board();
	const bolt = { chain: "salvage", tier: 1 };
	board.put(0, { ...bolt });
	board.put(1, { ...bolt });
	board.put(2, { chain: "catch", tier: 1 });

	check("a board holds what it holds", board.holds([{ ...bolt, count: 2 }]));
	check("and not more than it holds", !board.holds([{ ...bolt, count: 3 }]));
	check("one missing line is enough to fail",
		!board.holds([{ ...bolt, count: 1 }, { chain: "catch", tier: 2, count: 1 }]));
	check("an empty list is always held", board.holds([]));

	board.take([{ ...bolt, count: 1 }]);
	eq("taking one takes exactly one", board.countOf("salvage", 1), 1);
	eq("and leaves everything else", board.occupied(), 2);
}

group("Charges");
{
	const now = 9_000_000;
	const sack = Producers.make("crates", 1, now);
	const capacity = Producers.capacity(sack);
	const period = Producers.rechargeMs(sack);
	eq("a new producer is full", sack.charges, capacity);
	eq("a full producer has nothing to wait for", Producers.nextChargeIn(sack, now), 0);

	Producers.spend(sack, now);
	eq("a tap costs a charge", sack.charges, capacity - 1);
	eq("and starts the clock", Producers.nextChargeIn(sack, now), period);

	check("nothing lands early", !Producers.refresh(sack, now + period - 1));
	check("one lands on time", Producers.refresh(sack, now + period));
	eq("one, and only one", sack.charges, capacity);

	const spent = Producers.make("crates", 1, now);
	for (let tap = 0; tap < capacity; tap += 1) Producers.spend(spent, now);
	eq("a producer can be emptied", spent.charges, 0);
	Producers.refresh(spent, now + period * 2.5);
	eq("time away comes back as charges", spent.charges, 2);
	eq("and the half period is not thrown away",
		Producers.nextChargeIn(spent, now + period * 2.5), Math.round(period * 0.5));
	Producers.refresh(spent, now + period * 500);
	eq("a long absence fills it and no more", spent.charges, capacity);

	const a = Producers.make("crates", 1, now);
	const b = Producers.make("crates", 1, now);
	Producers.spend(a, now);
	const bigger = Producers.merged("crates", 2, a, b, now);
	eq("merging carries both parents' charges", bigger.charges,
		Math.min(Producers.capacity(bigger), a.charges + b.charges));
	const drained = Producers.merged("crates", 2, { charges: 0 }, { charges: 0 }, now);
	eq("two spent producers make a spent one", drained.charges, 0);
	Producers.fill(drained, now);
	eq("gems fill it", drained.charges, Producers.capacity(drained));
}

// --- Orders ------------------------------------------------------------------

group("What the townsfolk ask for");
{
	const rng = new Rng(3);
	for (const level of [1, 2, 5, 12, 30]) {
		const chains = Progression.chainsUnlockedAt(level);
		for (let attempt = 0; attempt < 120; attempt += 1) {
			const order = Content.rollOrder(rng, { level, chains });
			check("an order names a real customer", Content.customerById(order.customer) !== null);
			check("an order has something in it", order.lines.length >= 1);
			for (const line of order.lines) {
				check(`level ${level}: never asks for a locked chain`, chains.includes(line.chain));
				check("never asks for a producer", Chains.chain(line.chain).kind !== "producer");
				check("asks for a real tier", Chains.tierOf(line) !== null);
				check("the top of a chain is not asked for before it is a trophy",
					line.tier < Chains.maxTier(line.chain) || level >= 15);
				// A tier one is two taps and no merge, which is not an order.
				check("never asks for what a producer makes directly", line.tier >= 2);
				check("asks for at least one", line.count >= 1);
			}
			eq("never asks for the same thing twice",
				new Set(order.lines.map((line) => line.chain)).size, order.lines.length);
		}
	}

	// The trophy: the top of a chain, asked for late and seldom. Seldom is the
	// point of it -- a card asking for a ship in a bottle is a hundred and
	// twenty-eight bolts of work, and every second one would be a wall.
	for (const [level, wanted] of [[14, false], [20, true]]) {
		const chains = Progression.chainsUnlockedAt(level);
		const rolls = new Rng(41);
		let tops = 0;
		let lines = 0;
		for (let attempt = 0; attempt < 4000; attempt += 1) {
			for (const line of Content.rollOrder(rolls, { level, chains }).lines) {
				lines += 1;
				if (line.tier === Chains.maxTier(line.chain)) tops += 1;
			}
		}
		eq(`level ${level}: the top of a chain ${wanted ? "is" : "is not"} asked for`, tops > 0, wanted);
		if (wanted) check("and only now and then", tops / lines < 0.1);
	}

	const first = Content.rollOrder(new Rng(77), { level: 6, chains: Progression.chainsUnlockedAt(6) });
	const again = Content.rollOrder(new Rng(77), { level: 6, chains: Progression.chainsUnlockedAt(6) });
	eq("the same seed asks for the same thing", first, again);
	eq("no chains means no order", Content.rollOrder(new Rng(1), { level: 1, chains: [] }), null);
}

group("The order book");
{
	const book = new OrderBook(new Rng(5));
	const board = new Board();
	eq("fills every slot", book.refill(3, 4, Progression.chainsUnlockedAt(4)), 3);
	eq("and stops there", book.list().length, 3);
	eq("a full board of orders needs no more", book.refill(3, 4, Progression.chainsUnlockedAt(4)), 0);
	eq("ids are handed out once", new Set(book.list().map((order) => order.id)).size, 3);

	const crowd = new OrderBook(new Rng(9));
	crowd.refill(5, 12, Progression.chainsUnlockedAt(12));
	eq("nobody stands in the queue twice",
		new Set(crowd.list().map((order) => order.customer)).size, crowd.list().length);
	crowd.skip(crowd.list()[0].id);
	crowd.refill(5, 12, Progression.chainsUnlockedAt(12));
	eq("and still not after a slot turns over",
		new Set(crowd.list().map((order) => order.customer)).size, crowd.list().length);

	const order = book.list()[0];
	check("nothing to deliver yet", !book.canDeliver(board, order));
	eq("delivering an unfilled order pays nothing", book.deliver(board, order, 4), null);
	eq("progress starts at nothing", book.progress(board, order)[0].have, 0);

	for (const line of order.lines) {
		for (let copy = 0; copy < line.count; copy += 1) board.put(board.firstEmpty(), { chain: line.chain, tier: line.tier });
	}
	// One more than the order wants, to prove delivery takes only what it asked for.
	const spare = { chain: order.lines[0].chain, tier: order.lines[0].tier };
	board.put(board.firstEmpty(), spare);
	const before = board.occupied();
	check("now it can go", book.canDeliver(board, order));

	const reward = book.deliver(board, order, 4);
	check("delivering pays", reward.coins > 0);
	eq("it takes exactly what it asked for", board.occupied(),
		before - order.lines.reduce((total, line) => total + line.count, 0));
	eq("the spare is still there", board.countOf(spare.chain, spare.tier), 1);
	eq("the slot is empty until the next top-up", book.list().length, 2);
	eq("the order is gone", book.byId(order.id), null);

	check("skipping sends one away", book.skip(book.list()[0].id));
	check("skipping something that is gone does nothing", !book.skip(999));

	const copy = new OrderBook(new Rng(1));
	copy.restore(book.serialize());
	eq("orders survive a save", copy.list().length, book.list().length);
	copy.restore({ next: 1, orders: [
		{ id: 1, customer: "nobody", lines: [{ chain: "salvage", tier: 1, count: 1 }] },
		{ id: 2, customer: "nell", lines: [{ chain: "ghost", tier: 1, count: 1 }] },
		{ id: 3, customer: "nell", lines: [{ chain: "salvage", tier: 1, count: 1 }] },
	] });
	eq("an order nobody could fill or answer for is dropped", copy.list().map((order) => order.id), [3]);
	copy.restore(null);
	eq("a missing order book is left alone", copy.list().length, 1);
}

// --- The save ----------------------------------------------------------------

group("Save migration");
{
	const empty = Migration.emptyDocument();
	eq("a new document is at the current version", empty.version, Migration.CURRENT_VERSION);
	eq("and has not started", empty.started, false);
	eq("and carries the opening purse", empty.coins, Economy.START.coins);

	const migrated = Migration.migrate({ level: 4, coins: 900, extra: "kept" });
	eq("what is there is kept", migrated.level, 4);
	eq("what is missing is filled in", migrated.gems, Economy.START.gems);
	eq("a field this version does not know is left alone", migrated.extra, "kept");

	const rubbish = Migration.migrate({
		level: -3, xp: "nonsense", coins: null, energy: 9999, energyCap: 0,
		orderSlots: 0, projects: [1, "jetty"], seen: [2, "salvage:1"], stats: null,
	});
	eq("a level below one is not a level", rubbish.level, 1);
	eq("nonsense experience is none", rubbish.xp, 0);
	eq("energy cannot be over the cap", rubbish.energy, rubbish.energyCap);
	eq("there is always a slot", rubbish.orderSlots >= 1, true);
	eq("only real project ids survive", rubbish.projects, ["jetty"]);
	eq("only real catalogue keys survive", rubbish.seen, ["salvage:1"]);
	eq("statistics come back", rubbish.stats.merges, 0);
	eq("a purse with no purchases in it is an empty one", Migration.migrate({ bought: null }).bought, {});
	eq("purchases survive", Migration.migrate({ bought: { crates: 3 } }).bought.crates, 3);
}

// --- The running game --------------------------------------------------------

group("A session");
{
	const now = 100_000_000;
	const { game, save } = startedGame(now);

	eq("starts at level one", game.level, 1);
	eq("with the opening board", game.board.occupied(), Progression.OPENING_BOARD.length);
	eq("and a full order board", game.orders.length, Economy.START.orderSlots);
	eq("the opening board is in the catalogue", game.hasSeen({ chain: "salvage", tier: 1 }), true);
	eq("and the rest of it is not", game.hasSeen({ chain: "catch", tier: 7 }), false);

	const sack = findIndex(game.board, "crates");
	const producer = game.board.at(sack);
	const energyBefore = game.energy;
	const result = game.tap(sack, now);
	eq("tapping a producer produces", result.type, "produced");
	eq("it costs energy", game.energy, energyBefore - Producers.energyCost(producer));
	eq("and a charge", producer.charges, Producers.capacity(producer) - 1);
	eq("what it made is salvage", game.board.at(result.at).chain, "salvage");
	eq("and is in the catalogue now", game.hasSeen(game.board.at(result.at)), true);

	while (game.board.at(sack).charges > 0) game.tap(sack, now);
	const stopped = game.tap(sack, now);
	eq("a spent producer makes nothing", stopped.type, "empty");

	const [first, second] = game.board.indexesOf("salvage", 1);
	const merged = game.drag(first, second, now);
	eq("dragging two of a kind merges them", merged.type, "merge");
	eq("into the next tier up", game.board.at(second).tier, 2);
	eq("the merge is counted", game.stats.merges, 1);

	const coinsBefore = game.coins;
	const sold = game.board.indexesOf("salvage", 2)[0];
	const worth = Economy.sellValue(game.board.at(sold));
	game.sell(sold, now);
	eq("selling pays out", game.coins, coinsBefore + worth);
	eq("and clears the cell", game.board.at(sold), null);

	save.flush();
	eq("the save has the board on it", save.document().board.filter(Boolean).length, game.board.occupied());
	eq("and the wallet", save.document().coins, game.coins);
	eq("and says the game has started", save.document().started, true);

	const resumed = new GameState(new FakeSave(save.document()));
	resumed.start(now);
	eq("a resumed game has the same board", resumed.board.occupied(), game.board.occupied());
	eq("and the same coins", resumed.coins, game.coins);
	eq("and does not lay out a second opening board", resumed.stats.merges, 1);
}

group("Energy");
{
	const now = 200_000_000;
	const { game } = startedGame(now);
	const period = Economy.ENERGY_REGEN_SECONDS * 1000;

	const start = game.energy;
	game.tick(now + period - 1);
	eq("nothing arrives early", game.energy, start);
	game.tick(now + period);
	eq("one arrives on time", game.energy, start + 1);
	game.tick(now + period * 10.5);
	eq("time away comes back as energy", game.energy, start + 10);
	game.tick(now + period * 10_000);
	eq("and stops at the cap", game.energy, game.energyCap);
	eq("a full bar has nothing to wait for", game.energyIn(now + period * 10_000), 0);

	const later = now + period * 10_000;
	const cafeGame = startedGame(later).game;
	cafeGame.board.put(0, { chain: "cafe", tier: 4 });
	const before = cafeGame.energy;
	const drank = cafeGame.tap(0, later);
	eq("coffee is drunk, not merged", drank.type, "drank");
	eq("it gives back what its tier is worth", cafeGame.energy, before + Chains.energyOf({ chain: "cafe", tier: 4 }));
	eq("and leaves the board", cafeGame.board.at(0), null);

	cafeGame._energy = cafeGame.energyCap - 2;
	cafeGame.board.put(0, { chain: "cafe", tier: 6 });
	eq("a drink that overflows gives what fits", cafeGame.tap(0, later).gain, 2);
	eq("and no more", cafeGame.energy, cafeGame.energyCap);

	cafeGame.board.put(0, { chain: "cafe", tier: 1 });
	eq("a full bar refuses a drink", cafeGame.tap(0, later).type, "spare");
	eq("and the coffee is still there", cafeGame.board.at(0).chain, "cafe");
}

group("Levelling");
{
	const now = 300_000_000;
	const { game } = startedGame(now);
	const levels = [];
	game.on("levelUp", (level, reward) => levels.push({ level, reward }));

	const slotsBefore = game.orderSlots;
	game._grantXp(Economy.xpForLevel(1) + Economy.xpForLevel(2), now);
	eq("two levels at once are two cards", levels.length, 2);
	eq("and the level moved twice", game.level, 3);
	check("the bar was filled", game.energy === game.energyCap);
	check("the galley arrived", game.board.cells().some((cell) => cell !== null && cell.chain === "galley"));
	check("the coins arrived", game.coins > Economy.START.coins);
	eq("nothing was promised about slots yet", game.orderSlots, slotsBefore);
	check("the café is on the order board now", Progression.chainsUnlockedAt(game.level).includes("cafe"));
}

group("A reward with nowhere to go");
{
	const now = 400_000_000;
	const { game } = startedGame(now);
	for (let index = 0; index < CELLS; index += 1) {
		if (game.board.at(index) === null) game.board.put(index, { chain: "salvage", tier: 8 });
	}
	const messages = [];
	game.on("message", (text) => messages.push(text));

	game._applyReward({ drop: { chain: "nets", tier: 1 } }, now);
	check("a drop onto a full board waits rather than vanishing", messages.length > 0);
	check("and nothing was placed", !game.board.cells().some((cell) => cell !== null && cell.chain === "nets"));

	game.sell(0, now);
	check("it lands as soon as there is room",
		game.board.cells().some((cell) => cell !== null && cell.chain === "nets"));
}

group("Coming back");
{
	const now = 500_000_000;
	const { game, save } = startedGame(now);
	while (game.board.at(findIndex(game.board, "crates")).charges > 0) {
		game.tap(findIndex(game.board, "crates"), now);
	}
	save.flush();
	// The document stamps itself with the wall clock on the way out; this suite
	// runs on a clock of its own, so the fixture says when it was written.
	const written = { ...save.document(), savedAt: now };

	const away = 6 * 60 * MINUTE;
	const resumed = new GameState(new FakeSave(written));
	let summary = null;
	resumed.on("caughtUp", (caught) => { summary = caught; });
	resumed.start(now + away);

	check("a long absence is worth a card", summary !== null);
	check("energy came in while the tab was closed", summary.energy > 0);
	check("so did charges", summary.charges > 0);

	const quick = new GameState(new FakeSave(written));
	let quickSummary = null;
	quick.on("caughtUp", (caught) => { quickSummary = caught; });
	quick.start(now + MINUTE);
	eq("a moment away is not", quickSummary, null);
}

group("Spending");
{
	const now = 600_000_000;
	const { game } = startedGame(now);

	eq("a project out of reach is refused", game.buyProject("lighthouse", now), false);
	eq("and nothing was spent", game.coins, Economy.START.coins);

	game._coins = 100_000;
	game._level = 20;
	eq("an affordable project goes ahead", game.buyProject("jetty", now), true);
	eq("it is paid for", game.coins, 100_000 - Projects.projectById("jetty").cost);
	check("it is marked done", game.isProjectDone("jetty"));
	eq("and cannot be bought twice", game.buyProject("jetty", now), false);

	game._energy = 0;
	game._gems = Economy.GEM_COSTS.refill;
	check("gems fill the bar", game.buyRefill(now));
	eq("the bar is full", game.energy, game.energyCap);
	eq("the gems are gone", game.gems, 0);
	eq("and an empty purse cannot do it again", game.buyRefill(now), false);

	const sack = findIndex(game.board, "crates");
	while (game.board.at(sack).charges > 0) Producers.spend(game.board.at(sack), now);
	eq("no gems, no recharge", game.buyRecharge(sack, now), false);
	game._gems = Economy.GEM_COSTS.recharge;
	check("gems recharge a producer", game.buyRecharge(sack, now));
	eq("it is full again", game.board.at(sack).charges, Producers.capacity(game.board.at(sack)));

	// The museum is the one project that wants something off the board as well as
	// coins, and it is where the top of a chain is asked for by name.
	const museum = Projects.projectById("museum");
	check("the museum wants exhibits", museum.wants.length > 0);
	check("and every one of them is the top of its chain",
		museum.wants.every((want) => want.tier === Chains.maxTier(want.chain)));
	game._coins = 200_000;
	eq("coins alone do not open it", game.buyProject("museum", now), false);
	eq("and nothing was spent", game.coins, 200_000);
	check("the panel says what is missing", game.projectList()
		.find((project) => project.id === "museum").wants.every((want) => want.have < want.count));

	for (const want of museum.wants) game.board.put(game.board.firstEmpty(), { ...want });
	const stocked = game.projectList().find((project) => project.id === "museum");
	check("with them on the board it is ready", stocked.stocked);
	const held = game.board.occupied();
	check("and it opens", game.buyProject("museum", now));
	eq("the exhibits went behind glass", game.board.occupied(), held - museum.wants.length);
	check("nothing it wanted is still on the floor",
		museum.wants.every((want) => game.board.countOf(want.chain, want.tier) === 0));

	game._gems = 0;
	eq("skipping an order needs a gem", game.skipOrder(game.orders[0].id, now), false);
	game._gems = 1;
	const skipped = game.orders[0].id;
	check("with one, the order goes", game.skipOrder(skipped, now));
	eq("and is replaced", game.orders.length, game.orderSlots);
	check("by a different one", game.orders.every((order) => order.id !== skipped));
}

group("Delivering");
{
	const now = 700_000_000;
	const { game } = startedGame(now);
	const order = game.orders[0];
	for (const line of order.lines) {
		for (let copy = 0; copy < line.count; copy += 1) {
			game.board.put(game.board.firstEmpty(), { chain: line.chain, tier: line.tier });
		}
	}
	const coins = game.coins;
	check("it can go", game.canDeliver(order));
	eq("progress is complete", game.orderProgress(order).every((line) => line.have === line.count), true);

	const reward = game.deliver(order.id, now);
	check("delivering pays", reward.coins > 0);
	eq("the coins arrive", game.coins, coins + reward.coins);
	eq("the order is counted", game.stats.orders, 1);
	eq("a fresh order takes its place", game.orders.length, game.orderSlots);
	eq("delivering an order that is gone does nothing", game.deliver(order.id, now), false);
}

// --- Drawing -----------------------------------------------------------------

group("Sprites");
{
	for (const item of Chains.allItems()) {
		const svg = itemSprite(item);
		const name = Chains.name(item);
		check(`${name} draws something`, svg.length > 200);
		check(`${name} is one svg element`, svg.startsWith("<svg") && svg.endsWith("</svg>"));
		check(`${name} has no holes in it`, !svg.includes("undefined") && !svg.includes("NaN"));
		// Ids would collide the moment a sprite appeared twice on one screen, which
		// is most of the time.
		check(`${name} carries no ids`, !svg.includes("id="));
		// Two fills on one element is a parse error, and the sprite after it never
		// renders at all.
		for (const element of svg.match(/<[a-z]+[^>]*>/g) ?? []) {
			check(`${name} sets each attribute once`, (element.match(/ fill=/g) ?? []).length <= 1);
		}
	}
	eq("an item that no longer exists draws nothing", itemSprite({ chain: "ghost", tier: 1 }).includes("path"), false);
	for (const name of ["coin", "gem", "energy", "xp", "clock", "basket"]) {
		check(`the ${name} glyph draws`, glyph(name).length > 100);
	}
	for (const customer of Content.CUSTOMERS) {
		const face = portrait(customer.id);
		check(`${customer.name} has a face`, face.length > 300);
		check(`${customer.name}'s face is whole`, !face.includes("undefined") && !face.includes("NaN"));
	}
	eq("someone who does not exist has no face", portrait("nobody").includes("circle"), false);
}

group("Formatting");
{
	eq("small counts are written out", Format.count(940), "940");
	eq("thousands are shortened", Format.count(15400), "15.4k");
	eq("and rounded once they are long", Format.count(154000), "154k");
	eq("millions too", Format.count(2400000), "2.4m");
	eq("a clock reads as minutes", Format.clock(125), "2:05");
	eq("and as hours when there are hours", Format.clock(4000), "1h 6m");
	eq("one of a thing is singular", Format.plural(1, "crate"), "1 crate");
	eq("more than one is not", Format.plural(3, "crate"), "3 crates");
}

// --- Result ------------------------------------------------------------------

process.stdout.write(`\n${passed} checks passed`);
if (failures.length === 0) {
	process.stdout.write(", nothing failed.\n");
} else {
	process.stdout.write(`, ${failures.length} failed:\n`);
	for (const failure of failures) process.stdout.write(`  ${failure}\n`);
	process.exitCode = 1;
}
