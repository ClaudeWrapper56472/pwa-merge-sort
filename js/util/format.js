/** Number and clock formatting, so every panel writes a count the same way. */

/** 1400 -> "1.4k". Coins run to six figures and the HUD is one line wide. */
export function count(value) {
	const number = Math.floor(value);
	if (number < 10000) return String(number);
	if (number < 1000000) {
		const thousands = number / 1000;
		return `${thousands < 100 ? thousands.toFixed(1).replace(/\.0$/, "") : Math.floor(thousands)}k`;
	}
	return `${(number / 1000000).toFixed(1).replace(/\.0$/, "")}m`;
}

/** Seconds -> "4:05", or "1h 12m" once a minute count stops being useful. */
export function clock(seconds) {
	const whole = Math.max(0, Math.ceil(seconds));
	if (whole >= 3600) {
		const hours = Math.floor(whole / 3600);
		return `${hours}h ${Math.floor((whole % 3600) / 60)}m`;
	}
	const minutes = Math.floor(whole / 60);
	return `${minutes}:${String(whole % 60).padStart(2, "0")}`;
}

/** "3 crates" / "1 crate". */
export function plural(value, singular, many = `${singular}s`) {
	return `${value} ${value === 1 ? singular : many}`;
}
