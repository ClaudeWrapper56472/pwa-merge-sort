import { Settings } from "../settings.js";
import { SaveManager } from "../save-manager.js";
import { GameState } from "../game-state.js";
import { BoardView } from "./board-view.js";
import { Hud } from "./hud.js";
import { ItemBar } from "./item-bar.js";
import { OrderDock } from "./order-dock.js";
import { Sheet } from "./sheet.js";
import { Overlays } from "./overlays.js";
import { Toasts } from "./toast.js";
import * as Panels from "./panels.js";
import { lockPageZoom } from "./page-zoom.js";

/**
 * Boot and wiring.
 *
 * Every view listens to the game and sends intentions back; nothing reaches into
 * another view. The only thing this file decides for itself is which panel a tab
 * opens and when the clock ticks.
 */

lockPageZoom();

const settings = new Settings();
settings.load();

const save = new SaveManager(settings);
save.load();
save.installSuspendHooks();

const game = new GameState(save);

const board = new BoardView(document.querySelector("#board"), game);
const hud = new Hud(document.querySelector("#hud"), game);
const itemBar = new ItemBar(document.querySelector("#item-bar"), game, settings);
const dock = new OrderDock(document.querySelector("#dock"), game);
const sheet = new Sheet(document.querySelector("#sheet"), document.querySelector("#scrim"));
const overlays = new Overlays(document.querySelector("#card"));
const toasts = new Toasts(document.querySelector("#toasts"));

// --- Panels -------------------------------------------------------------------

const PANELS = {
	harbour: () => ["Coins", Panels.harbourPanel(game, (id) => {
		game.buyProject(id);
		showPanel("harbour");
	}, (chain) => {
		game.buyProducer(chain);
		showPanel("harbour");
	})],
	catalogue: () => ["Catalogue", Panels.cataloguePanel(game)],
	energy: () => ["Energy", Panels.energyPanel(game, () => {
		game.buyRefill();
		showPanel("energy");
	})],
	help: () => ["How to play", Panels.helpPanel(game, settings, () => {
		save.wipe();
		location.reload();
	})],
};

function showPanel(name) {
	const [title, node] = PANELS[name]();
	if (sheet.showing() === name) sheet.replace(node);
	else sheet.open(name, title, node);
}

/** A panel showing numbers that just changed has to be redrawn under the player. */
function refreshOpenPanel() {
	if (sheet.showing() !== "") showPanel(sheet.showing());
}

for (const tab of document.querySelectorAll("#tabs button")) {
	tab.addEventListener("click", () => showPanel(tab.dataset.panel));
}

// --- The board ----------------------------------------------------------------

board.on("tapped", (index) => {
	game.tap(index);
	if (game.board.at(index) === null) {
		board.select(-1);
		itemBar.hide();
		return;
	}
	board.select(index);
	itemBar.show(index);
});

board.on("dragged", (from, to) => {
	const result = game.drag(from, to);
	const landed = result.type === "none" ? from : to;
	board.select(landed);
	itemBar.show(landed);
});

// Picking something up puts the panel away: the bar is under the board and the
// hand is over it.
board.on("pickedUp", () => itemBar.hide());

itemBar.on("sellRequested", (index) => {
	game.sell(index);
	itemBar.hide();
	board.select(-1);
});

itemBar.on("rechargeRequested", (index) => {
	game.buyRecharge(index);
	itemBar.refresh();
});

itemBar.on("closed", () => board.select(-1));

dock.on("deliverRequested", (id) => game.deliver(id));
dock.on("skipRequested", (id) => game.skipOrder(id));

hud.on("energyPressed", () => showPanel("energy"));
hud.on("coinsPressed", () => showPanel("harbour"));
hud.on("levelPressed", () => showPanel("catalogue"));

// --- Listening to the game ----------------------------------------------------

game.on("boardChanged", () => {
	board.paint();
	itemBar.refresh();
	dock.refresh();
});
game.on("ordersChanged", () => dock.refresh());
game.on("walletChanged", () => refreshOpenPanel());
game.on("projectsChanged", () => refreshOpenPanel());
game.on("energyChanged", () => {
	if (sheet.showing() === "energy") showPanel("energy");
});
game.on("message", (text, kind) => toasts.show(text, kind));
game.on("merged", (index) => board.celebrate(index));
game.on("produced", (index) => board.celebrate(index));
game.on("levelUp", (level, reward) => overlays.levelUp(level, reward));
game.on("caughtUp", (summary) => overlays.caughtUp(summary));

// --- The clock ----------------------------------------------------------------

game.start();
hud.refresh();
board.paint();
dock.refresh();

setInterval(() => {
	game.tick();
	hud.tick();
	board.tickBadges();
	itemBar.refresh();
}, 1000);

// A tab that was in the background has a stale clock and a stale board; the tick
// that catches it up should not wait for the next second to come around.
document.addEventListener("visibilitychange", () => {
	if (document.visibilityState !== "visible") return;
	game.tick();
	hud.refresh();
	board.paint();
	board.tickBadges();
	dock.refresh();
});

document.querySelector("#boot-panel").remove();

if ("serviceWorker" in navigator) {
	window.addEventListener("load", () => {
		navigator.serviceWorker.register("sw.js").catch((error) => {
			// Offline play is the only casualty, and it is not worth a visible error.
			console.warn("Service worker registration failed.", error);
		});
	});
}
