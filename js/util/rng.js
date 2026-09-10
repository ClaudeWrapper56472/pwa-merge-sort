/**
 * PCG32 (XSH-RR).
 *
 * One seeded generator drives every roll the game makes: what a producer pops
 * out, which order comes next, what a chest holds. The seed is saved with the
 * game, so a session picks up the same sequence it was on rather than starting
 * a fresh stream of luck each time the tab is reopened.
 *
 * 64-bit state in BigInt. A few hundred draws a session; the cost is invisible.
 */

const MULTIPLIER = 6364136223846793005n;
const MASK64 = 0xffffffffffffffffn;
const DEFAULT_INC = 1442695040888963407n;

export class Rng {
	constructor(seed = 0) {
		this.setSeed(seed);
	}

	setSeed(seed) {
		this._inc = DEFAULT_INC;
		this._state = 0n;
		this.nextUint32();
		this._state = (this._state + (BigInt(seed) & MASK64)) & MASK64;
		this.nextUint32();
	}

	/** Draws a fresh seed from the platform, for when no seed was asked for. */
	static randomSeed() {
		const words = new Uint32Array(2);
		crypto.getRandomValues(words);
		// Kept inside 2^53 so it survives a round trip through JSON.
		return words[0] * 0x200000 + (words[1] >>> 11);
	}

	nextUint32() {
		const previous = this._state;
		this._state = (previous * MULTIPLIER + this._inc) & MASK64;
		const xorshifted = Number(((previous >> 18n) ^ previous) >> 27n & 0xffffffffn);
		const rotation = Number(previous >> 59n);
		return ((xorshifted >>> rotation) | (xorshifted << (-rotation & 31))) >>> 0;
	}

	/** Inclusive at both ends. */
	randiRange(from, to) {
		const span = to - from + 1;
		return span <= 0 ? from : from + (this.nextUint32() % span);
	}

	/** One item, or undefined from an empty list. */
	pick(items) {
		return items.length === 0 ? undefined : items[this.randiRange(0, items.length - 1)];
	}

	/**
	 * One index from a list of weights. Weights need not sum to anything in
	 * particular; a list that sums to zero returns the first index.
	 */
	pickWeighted(weights) {
		let total = 0;
		for (const weight of weights) total += weight;
		if (total <= 0) return 0;
		let roll = this.randiRange(1, total);
		for (let index = 0; index < weights.length; index += 1) {
			roll -= weights[index];
			if (roll <= 0) return index;
		}
		return weights.length - 1;
	}

	/** Fisher-Yates in place. */
	shuffle(items) {
		for (let i = items.length - 1; i > 0; i -= 1) {
			const j = this.randiRange(0, i);
			const swap = items[i];
			items[i] = items[j];
			items[j] = swap;
		}
		return items;
	}

	/** The state, small enough to sit in the save document. */
	save() {
		return this._state.toString();
	}

	restore(text) {
		try {
			this._state = BigInt(text) & MASK64;
			this._inc = DEFAULT_INC;
		} catch {
			this.setSeed(0);
		}
	}
}
