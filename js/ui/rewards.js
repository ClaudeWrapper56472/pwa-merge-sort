/**
 * The rewards flying to the bar.
 *
 * A delivery pays coins, experience and often a gem, into three places at once,
 * none of them where the player is looking: the card they just pressed is at the
 * bottom of the screen and the numbers that changed are at the top. A tally that
 * changes while a thumb is still over the button is a tally nobody sees change.
 *
 * So each part of the payment leaves the card as a token and flies to the chip
 * that counts it, and the chip takes it as it lands. Straight lines and a stagger
 * rather than a scatter: three tokens arriving one after another read as three
 * separate things being paid.
 *
 * Where things are is read once, when the flight starts. Nothing here moves the
 * page, so the numbers cannot shift under a token already on its way.
 */
import { glyph } from "./sprites.js";
import * as Format from "../util/format.js";

/** Each part of a payment, in the order it leaves the card. */
const PARTS = [
	{ key: "coins", mark: "coin", chip: "#coin-chip" },
	{ key: "xp", mark: "xp", chip: "#level-chip" },
	{ key: "gems", mark: "gem", chip: "#gem-chip" },
];

const FLIGHT_MS = 620;
const STAGGER_MS = 90;

/**
 * Sends one token per part of `reward` from `from` to the chip that counts it.
 *
 * `from` is a rect read before whatever was paid for left the screen, because by
 * the time a reward exists the card that earned it has already gone.
 */
export function flyRewards(from, reward) {
	if (from === null || reward === null || typeof reward !== "object") return;
	// Someone who has asked for less motion is told by the numbers themselves.
	if (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) return;

	let sent = 0;
	for (const part of PARTS) {
		const amount = reward[part.key] ?? 0;
		if (amount <= 0) continue;
		send(from, part, amount, sent * STAGGER_MS);
		sent += 1;
	}
}

function send(from, part, amount, delay) {
	const chip = document.querySelector(part.chip);
	if (chip === null) return;
	const to = chip.getBoundingClientRect();
	const startX = from.left + from.width / 2;
	const startY = from.top + from.height / 2;

	const token = document.createElement("span");
	token.className = "fly";
	token.innerHTML = `${glyph(part.mark)}${Format.count(amount)}`;
	token.style.left = `${startX}px`;
	token.style.top = `${startY}px`;
	token.style.setProperty("--fly-x", `${to.left + to.width / 2 - startX}px`);
	token.style.setProperty("--fly-y", `${to.top + to.height / 2 - startY}px`);
	token.style.animationDelay = `${delay}ms`;
	token.style.animationDuration = `${FLIGHT_MS}ms`;
	document.body.append(token);

	// On a timer rather than on animationend, so a token is never left behind by
	// an animation that did not run.
	setTimeout(() => {
		token.remove();
		chip.classList.remove("taken");
		// Reading the layout is what lets the same class animate twice in a row.
		void chip.offsetWidth;
		chip.classList.add("taken");
	}, delay + FLIGHT_MS);
}
