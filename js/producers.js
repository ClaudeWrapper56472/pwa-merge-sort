/**
 * Producer charges, which are the real clock in the game.
 *
 * Energy limits how fast you may tap; charges limit how much there is to tap at
 * all, and they come back whether the tab is open or not. A charge is stored as
 * a count plus the moment the part-filled one started, so a session that was
 * closed for six hours and one that was watched for six hours arrive at exactly
 * the same number.
 */
import * as Chains from "./content/chains.js";

/** A fresh producer arrives full: an unlock the player cannot use is not a gift. */
export function make(chain, tier, now) {
	const spec = Chains.tierOf({ chain, tier });
	return { chain, tier, charges: spec?.charges ?? 0, chargedAt: now };
}

export function capacity(item) {
	return Chains.tierOf(item)?.charges ?? 0;
}

export function rechargeMs(item) {
	return (Chains.tierOf(item)?.recharge ?? 0) * 1000;
}

export function energyCost(item) {
	return Chains.tierOf(item)?.cost ?? 0;
}

/**
 * Brings an item's charges up to date. Returns true if anything moved, so a
 * caller can repaint only when it did.
 */
export function refresh(item, now) {
	if (!Chains.isProducer(item)) return false;
	const cap = capacity(item);
	if (item.charges >= cap) {
		item.chargedAt = now;
		return false;
	}
	const period = rechargeMs(item);
	if (period <= 0) return false;

	const elapsed = now - item.chargedAt;
	if (elapsed < period) return false;

	const gained = Math.floor(elapsed / period);
	const before = item.charges;
	item.charges = Math.min(cap, item.charges + gained);
	// Only the charges actually taken advance the clock, so the leftover part of
	// a period is not thrown away when the producer fills up.
	item.chargedAt = item.charges >= cap ? now : item.chargedAt + gained * period;
	return item.charges !== before;
}

/** Milliseconds until the next charge lands, or 0 when the producer is full. */
export function nextChargeIn(item, now) {
	if (!Chains.isProducer(item) || item.charges >= capacity(item)) return 0;
	return Math.max(0, item.chargedAt + rechargeMs(item) - now);
}

/**
 * Spends one charge. A producer that had been sitting full starts its clock now
 * rather than from whenever it filled.
 */
export function spend(item, now) {
	if (item.charges <= 0) return false;
	const wasFull = item.charges >= capacity(item);
	item.charges -= 1;
	if (wasFull) item.chargedAt = now;
	return true;
}

/**
 * The charges a merge keeps: both parents' put together, capped at the new
 * tier's. Two spent producers make a spent one, so merging is a way to grow a
 * producer and never a way to refill it.
 */
export function merged(chain, tier, a, b, now) {
	const item = { chain, tier, charges: 0, chargedAt: now };
	item.charges = Math.min(capacity(item), (a.charges ?? 0) + (b.charges ?? 0));
	return item;
}

/** What gems buy: the wait, gone. */
export function fill(item, now) {
	item.charges = capacity(item);
	item.chargedAt = now;
}
