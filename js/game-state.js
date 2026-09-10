/**
 * The running game.
 *
 * Owns the board, the order book, the wallet and the clock, and is the only
 * thing that changes any of them. Views listen for what they draw and send
 * intentions back -- tap this cell, drag this one there, hand this order over --
 * so the rules live here and nowhere else.
 *
 * Time is absolute throughout. Energy and producer charges are stored as a count
 * plus the moment the part-filled one started, so an hour with the tab closed
 * and an hour with it open come out the same, and a session that resumes simply
 * catches up.
 *
 * Emits:
 *   boardChanged()            a cell changed; repaint the grid
 *   produced(index, item)     a producer popped something out
 *   merged(index, item)       two became one
 *   walletChanged()           coins or gems
 *   energyChanged()           the bar, or its cap
 *   xpChanged()               experience, without a level behind it
 *   levelUp(level, reward)    one card per level gained
 *   ordersChanged()
 *   projectsChanged()
 *   message(text, kind)       one line for the toast strip
 *   caughtUp(summary)         what came in while the game was closed
 */
import { Emitter } from "./util/emitter.js";
import { Rng } from "./util/rng.js";
import { Board } from "./board.js";
import { OrderBook } from "./orders.js";
import * as Chains from "./content/chains.js";
import * as Producers from "./producers.js";
import * as Progression from "./content/progression.js";
import * as Projects from "./content/projects.js";
import * as Shop from "./content/shop.js";
import * as Economy from "./economy.js";

/** Below this, coming back is not worth a card. */
const CATCH_UP_THRESHOLD_MS = 5 * 60 * 1000;

export class GameState extends Emitter {
	constructor(save) {
		super();
		this._save = save;
		this._rng = new Rng(Rng.randomSeed());
		this._board = new Board();
		this._orders = new OrderBook(this._rng);
		this._drops = [];
		this._level = 1;
		this._xp = 0;
		this._coins = 0;
		this._gems = 0;
		this._energy = 0;
		this._energyCap = Economy.START.energyCap;
		this._energyAt = 0;
		this._orderSlots = Economy.START.orderSlots;
		this._projects = new Set();
		this._bought = {};
		this._seen = new Set();
		this._stats = { merges: 0, orders: 0, sold: 0, produced: 0 };

		save.on("saveRequested", () => save.submit(this._serialize()));
	}

	// --- Reading ---------------------------------------------------------------

	get board() { return this._board; }
	get orders() { return this._orders.list(); }
	get level() { return this._level; }
	get xp() { return this._xp; }
	get xpNeeded() { return Economy.xpForLevel(this._level); }
	get coins() { return this._coins; }
	get gems() { return this._gems; }
	get energy() { return this._energy; }
	get energyCap() { return this._energyCap; }
	get orderSlots() { return this._orderSlots; }
	get stats() { return { ...this._stats }; }

	/** Milliseconds until the next energy lands, or 0 when the bar is full. */
	energyIn(now = Date.now()) {
		if (this._energy >= this._energyCap) return 0;
		return Math.max(0, this._energyAt + Economy.ENERGY_REGEN_SECONDS * 1000 - now);
	}

	isProjectDone(id) {
		return this._projects.has(id);
	}

	/** Whether this exact item has ever been held. The catalogue draws the rest as silhouettes. */
	hasSeen(item) {
		return this._seen.has(`${item.chain}:${item.tier}`);
	}

	/** Every project, with what is standing between the player and it. */
	projectList() {
		return Projects.PROJECTS.map((project) => {
			const wants = project.wants ?? [];
			return {
				...project,
				done: this._projects.has(project.id),
				locked: this._level < project.level,
				affordable: this._coins >= project.cost,
				wants: wants.map((want) => ({
					...want,
					have: Math.min(this._board.countOf(want.chain, want.tier), want.count),
				})),
				stocked: this._board.holds(wants),
			};
		});
	}

	/** The chandler's shelf: what is for sale, at what it costs today. */
	shopList() {
		return Shop.STOCK.map((entry) => {
			const bought = this._bought[entry.chain] ?? 0;
			const price = Shop.priceOf(entry, bought);
			return {
				...entry,
				bought,
				price,
				locked: this._level < entry.level,
				affordable: this._coins >= price,
			};
		});
	}

	orderProgress(order) {
		return this._orders.progress(this._board, order);
	}

	canDeliver(order) {
		return this._orders.canDeliver(this._board, order);
	}

	// --- Starting --------------------------------------------------------------

	/** Reads the save, or lays out an opening board, then catches the clock up. */
	start(now = Date.now()) {
		const document = this._save.document();
		this._level = document.level;
		this._xp = document.xp;
		this._coins = document.coins;
		this._gems = document.gems;
		this._energy = document.energy;
		this._energyCap = document.energyCap;
		this._energyAt = document.energyAt > 0 ? document.energyAt : now;
		this._orderSlots = document.orderSlots;
		this._projects = new Set(document.projects);
		this._bought = { ...document.bought };
		this._seen = new Set(Array.isArray(document.seen) ? document.seen : []);
		this._stats = { ...this._stats, ...document.stats };
		this._drops = document.drops.filter((drop) => Chains.tierOf(drop) !== null);
		if (document.seed !== null) this._rng.restore(document.seed);

		if (document.started) {
			this._board.restore(document.board, now);
			this._orders.restore(document.orders);
		} else {
			this._layOutOpeningBoard(now);
		}

		// A save from before the catalogue existed knows what is on the board and
		// nothing else, which is the best that can be reconstructed.
		for (const cell of this._board.cells()) if (cell !== null) this._note(cell);

		const summary = this._catchUp(now, document.savedAt);
		this._orders.refill(this._orderSlots, this._level, Progression.chainsUnlockedAt(this._level));
		this._flushDrops(now);
		this._persist();

		this.emit("boardChanged");
		this.emit("ordersChanged");
		this.emit("walletChanged");
		this.emit("energyChanged");
		if (summary !== null) this.emit("caughtUp", summary);
	}

	_layOutOpeningBoard(now) {
		// Spread out rather than packed into a corner, so the first thing the board
		// says is that there is room to work in.
		const spots = [16, 18, 24, 26, 31];
		Progression.OPENING_BOARD.forEach((item, index) => {
			const at = spots[index] ?? this._board.firstEmpty();
			if (at === -1) return;
			this._board.put(at, Chains.isProducer(item)
				? Producers.make(item.chain, item.tier, now)
				: { ...item });
		});
	}

	/**
	 * Brings the clock forward to now and reports what the player missed. Energy
	 * and charges accrue the same way whether the tab was open or not, so this is
	 * the ordinary tick given a large gap.
	 */
	_catchUp(now, savedAt) {
		const away = savedAt > 0 ? now - savedAt : 0;
		const energyBefore = this._energy;
		const chargesBefore = this._totalCharges();

		this._accrueEnergy(now);
		this._board.refresh(now);

		if (away < CATCH_UP_THRESHOLD_MS) return null;
		const energy = this._energy - energyBefore;
		const charges = this._totalCharges() - chargesBefore;
		if (energy <= 0 && charges <= 0) return null;
		return { away, energy, charges };
	}

	/** Files an item in the catalogue. Everything that reaches a cell goes through here. */
	_note(item) {
		if (item === null) return;
		this._seen.add(`${item.chain}:${item.tier}`);
	}

	_totalCharges() {
		let total = 0;
		for (const cell of this._board.cells()) {
			if (cell !== null && cell.charges !== undefined) total += cell.charges;
		}
		return total;
	}

	// --- The clock -------------------------------------------------------------

	/** Called about once a second while the game is on screen. */
	tick(now = Date.now()) {
		if (this._accrueEnergy(now)) this.emit("energyChanged");
		if (this._board.refresh(now)) {
			this._flushDrops(now);
			this.emit("boardChanged");
		}
	}

	_accrueEnergy(now) {
		if (this._energy >= this._energyCap) {
			this._energyAt = now;
			return false;
		}
		const period = Economy.ENERGY_REGEN_SECONDS * 1000;
		const elapsed = now - this._energyAt;
		if (elapsed < period) return false;

		const gained = Math.floor(elapsed / period);
		this._energy = Math.min(this._energyCap, this._energy + gained);
		this._energyAt = this._energy >= this._energyCap ? now : this._energyAt + gained * period;
		return true;
	}

	_spendEnergy(amount, now) {
		// A bar that was full has been sitting still; the clock starts on the way down.
		if (this._energy >= this._energyCap) this._energyAt = now;
		this._energy = Math.max(0, this._energy - amount);
		this.emit("energyChanged");
	}

	// --- Playing ---------------------------------------------------------------

	/**
	 * A tap on a cell. Producers pop something out, energy items are drunk, and
	 * everything else is just a thing the player wanted to look at, which the
	 * view handles on its own.
	 */
	tap(index, now = Date.now()) {
		const item = this._board.at(index);
		if (item === null) return { type: "none" };
		if (Chains.isProducer(item)) return this._produce(index, item, now);
		if (Chains.isEnergy(item)) return this._drink(index, item, now);
		return { type: "inspect", item };
	}

	_produce(index, producer, now) {
		Producers.refresh(producer, now);
		if (producer.charges <= 0) {
			this.emit("message", "Still filling up.", "wait");
			return { type: "empty" };
		}
		const cost = Producers.energyCost(producer);
		if (this._energy < cost) {
			// Before the galley opens there is nothing to do about it but wait, and
			// telling a level-one player to merge coffee they have never seen is
			// worse than telling them nothing.
			const hint = Progression.chainsUnlockedAt(this._level).includes("cafe")
				? "Not enough energy. Merge some coffee."
				: "Not enough energy. It comes back on its own.";
			this.emit("message", hint, "block");
			return { type: "tired" };
		}
		const target = this._board.nearestEmpty(index);
		if (target === -1) {
			this.emit("message", "The board is full. Sell or deliver something.", "block");
			return { type: "full" };
		}

		Producers.spend(producer, now);
		this._spendEnergy(cost, now);
		const rolled = Chains.rollOutput(this._rng, producer);
		this._board.put(target, rolled);
		this._note(rolled);
		this._stats.produced += 1;
		this._persist();
		this.emit("boardChanged");
		this.emit("produced", target, rolled);
		return { type: "produced", at: target, item: rolled };
	}

	_drink(index, item, now) {
		if (this._energy >= this._energyCap) {
			this.emit("message", "Your energy is already full.", "block");
			return { type: "spare" };
		}
		const gain = Math.min(Chains.energyOf(item), this._energyCap - this._energy);
		this._board.clear(index);
		this._energy += gain;
		this._energyAt = this._energy >= this._energyCap ? now : this._energyAt;
		this._flushDrops(now);
		this._persist();
		this.emit("energyChanged");
		this.emit("boardChanged");
		this.emit("message", `+${gain} energy`, "good");
		return { type: "drank", gain };
	}

	/** A drag from one cell to another: merge, move or swap. */
	drag(from, to, now = Date.now()) {
		const result = this._board.drag(from, to, now);
		if (result.type === "none") return result;
		if (result.type === "merge") {
			this._stats.merges += 1;
			this._note(result.item);
		}
		this._persist();
		this.emit("boardChanged");
		// After the repaint: the pop belongs on the art the player is about to see.
		if (result.type === "merge") this.emit("merged", result.at, result.item);
		return result;
	}

	sell(index, now = Date.now()) {
		const item = this._board.at(index);
		if (item === null) return false;
		const coins = Economy.sellValue(item);
		this._board.clear(index);
		this._coins += coins;
		this._stats.sold += 1;
		this._flushDrops(now);
		this._persist();
		this.emit("walletChanged");
		this.emit("boardChanged");
		this.emit("message", `Sold ${Chains.name(item)} for ${coins}`, "good");
		return true;
	}

	// --- Orders ----------------------------------------------------------------

	deliver(id, now = Date.now()) {
		const order = this._orders.byId(id);
		if (order === null) return false;
		const reward = this._orders.deliver(this._board, order, this._level);
		if (reward === null) {
			this.emit("message", "Not everything on that list is on the board.", "block");
			return false;
		}

		this._coins += reward.coins;
		this._gems += reward.gems;
		this._stats.orders += 1;
		this._orders.refill(this._orderSlots, this._level, Progression.chainsUnlockedAt(this._level));
		this._flushDrops(now);
		this.emit("walletChanged");
		this.emit("boardChanged");
		this.emit("ordersChanged");
		this._grantXp(reward.xp, now);
		this._persist();
		return reward;
	}

	/**
	 * Sends an order away. It costs a gem, because a free reroll is a way to sit
	 * on the button until an easy list comes up, and then the orders stop being
	 * the thing the board is arranged around.
	 */
	skipOrder(id, now = Date.now()) {
		if (this._gems < 1) {
			this.emit("message", "Skipping an order costs a gem.", "block");
			return false;
		}
		if (!this._orders.skip(id)) return false;
		this._gems -= 1;
		this._orders.refill(this._orderSlots, this._level, Progression.chainsUnlockedAt(this._level));
		this._persist();
		this.emit("walletChanged");
		this.emit("ordersChanged");
		return true;
	}

	// --- Spending --------------------------------------------------------------

	buyProject(id, now = Date.now()) {
		const project = Projects.projectById(id);
		if (project === null || this._projects.has(id)) return false;
		if (this._level < project.level) {
			this.emit("message", `Level ${project.level} first.`, "block");
			return false;
		}
		if (this._coins < project.cost) {
			this.emit("message", "Not enough coins yet.", "block");
			return false;
		}
		const wants = project.wants ?? [];
		if (!this._board.holds(wants)) {
			this.emit("message", "It wants more than coins.", "block");
			return false;
		}

		this._coins -= project.cost;
		this._board.take(wants);
		this._projects.add(id);
		this._applyReward(project, now);
		this.emit("walletChanged");
		this.emit("boardChanged");
		this.emit("projectsChanged");
		this.emit("message", `${project.name} — done.`, "good");
		this._grantXp(project.xp ?? 0, now);
		this._persist();
		return true;
	}

	/**
	 * A producer, for coins. It arrives through the same queue a level reward
	 * uses, so buying one with a full board is a thing that waits rather than a
	 * thing that is refused.
	 */
	buyProducer(chainId, now = Date.now()) {
		const entry = Shop.stockFor(chainId);
		if (entry === null) return false;
		if (this._level < entry.level) {
			this.emit("message", `Level ${entry.level} first.`, "block");
			return false;
		}
		const bought = this._bought[chainId] ?? 0;
		const price = Shop.priceOf(entry, bought);
		if (this._coins < price) {
			this.emit("message", "Not enough coins yet.", "block");
			return false;
		}

		this._coins -= price;
		this._bought[chainId] = bought + 1;
		this._applyReward({ drop: { chain: chainId, tier: 1 } }, now);
		this._persist();
		this.emit("walletChanged");
		this.emit("message", `${entry.name} delivered.`, "good");
		return true;
	}

	/** Gems for a full bar. */
	buyRefill(now = Date.now()) {
		if (this._energy >= this._energyCap) {
			this.emit("message", "Your energy is already full.", "block");
			return false;
		}
		if (this._gems < Economy.GEM_COSTS.refill) {
			this.emit("message", `That costs ${Economy.GEM_COSTS.refill} gems.`, "block");
			return false;
		}
		this._gems -= Economy.GEM_COSTS.refill;
		this._energy = this._energyCap;
		this._energyAt = now;
		this._persist();
		this.emit("walletChanged");
		this.emit("energyChanged");
		return true;
	}

	/** Gems for a producer that is ready now. */
	buyRecharge(index, now = Date.now()) {
		const item = this._board.at(index);
		if (item === null || !Chains.isProducer(item)) return false;
		Producers.refresh(item, now);
		if (item.charges >= Producers.capacity(item)) {
			this.emit("message", "That one is already full.", "block");
			return false;
		}
		if (this._gems < Economy.GEM_COSTS.recharge) {
			this.emit("message", `That costs ${Economy.GEM_COSTS.recharge} gems.`, "block");
			return false;
		}
		this._gems -= Economy.GEM_COSTS.recharge;
		Producers.fill(item, now);
		this._persist();
		this.emit("walletChanged");
		this.emit("boardChanged");
		return true;
	}

	// --- Levels ----------------------------------------------------------------

	_grantXp(amount, now) {
		if (amount <= 0) return;
		this._xp += amount;
		let levelled = false;
		while (this._xp >= Economy.xpForLevel(this._level)) {
			this._xp -= Economy.xpForLevel(this._level);
			this._level += 1;
			levelled = true;
			const reward = Progression.rewardFor(this._level);
			// Every level fills the bar. It is the reward that matters on the
			// evening the player runs dry, and the one the table never has to list.
			this._energy = this._energyCap;
			this._energyAt = now;
			this._applyReward(reward, now);
			this.emit("levelUp", this._level, reward);
		}
		if (levelled) {
			this._orders.refill(this._orderSlots, this._level, Progression.chainsUnlockedAt(this._level));
			this.emit("ordersChanged");
			this.emit("energyChanged");
			this.emit("walletChanged");
		}
		this.emit("xpChanged");
	}

	/** The one place a level reward and a project reward are read the same way. */
	_applyReward(reward, now) {
		if (reward.coins) this._coins += reward.coins;
		if (reward.gems) this._gems += reward.gems;
		if (reward.energyCap) {
			this._energyCap += reward.energyCap;
			this._energy = this._energyCap;
			this._energyAt = now;
		}
		if (reward.orderSlots) this._orderSlots += reward.orderSlots;
		if (reward.drop) this._drops.push({ ...reward.drop });
		this._flushDrops(now);
	}

	/**
	 * Puts queued producers down. A reward that arrives on a full board is not
	 * lost: it waits in the queue and lands the moment a cell frees up.
	 */
	_flushDrops(now) {
		const landed = [];
		while (this._drops.length > 0) {
			const at = this._board.firstEmpty();
			if (at === -1) break;
			const drop = this._drops.shift();
			this._board.put(at, Chains.isProducer(drop)
				? Producers.make(drop.chain, drop.tier, now)
				: { ...drop });
			this._note(drop);
			landed.push([at, drop]);
		}
		if (landed.length > 0) this.emit("boardChanged");
		for (const [at, drop] of landed) this.emit("produced", at, drop);
		if (this._drops.length > 0) {
			this.emit("message", "Something is waiting for a free cell.", "wait");
		}
		return landed.length > 0;
	}

	// --- Saving ----------------------------------------------------------------

	_persist() {
		this._save.flush();
	}

	_serialize() {
		return {
			level: this._level,
			xp: this._xp,
			coins: this._coins,
			gems: this._gems,
			energy: this._energy,
			energyCap: this._energyCap,
			energyAt: this._energyAt,
			orderSlots: this._orderSlots,
			board: this._board.serialize(),
			orders: this._orders.serialize(),
			projects: [...this._projects],
			bought: this._bought,
			seen: [...this._seen],
			drops: this._drops,
			seed: this._rng.save(),
			stats: this._stats,
			savedAt: Date.now(),
			started: true,
		};
	}
}
