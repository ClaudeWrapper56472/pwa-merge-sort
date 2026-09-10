/**
 * What goes inside the sheet.
 *
 * Each builder returns a plain node and takes the callbacks it needs, so a panel
 * knows how to draw itself and nothing about how the app is wired. They are
 * rebuilt rather than updated: a panel is a few dozen nodes and is only ever on
 * screen while the player is reading it.
 */
import { itemSprite, glyph } from "./sprites.js";
import { CELLS } from "../board.js";
import * as Chains from "../content/chains.js";
import * as Economy from "../economy.js";
import * as Format from "../util/format.js";

function element(tag, className, html) {
	const node = document.createElement(tag);
	if (className !== undefined) node.className = className;
	if (html !== undefined) node.innerHTML = html;
	return node;
}

// --- The harbour --------------------------------------------------------------

/** What a project hands back, written the way the level-up card writes it. */
function rewardLine(reward) {
	const parts = [];
	if (reward.xp) parts.push(`${glyph("xp")}${Format.count(reward.xp)}`);
	if (reward.coins) parts.push(`${glyph("coin")}${Format.count(reward.coins)}`);
	if (reward.gems) parts.push(`${glyph("gem")}${reward.gems}`);
	if (reward.energyCap) parts.push(`${glyph("energy")}+${reward.energyCap} cap`);
	if (reward.orderSlots) parts.push(`${glyph("basket")}+${reward.orderSlots} order`);
	if (reward.drop) parts.push(`${itemSprite(reward.drop)}${Chains.name(reward.drop)}`);
	return parts.map((part) => `<span>${part}</span>`).join("");
}

export function harbourPanel(game, onBuy, onBuyProducer) {
	const panel = element("div", "panel harbour");
	const projects = game.projectList();
	const done = projects.filter((project) => project.done).length;

	panel.append(element("p", "panel-lead",
		`Coins do two things and nothing else: they buy producers from the chandler,
		and they put the harbour back together.<br>
		<b>${done} of ${projects.length}</b> restored.`));

	panel.append(element("h3", "panel-head", "The chandler"));
	for (const entry of game.shopList()) {
		const row = element("article", `project${entry.locked ? " locked" : ""}`);
		row.innerHTML = `
			<h3>${entry.name}</h3>
			<p class="blurb">${entry.blurb}</p>
			<p class="reward">
				<span>${itemSprite({ chain: entry.chain, tier: 1 })}Onto the board</span>
				${entry.bought > 0 ? `<span>${entry.bought} bought</span>` : ""}
			</p>`;
		const button = element("button", "primary");
		button.type = "button";
		if (entry.locked) {
			button.textContent = `Level ${entry.level}`;
			button.disabled = true;
		} else {
			button.innerHTML = `${glyph("coin")}${Format.count(entry.price)}`;
			button.disabled = !entry.affordable;
			button.addEventListener("click", () => onBuyProducer(entry.chain));
		}
		row.append(button);
		panel.append(row);
	}

	panel.append(element("h3", "panel-head", "The harbour"));

	for (const project of projects) {
		const row = element("article", `project${project.done ? " done" : ""}${project.locked ? " locked" : ""}`);
		row.innerHTML = `
			<h3>${project.name}</h3>
			<p class="blurb">${project.blurb}</p>
			<p class="reward">${rewardLine(project)}</p>`;

		const button = element("button", "primary");
		button.type = "button";
		if (project.done) {
			button.textContent = "Restored";
			button.disabled = true;
		} else if (project.locked) {
			button.textContent = `Level ${project.level}`;
			button.disabled = true;
		} else {
			button.innerHTML = `${glyph("coin")}${Format.count(project.cost)}`;
			button.disabled = !project.affordable;
			button.addEventListener("click", () => onBuy(project.id));
		}
		row.append(button);
		panel.append(row);
	}
	return panel;
}

// --- The catalogue ------------------------------------------------------------

export function cataloguePanel(game) {
	const panel = element("div", "panel catalogue");
	const all = Chains.allItems();
	const seen = all.filter((item) => game.hasSeen(item)).length;
	panel.append(element("p", "panel-lead",
		`Everything the depot has ever held.<br><b>${seen} of ${all.length}</b> found.`));

	for (const chainId of Chains.CHAIN_ORDER) {
		const chain = Chains.chain(chainId);
		const group = element("section", "chain");
		group.append(element("h3", undefined, chain.name));
		const strip = element("div", "chain-strip");
		for (let tier = 1; tier <= Chains.maxTier(chainId); tier += 1) {
			const item = { chain: chainId, tier };
			const found = game.hasSeen(item);
			const cell = element("div", `find${found ? "" : " unknown"}`);
			cell.innerHTML = found
				? `<span class="art">${itemSprite(item)}</span><span class="find-name">${Chains.name(item)}</span>`
				: `<span class="art">${itemSprite(item)}</span><span class="find-name">?</span>`;
			strip.append(cell);
		}
		group.append(strip);
		panel.append(group);
	}
	return panel;
}

// --- Energy -------------------------------------------------------------------

export function energyPanel(game, onRefill, now = Date.now()) {
	const panel = element("div", "panel energy-panel");
	const missing = game.energyCap - game.energy;
	const toFull = missing * Economy.ENERGY_REGEN_SECONDS - (Economy.ENERGY_REGEN_SECONDS - game.energyIn(now) / 1000);

	panel.append(element("p", "panel-lead",
		`<b>${game.energy} of ${game.energyCap}</b> energy.<br>
		${missing === 0 ? "The bar is full." : `One more every two minutes, full in ${Format.clock(toFull)}.`}`));
	panel.append(element("p", "panel-note",
		"Energy comes back on its own, and faster from the galley: coffee gives back "
		+ "what a tap costs, and merging it multiplies what you get."));

	const button = element("button", "primary");
	button.type = "button";
	button.innerHTML = `Fill the bar ${glyph("gem")}${Economy.GEM_COSTS.refill}`;
	button.disabled = missing === 0 || game.gems < Economy.GEM_COSTS.refill;
	button.addEventListener("click", () => onRefill());
	panel.append(button);
	return panel;
}

// --- How to play --------------------------------------------------------------

export function helpPanel(game, settings, onReset) {
	const panel = element("div", "panel help");
	panel.innerHTML = `
		<p class="panel-lead">Drag one thing onto another just like it. Two become one, one tier up.</p>
		<dl>
			<dt>Producers</dt>
			<dd>Tap a sack, kettle or line to spend energy and pop something out. Each has
			a number of taps in it that fills back up over time, closed app or not.</dd>
			<dt>Energy</dt>
			<dd>One point every two minutes. Coffee gives it back when you tap it, and a
			merged coffee gives back far more than the two that made it.</dd>
			<dt>Orders</dt>
			<dd>The strip along the bottom. Get everything on a card onto the board and
			deliver it for coins and experience. Sending one away costs a gem.</dd>
			<dt>Room</dt>
			<dd>${CELLS} cells and no more. Tap anything to see what it sells for, and
			sell what you are not merging.</dd>
			<dt>Gems</dt>
			<dd>Every level pays at least one, so does any order worth the trouble, and
			the harbour pays in handfuls. They buy time and never items: a full energy
			bar, or a producer that is ready now. There is nothing to buy them with.</dd>
			<dt>Coins</dt>
			<dd>Two uses, both under Harbour. The chandler sells producers — another
			sack is another eight taps an hour — and each one bought makes the next
			dearer. The rest goes on restoring the harbour, which pays back in
			experience, a bigger energy bar, another order slot, or a producer.</dd>
		</dl>`;

	const stats = game.stats;
	panel.append(element("p", "panel-note",
		`${Format.plural(stats.merges, "merge")} · ${Format.plural(stats.orders, "order")} delivered ·
		${Format.plural(stats.produced, "tap")} · ${Format.plural(stats.sold, "item")} sold`));

	const toggle = element("label", "toggle");
	toggle.innerHTML = `<input type="checkbox"${settings.get("confirmSell") ? " checked" : ""}>
		<span>Ask before selling anything valuable</span>`;
	toggle.querySelector("input").addEventListener("change", (event) => {
		settings.set("confirmSell", event.target.checked);
	});
	panel.append(toggle);

	const reset = element("button", "danger");
	reset.type = "button";
	reset.textContent = "Start a new depot";
	let armed = false;
	reset.addEventListener("click", () => {
		if (!armed) {
			armed = true;
			reset.textContent = "Everything goes. Sure?";
			return;
		}
		onReset();
	});
	panel.append(reset);
	return panel;
}
