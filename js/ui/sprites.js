/**
 * All of the art, drawn as SVG in code.
 *
 * Thirty-six items and a handful of HUD glyphs, every one of them shapes with a
 * few numbers rather than an image file. A new tier costs a function, not a
 * spritesheet, and the whole app installs offline with no binary assets at all.
 *
 * One coordinate system: every item draws into a 100x100 box, so the same markup
 * serves a tile on the board, a line in an order and a row in the catalogue. No
 * gradients and no ids anywhere -- a sprite is inlined in several places at once
 * and duplicate ids would quietly break the first copy. Volume comes from a
 * darker underside shape instead.
 */

const WOOD = "#b4794a";
const WOOD_DARK = "#8a5a34";
const STEEL = "#9aa6b2";
const STEEL_DARK = "#6d7a88";
const BRASS = "#d8a441";
const BRASS_DARK = "#a97c26";
const RUST = "#b5713f";
const GLASS = "#bfe3ec";
const SEA = "#3f8fa8";
const SEA_DARK = "#2c6f86";
const SILVER = "#cfd8e0";
const SILVER_DARK = "#9aa8b6";
const COFFEE = "#6b4327";
const COFFEE_DARK = "#4c2e1a";
const CREAM = "#f0dcc0";
const RED = "#cc5b4a";
const RED_DARK = "#a4402f";
const CANVAS = "#d9c39b";
const CANVAS_DARK = "#b39d76";
const ROPE = "#d8c08a";
const LEAF = "#5f9e63";
const INK = "#3b3129";
const NAVY_CAP = "#1b3b4b";

/** The one shadow every item stands on, so a board of them shares a light. */
function ground(cx = 50, cy = 90, rx = 27, ry = 5.5) {
	return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${INK}" opacity="0.16"/>`;
}

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Framing.
 *
 * Every drawing works in a hundred-unit box, and each one uses as much of it as
 * its shape happens to need: a minnow half of it, a swordfish rather more than
 * all of it. Left at a fixed box that means half-empty tiles for some items and
 * a clipped bill for others.
 *
 * So the box is not fixed. Each sprite is measured once -- the browser already
 * knows exactly where the ink went -- and framed on what it actually drew,
 * squared up so a tall item and a wide one both fill a tile without either
 * being stretched. Hand-written viewBoxes would do the same job and go stale
 * the first time a drawing changed.
 *
 * Measured lazily, remembered for the life of the page, and skipped where there
 * is no document at all, which is how the self-check runs this file.
 */
const DEFAULT_FRAME = { x: 4, y: 4, side: 92 };

/** Room for the half of a stroke that getBBox does not count, and for the cell's corners. */
const FRAME_MARGIN = 0.06;

const frames = new Map();
let ruler = null;

function wrap(body, frame = DEFAULT_FRAME) {
	const box = `${round(frame.x)} ${round(frame.y)} ${round(frame.side)} ${round(frame.side)}`;
	return `<svg viewBox="${box}" xmlns="${SVG_NS}" aria-hidden="true" focusable="false">${body}</svg>`;
}

function round(value) {
	return Math.round(value * 10) / 10;
}

function framed(key, body) {
	let frame = frames.get(key);
	if (frame === undefined) {
		frame = measure(body) ?? DEFAULT_FRAME;
		frames.set(key, frame);
	}
	return wrap(body, frame);
}

/** The drawn extent of some markup, or null when nothing here can measure it. */
function measure(body) {
	if (typeof document === "undefined" || document.body === null) return null;
	if (ruler === null) {
		ruler = document.createElementNS(SVG_NS, "svg");
		ruler.setAttribute("viewBox", "0 0 100 100");
		ruler.setAttribute("width", "100");
		ruler.setAttribute("height", "100");
		ruler.style.cssText = "position:absolute;left:-9999px;top:0;visibility:hidden";
		document.body.append(ruler);
	}

	let box;
	try {
		ruler.innerHTML = body;
		box = ruler.getBBox();
	} catch {
		return null;
	} finally {
		ruler.innerHTML = "";
	}
	if (!(box.width > 0) || !(box.height > 0)) return null;

	const side = Math.max(box.width, box.height) * (1 + FRAME_MARGIN * 2);
	return {
		x: box.x + box.width / 2 - side / 2,
		y: box.y + box.height / 2 - side / 2,
		side,
	};
}

function circle(cx, cy, r, fill, extra = "") {
	return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" ${extra}/>`;
}

function rect(x, y, w, h, fill, r = 0) {
	return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"/>`;
}

function path(d, fill, extra = "") {
	return `<path d="${d}" fill="${fill}" ${extra}/>`;
}

function line(x1, y1, x2, y2, colour, width = 3, cap = "round") {
	return `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${colour}" stroke-width="${width}" stroke-linecap="${cap}" fill="none"/>`;
}

/** A soft white glint, the one highlight shared by everything round. */
function glint(cx, cy, rx, ry, rotate = -30, opacity = 0.35) {
	return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#ffffff" opacity="${opacity}" transform="rotate(${rotate} ${cx} ${cy})"/>`;
}

// --- Salvage ----------------------------------------------------------------

function bolt() {
	const head = "M50 18L68 28V48L50 58L32 48V28Z";
	return ground(50, 88, 20, 5)
		+ rect(44, 46, 12, 34, RUST, 2)
		+ line(38, 56, 62, 56, "#8d5730", 2.5, "butt")
		+ line(38, 64, 62, 64, "#8d5730", 2.5, "butt")
		+ line(38, 72, 62, 72, "#8d5730", 2.5, "butt")
		+ path(head, STEEL)
		+ path("M50 18L68 28L50 38L32 28Z", "#b6c0ca")
		+ path("M50 38L68 28V48L50 58Z", STEEL_DARK, 'opacity="0.55"');
}

function hinge() {
	return ground()
		+ path("M24 24H46V76H24Z", BRASS)
		+ path("M54 24H76V76H54Z", BRASS)
		+ path("M24 50H46V76H24Z", BRASS_DARK, 'opacity="0.45"')
		+ path("M54 50H76V76H54Z", BRASS_DARK, 'opacity="0.45"')
		+ rect(44, 20, 12, 60, "#c08f2f", 6)
		+ circle(50, 30, 3.4, "#f2d089")
		+ circle(50, 50, 3.4, "#f2d089")
		+ circle(50, 70, 3.4, "#f2d089")
		+ circle(34, 36, 3, BRASS_DARK)
		+ circle(34, 64, 3, BRASS_DARK)
		+ circle(66, 36, 3, BRASS_DARK)
		+ circle(66, 64, 3, BRASS_DARK);
}

/** Teeth generated rather than drawn, so the tooth count is one number. */
function cogPath(cx, cy, outer, inner, teeth) {
	const points = [];
	const step = Math.PI / teeth;
	for (let index = 0; index < teeth * 2; index += 1) {
		const radius = index % 2 === 0 ? outer : inner;
		const angle = index * step - Math.PI / 2;
		points.push(`${(cx + Math.cos(angle) * radius).toFixed(1)} ${(cy + Math.sin(angle) * radius).toFixed(1)}`);
	}
	return `M${points.join("L")}Z`;
}

function cog() {
	return ground()
		+ path(cogPath(50, 50, 38, 29, 9), STEEL)
		+ circle(50, 50, 25, "#b3bdc7")
		+ circle(50, 50, 10, "#7d8a97")
		+ circle(50, 50, 6, "#5f6b78")
		+ glint(38, 36, 12, 5, -35, 0.4);
}

function tackle() {
	return ground()
		+ line(50, 4, 50, 22, ROPE, 4)
		+ path("M30 20H70V56A20 20 0 0 1 30 56Z", WOOD)
		+ path("M30 44H70V56A20 20 0 0 1 30 56Z", WOOD_DARK, 'opacity="0.5"')
		+ circle(50, 40, 15, "#5f6b78")
		+ circle(50, 40, 10, STEEL)
		+ circle(50, 40, 4, "#4b5560")
		+ line(50, 74, 50, 80, ROPE, 4)
		+ `<path d="M50 78v6a8 8 0 1 0 8-8" fill="none" stroke="${STEEL_DARK}" stroke-width="5" stroke-linecap="round"/>`;
}

function lantern() {
	return ground()
		+ `<path d="M34 12a16 10 0 0 1 32 0" stroke="${STEEL_DARK}" stroke-width="4" fill="none"/>`
		+ path("M36 18H64V28H36Z", STEEL_DARK)
		+ path("M32 28H68L64 66H36Z", GLASS)
		+ path("M46 40H54L58 62H42Z", "#f6b74a")
		+ circle(50, 44, 8, "#ffd980", 'opacity="0.75"')
		+ path("M32 28H68L66 34H34Z", STEEL)
		+ rect(30, 64, 40, 10, STEEL, 3)
		+ rect(34, 74, 32, 8, STEEL_DARK, 3)
		+ line(36, 30, 36, 62, "#ffffff", 2.5)
		+ `<g opacity="0.5">${line(64, 30, 64, 62, STEEL_DARK, 2.5)}</g>`;
}

function anchor() {
	return ground()
		+ `<circle cx="50" cy="18" r="8" fill="none" stroke="${STEEL_DARK}" stroke-width="5"/>`
		+ rect(45, 26, 10, 52, STEEL, 3)
		+ rect(30, 32, 40, 8, STEEL_DARK, 4)
		+ `<path d="M18 56c0 18 14 28 32 28s32-10 32-28" fill="none" stroke="${STEEL}" stroke-width="10" stroke-linecap="round"/>`
		+ path("M10 50L28 54L18 66Z", STEEL_DARK)
		+ path("M90 50L72 54L82 66Z", STEEL_DARK)
		+ glint(45, 40, 3, 12, 0, 0.3);
}

function compass() {
	return ground()
		+ circle(50, 52, 36, BRASS_DARK)
		+ circle(50, 52, 31, "#f2e6cd")
		+ circle(50, 52, 27, "#fdf6e6")
		+ path("M50 26L57 52L50 46L43 52Z", RED)
		+ path("M50 78L43 52L50 58L57 52Z", "#5a6470")
		+ circle(50, 52, 4, BRASS_DARK)
		+ rect(44, 8, 12, 10, BRASS, 3)
		+ line(50, 18, 50, 22, BRASS_DARK, 4)
		+ glint(38, 36, 10, 4, -35, 0.55);
}

function bottleShip() {
	return ground(50, 84, 30, 5)
		+ path("M20 34H70A18 18 0 0 1 70 74H20A6 6 0 0 1 20 34Z", GLASS, 'opacity="0.9"')
		+ rect(70, 46, 14, 16, "#e3d3b0", 3)
		+ rect(82, 48, 8, 12, "#a97c4a", 3)
		+ path("M28 62H60L56 70H32Z", WOOD_DARK)
		+ line(44, 40, 44, 62, "#6b5a44", 2.5)
		+ path("M44 42L58 52L44 56Z", "#fdf6e6")
		+ path("M44 42L30 52L44 56Z", "#efe4cd")
		+ path("M22 66H62L60 70H24Z", SEA, 'opacity="0.55"')
		+ glint(34, 44, 12, 5, -30, 0.5);
}

// --- The catch ---------------------------------------------------------------

/**
 * One fish, sized and coloured. Everything that swims shares this outline so a
 * board of them reads as one chain; the differences are length, fins and stripes.
 */
function fish({ length, height, body, belly, tail = 1, dorsal = 0, stripes = 0, bill = 0 }) {
	const left = 50 - length / 2;
	const right = 50 + length / 2;
	const top = 52 - height / 2;
	const bottom = 52 + height / 2;
	const parts = [ground(50, 86, length * 0.42, 5)];

	if (dorsal > 0) {
		parts.push(path(`M${50 - length * 0.16} ${top + 2}Q50 ${top - dorsal} ${50 + length * 0.2} ${top + 3}Z`, belly));
	}
	parts.push(path(
		`M${right} 52Q${right - length * 0.3} ${top} ${50 - length * 0.1} ${top + 1}`
		+ `Q${left} ${top + height * 0.2} ${left} 52`
		+ `Q${left} ${bottom - height * 0.2} ${50 - length * 0.1} ${bottom - 1}`
		+ `Q${right - length * 0.3} ${bottom} ${right} 52Z`,
		body,
	));
	parts.push(path(
		`M${right} 52Q${right - length * 0.3} ${bottom} ${50 - length * 0.1} ${bottom - 1}`
		+ `Q${left} ${bottom - height * 0.2} ${left} 52Z`,
		belly,
		'opacity="0.65"',
	));
	if (bill > 0) parts.push(path(`M${right} 52L${right + bill} 50L${right} 55Z`, belly));
	parts.push(path(`M${left} 52L${left - length * 0.22 * tail} ${52 - height * 0.55}L${left - length * 0.22 * tail} ${52 + height * 0.55}Z`, belly));
	for (let index = 0; index < stripes; index += 1) {
		const x = 50 - length * 0.16 + index * (length * 0.13);
		parts.push(line(x, top + 4, x - 3, bottom - 5, "#ffffff", 2.4));
	}
	parts.push(path(`M${50 - length * 0.05} ${bottom - 2}q6 8 12 1Z`, belly));
	parts.push(circle(50 + length * 0.3, 49, 3.4, "#ffffff"));
	parts.push(circle(50 + length * 0.31, 49, 1.8, INK));
	return parts.join("");
}

const minnow = () => fish({ length: 40, height: 18, body: "#8fb8c9", belly: SILVER });
const sardine = () => fish({ length: 54, height: 22, body: SILVER, belly: SILVER_DARK, stripes: 1 });
const mackerel = () => fish({ length: 64, height: 27, body: "#5c9e8f", belly: SILVER, stripes: 3 });
const seabass = () => fish({ length: 72, height: 33, body: "#6f89a6", belly: SILVER, dorsal: 14, stripes: 2 });

function lobster() {
	const leg = (x, y, dx) => line(x, y, x + dx, y + 12, RED_DARK, 3);
	return ground(50, 88, 26, 5)
		+ line(38, 30, 26, 12, RED_DARK, 2.5)
		+ line(62, 30, 74, 12, RED_DARK, 2.5)
		+ path("M28 30q8-12 16 0q-8 8-16 0Z", RED)
		+ path("M72 30q-8-12-16 0q8 8 16 0Z", RED)
		+ path("M38 36H62L58 62H42Z", RED)
		+ path("M42 62H58L57 70H43Z", RED_DARK)
		+ path("M41 70H59L57 78H43Z", RED)
		+ path("M40 78H60L50 90L40 78Z", RED_DARK)
		+ leg(40, 44, -10) + leg(40, 52, -10) + leg(60, 44, 10) + leg(60, 52, 10)
		+ circle(45, 40, 2.4, "#ffffff") + circle(55, 40, 2.4, "#ffffff");
}

const swordfish = () => fish({ length: 58, height: 22, body: "#3b5f88", belly: "#c6d4e2", dorsal: 26, bill: 30 });

function pearl() {
	return ground(50, 86, 28, 5)
		+ path("M14 62a36 26 0 0 1 72 0Z", "#e7dcc9")
		+ path("M18 62a32 22 0 0 1 64 0Z", "#f6efe0")
		+ path("M14 62a36 20 0 0 0 72 0Z", "#d8cbb4")
		+ line(50, 42, 50, 62, "#c9bba2", 2)
		+ line(34, 46, 26, 62, "#c9bba2", 2)
		+ line(66, 46, 74, 62, "#c9bba2", 2)
		+ circle(50, 54, 13, "#ffffff")
		+ circle(50, 54, 13, "#f2f6f8", 'opacity="0.9"')
		+ glint(45, 49, 5, 3, -30, 0.9);
}

// --- The café ----------------------------------------------------------------

function cherry() {
	return ground(50, 84, 18, 4.5)
		+ line(52, 40, 62, 22, "#7a5b3a", 3)
		+ path("M62 24q14-10 18 2q-14 8-18-2Z", LEAF)
		+ circle(48, 58, 22, "#cf4436")
		+ circle(48, 58, 22, RED, 'opacity="0.6"')
		+ path("M48 36a22 22 0 0 0 0 44a14 22 0 0 1 0-44Z", "#e06a56", 'opacity="0.6"')
		+ glint(41, 49, 7, 4, -30, 0.5);
}

function bean() {
	return ground(50, 82, 22, 5)
		+ `<ellipse cx="50" cy="54" rx="28" ry="21" fill="${COFFEE}" transform="rotate(-20 50 54)"/>`
		+ `<ellipse cx="50" cy="54" rx="28" ry="21" fill="${COFFEE_DARK}" opacity="0.35" transform="rotate(-20 50 54)"/>`
		+ `<path d="M28 62q22-22 44-16" stroke="${COFFEE_DARK}" stroke-width="4" fill="none" stroke-linecap="round"/>`
		+ glint(38, 44, 9, 4, -25, 0.28);
}

function cupOfDrip() {
	return ground(50, 88, 22, 5)
		+ path("M32 34H68L63 84H37Z", "#eadfcd")
		+ path("M50 34H68L63 84H50Z", "#cfc0a8", 'opacity="0.7"')
		+ rect(29, 26, 42, 10, "#cdbfa8", 4)
		+ rect(32, 18, 36, 9, "#a8967c", 4)
		+ rect(34, 50, 32, 16, "#b9784a", 2)
		+ line(40, 58, 60, 58, "#8a5330", 3);
}

function espresso() {
	return ground(50, 84, 26, 5)
		+ path("M30 40H66V58A18 18 0 0 1 30 58Z", "#fdf6e6")
		+ path("M30 52H66V58A18 18 0 0 1 30 58Z", "#e6dccb")
		+ `<path d="M66 44h6a9 9 0 0 1 0 18h-6" fill="none" stroke="#fdf6e6" stroke-width="6"/>`
		+ `<ellipse cx="48" cy="40" rx="18" ry="6" fill="${COFFEE}"/>`
		+ `<ellipse cx="48" cy="39" rx="13" ry="4" fill="#a36b3f"/>`
		+ path("M20 78H76L74 84H22Z", "#eee5d5")
		+ `<ellipse cx="48" cy="78" rx="28" ry="6" fill="#fdf6e6"/>`;
}

function latte() {
	return ground(50, 88, 20, 5)
		+ path("M34 26H66L62 84H38Z", "#dff0f5", 'opacity="0.55"')
		+ path("M36 46H64L61 82H39Z", COFFEE)
		+ path("M36 46H64L63 58H37Z", "#a3703f")
		+ path("M35 34H65L64 46H36Z", CREAM)
		+ `<ellipse cx="50" cy="34" rx="15" ry="6" fill="#fdf6e6"/>`
		+ circle(43, 32, 3, "#ffffff")
		+ circle(52, 31, 4, "#ffffff")
		+ line(38, 50, 38, 78, "#ffffff", 2.5);
}

function mocha() {
	return ground(50, 90, 26, 5)
		+ path("M28 34H72L66 86H34Z", "#e9f2f5", 'opacity="0.6"')
		+ path("M31 50H69L65 84H35Z", COFFEE_DARK)
		+ path("M31 50H69L67 62H33Z", COFFEE)
		+ `<path d="M28 34q10-14 22-6q12-14 22 6Z" fill="#fdf6e6"/>`
		+ circle(40, 26, 9, "#fdf6e6")
		+ circle(56, 24, 11, "#fdf6e6")
		+ circle(48, 20, 8, "#fff9ee")
		+ line(60, 12, 68, 46, RED, 5)
		+ `<path d="M40 22q8 6 16 0" stroke="#a3542f" stroke-width="3" fill="none" stroke-linecap="round"/>`;
}

// --- Salvage carts (producers) ------------------------------------------------

function sack() {
	return ground()
		+ path("M30 40q20-10 40 0l6 32a10 10 0 0 1-9 12H33a10 10 0 0 1-9-12Z", CANVAS)
		+ path("M50 40q10-2 20 0l6 32a10 10 0 0 1-9 12H50Z", CANVAS_DARK, 'opacity="0.5"')
		+ path("M32 26q18-8 36 0l2 14q-20-8-40 0Z", "#e7d6b3")
		+ line(30, 34, 70, 34, ROPE, 4)
		+ circle(30, 34, 4, ROPE) + circle(70, 34, 4, ROPE)
		+ rect(42, 58, 16, 14, "#c2ab84", 2);
}

function crate() {
	return ground()
		+ rect(20, 30, 60, 52, WOOD, 4)
		+ rect(24, 34, 52, 44, "#c98f5c", 3)
		+ line(24, 78, 76, 34, WOOD_DARK, 5)
		+ line(24, 34, 76, 78, WOOD_DARK, 5)
		+ rect(20, 30, 60, 8, WOOD_DARK, 3)
		+ rect(20, 74, 60, 8, WOOD_DARK, 3)
		+ rect(44, 24, 12, 8, STEEL_DARK, 2);
}

function toolbox() {
	return ground()
		+ `<path d="M32 22h36" stroke="${STEEL_DARK}" stroke-width="5" fill="none"/>`
		+ `<path d="M32 22v12M68 22v12" stroke="${STEEL_DARK}" stroke-width="5"/>`
		+ rect(16, 34, 68, 20, RED, 5)
		+ rect(16, 52, 68, 30, RED_DARK, 5)
		+ rect(16, 50, 68, 6, "#8f3527")
		+ rect(42, 46, 16, 12, STEEL, 3)
		+ circle(50, 52, 3, "#5f6b78")
		+ line(24, 64, 34, 64, "#e39a8c", 4)
		+ line(66, 64, 76, 64, "#e39a8c", 4);
}

function workbench() {
	return ground(50, 92, 32, 5)
		+ rect(16, 44, 68, 12, WOOD, 3)
		+ rect(16, 54, 68, 4, WOOD_DARK)
		+ rect(22, 58, 8, 32, WOOD_DARK, 2)
		+ rect(70, 58, 8, 32, WOOD_DARK, 2)
		+ rect(24, 70, 52, 8, "#a06f43", 2)
		+ path("M18 34L30 22L34 26L24 40Z", STEEL)
		+ rect(40, 30, 22, 14, RED, 3)
		+ circle(70, 34, 10, STEEL_DARK)
		+ circle(70, 34, 5, STEEL)
		+ line(58, 44, 78, 44, "#5f6b78", 4);
}

function salvageYard() {
	return ground(50, 92, 36, 5)
		+ rect(10, 66, 30, 22, WOOD, 3)
		+ rect(14, 70, 22, 14, "#c98f5c", 2)
		+ rect(44, 74, 26, 14, WOOD_DARK, 3)
		+ line(58, 14, 58, 74, STEEL_DARK, 6)
		+ line(58, 18, 88, 30, STEEL, 6)
		+ line(88, 30, 88, 46, "#5f6b78", 3)
		+ path("M82 46h12v10H82Z", BRASS)
		+ rect(48, 56, 24, 16, RED, 3)
		+ circle(30, 88, 6, "#4b5560") + circle(66, 88, 6, "#4b5560");
}

// --- The galley (producers) ---------------------------------------------------

function kettle() {
	return ground(50, 88, 24, 5)
		+ `<path d="M30 40q20-14 40 0" fill="none" stroke="${STEEL_DARK}" stroke-width="4"/>`
		+ path("M26 46H74L70 80H30Z", STEEL)
		+ path("M50 46H74L70 80H50Z", STEEL_DARK, 'opacity="0.45"')
		+ path("M74 52L88 44V56L74 62Z", STEEL_DARK)
		+ rect(24, 40, 52, 8, "#b6c0ca", 4)
		+ circle(50, 38, 5, RED)
		+ line(34, 56, 34, 72, "#ffffff", 3);
}

function coffeePot() {
	return ground(50, 90, 24, 5)
		+ path("M32 34H68L72 84H28Z", "#e9e2d6")
		+ path("M50 34H68L72 84H50Z", "#cdc4b4", 'opacity="0.7"')
		+ path("M36 54H64L66 78H34Z", COFFEE)
		+ path("M68 44l14-6v14l-14 4Z", "#e9e2d6")
		+ `<path d="M28 46H16a10 12 0 0 0 0 24h12" fill="none" stroke="#5f6b78" stroke-width="5"/>`
		+ rect(30, 26, 40, 10, "#5f6b78", 4)
		+ circle(50, 24, 5, RED);
}

function coffeeCart() {
	return ground(50, 92, 34, 5)
		+ path("M18 30H82L74 44H26Z", RED)
		+ path("M26 34h10l-2 10H24Zm20 0h10l-1 10H45Zm20 0h10l1 10H65Z", "#fdf6e6", 'opacity="0.85"')
		+ line(50, 18, 50, 30, STEEL_DARK, 4)
		+ rect(22, 46, 56, 30, WOOD, 4)
		+ rect(26, 50, 48, 8, "#c98f5c", 2)
		+ rect(34, 60, 32, 14, "#8a5a34", 2)
		+ circle(34, 84, 9, "#4b5560") + circle(34, 84, 4, STEEL)
		+ circle(66, 84, 9, "#4b5560") + circle(66, 84, 4, STEEL)
		+ rect(40, 36, 20, 12, "#fdf6e6", 2)
		+ circle(50, 42, 4, COFFEE);
}

function cafeCounter() {
	return ground(50, 92, 36, 5)
		+ rect(12, 58, 76, 30, WOOD, 4)
		+ rect(12, 58, 76, 8, "#c98f5c", 3)
		+ rect(20, 70, 24, 14, "#8a5a34", 2)
		+ rect(56, 70, 24, 14, "#8a5a34", 2)
		+ rect(24, 26, 40, 32, STEEL, 4)
		+ rect(28, 30, 32, 12, "#3f4a55", 2)
		+ rect(38, 44, 14, 10, "#2f3841", 2)
		+ circle(45, 49, 3, "#f6b74a")
		+ rect(66, 40, 14, 18, "#fdf6e6", 3)
		+ circle(73, 34, 6, CREAM)
		+ line(20, 24, 20, 58, STEEL_DARK, 4);
}

function roastery() {
	return ground(50, 92, 38, 5)
		+ path("M12 44L50 18L88 44Z", RED)
		+ path("M50 18L88 44H50Z", RED_DARK, 'opacity="0.45"')
		+ rect(18, 44, 64, 44, "#e9e2d6", 3)
		+ rect(18, 44, 64, 6, "#cdc4b4")
		+ rect(26, 56, 26, 24, "#6d7a88", 3)
		+ circle(39, 68, 9, COFFEE)
		+ circle(39, 68, 4, "#a3703f")
		+ rect(60, 58, 18, 30, WOOD_DARK, 3)
		+ rect(66, 10, 10, 20, "#8a5a34", 2)
		+ circle(74, 10, 5, "#ffffff", 'opacity="0.5"')
		+ circle(65, 7, 3.5, "#ffffff", 'opacity="0.4"');
}

// --- Tackle (producers) -------------------------------------------------------

function handLine() {
	return ground(50, 88, 24, 5)
		+ rect(30, 30, 40, 44, WOOD, 4)
		+ path("M30 40H70V64H30Z", ROPE)
		+ line(32, 46, 68, 46, "#c9b38a", 2)
		+ line(32, 54, 68, 54, "#c9b38a", 2)
		+ line(32, 60, 68, 60, "#c9b38a", 2)
		+ rect(26, 26, 48, 8, WOOD_DARK, 3)
		+ rect(26, 70, 48, 8, WOOD_DARK, 3)
		+ line(70, 52, 84, 68, "#efe4cd", 2)
		+ `<path d="M84 68a7 7 0 1 0 7 7a7 7 0 0 1-7-4" fill="none" stroke="${STEEL_DARK}" stroke-width="3" stroke-linecap="round"/>`;
}

function rod() {
	return ground(50, 90, 26, 5)
		+ line(18, 84, 84, 16, WOOD_DARK, 6)
		+ line(18, 84, 46, 56, "#5f6b78", 8)
		+ circle(44, 62, 10, STEEL_DARK)
		+ circle(44, 62, 5, STEEL)
		+ line(84, 16, 88, 44, "#efe4cd", 2)
		+ circle(88, 48, 6, RED)
		+ path("M82 48a6 6 0 0 1 12 0Z", "#fdf6e6")
		+ line(60, 40, 63, 44, STEEL, 3);
}

/** The mesh is chords of the circle, so no clip path and no ids. */
function mesh(cx, cy, radius, step, colour, width = 1.8) {
	const parts = [];
	for (let offset = -radius + step; offset < radius; offset += step) {
		const half = Math.sqrt(radius * radius - offset * offset);
		parts.push(line(cx + offset, cy - half, cx + offset, cy + half, colour, width));
		parts.push(line(cx - half, cy + offset, cx + half, cy + offset, colour, width));
	}
	return parts.join("");
}

function castNet() {
	return ground(50, 88, 30, 5)
		+ circle(50, 52, 36, "#f0e6cf")
		+ mesh(50, 52, 35, 9, "#c9b38a")
		+ `<circle cx="50" cy="52" r="36" fill="none" stroke="${ROPE}" stroke-width="5"/>`
		+ circle(50, 52, 7, "#c9b38a")
		+ [0, 60, 120, 180, 240, 300].map((degrees) => {
			const angle = (degrees * Math.PI) / 180;
			return circle(50 + Math.cos(angle) * 36, 52 + Math.sin(angle) * 36, 5, "#5f6b78");
		}).join("");
}

function trawlNet() {
	return ground(50, 90, 30, 5)
		+ line(14, 26, 86, 26, ROPE, 5)
		+ circle(24, 26, 7, RED) + circle(50, 24, 7, "#f0e6cf") + circle(76, 26, 7, RED)
		+ path("M18 30H82L62 84H38Z", "#f0e6cf", 'opacity="0.9"')
		+ `<g opacity="0.55">${mesh(50, 52, 30, 9, "#c9b38a")}</g>`
		+ `<path d="M18 30H82L62 84H38Z" fill="none" stroke="${ROPE}" stroke-width="4"/>`
		+ `<g transform="translate(4 12) scale(0.42)">${fish({ length: 54, height: 24, body: SILVER, belly: SILVER_DARK })}</g>`;
}

function fishingBoat() {
	return ground(50, 90, 36, 5)
		+ line(46, 8, 46, 52, WOOD_DARK, 4)
		+ path("M48 12L74 30L48 34Z", "#fdf6e6")
		+ path("M14 56H86L74 84H26Z", RED)
		+ path("M14 56H86L84 64H16Z", "#fdf6e6")
		+ rect(30, 38, 26, 18, "#e9e2d6", 3)
		+ rect(34, 42, 8, 8, "#6d7a88", 1)
		+ rect(46, 42, 8, 8, "#6d7a88", 1)
		+ circle(66, 46, 10, WOOD)
		+ `<g opacity="0.7">${mesh(66, 46, 9, 5, "#c9b38a", 1.4)}</g>`
		+ path("M20 84h60l-4 6H24Z", SEA, 'opacity="0.5"');
}

// --- The townsfolk ------------------------------------------------------------

/**
 * A face per person.
 *
 * Ten of them, and the same head every time: what makes one recognisable across
 * the strip is the colour behind it and the one thing they wear. A hat and a
 * beard carry further at thumbnail size than any amount of care taken over a
 * nose.
 */
const FACES = {
	nell: { back: "#bcd9e2", skin: "#e3b48b", hair: "#5a3a24", wears: "peaked-cap", colour: NAVY_CAP },
	otto: { back: "#e6d4b6", skin: "#d9a06a", hair: "#7a6a58", wears: "flat-cap", colour: "#8c7a5e", beard: true },
	marisol: { back: "#f6cdb8", skin: "#b57a4c", hair: "#2f2018", wears: "headscarf", colour: "#d4573f" },
	sten: { back: "#c8ded0", skin: "#f0c8a0", hair: "#c08a3e", wears: "beanie", colour: "#3f7a58", beard: true },
	pim: { back: "#dcd4ea", skin: "#efd0b4", hair: "#b9b2a8", wears: "keeper-cap", colour: "#4a5a7a", glasses: true },
	greta: { back: "#e8d8c0", skin: "#e8bd97", hair: "#9a9086", wears: "bun", colour: "#9a9086", glasses: true },
	abel: { back: "#c3dbe8", skin: "#8a5a3b", hair: "#2b2119", wears: "captain-cap", colour: "#f4f1ea", moustache: true },
	juno: { back: "#bfe0dc", skin: "#c78d5c", hair: "#1f1a16", wears: "dive-mask", colour: "#2f8ea8" },
	wren: { back: "#f0d7c4", skin: "#f2d2b4", hair: "#8a4a2c", wears: "bandana", colour: "#c9764a", long: true },
	hal: { back: "#cdd6de", skin: "#dcae84", hair: "#4a4038", wears: "watch-cap", colour: "#5a6a78" },
};

function head(face) {
	const parts = [];
	// Shoulders first, so the head and everything on it sits over them.
	parts.push(path("M18 100c0-16 14-26 32-26s32 10 32 26Z", face.wears === "captain-cap" ? "#e8e2d6" : "#4c6470"));
	parts.push(rect(43, 60, 14, 12, face.skin, 4));
	if (face.long === true) parts.push(path("M24 44c0-18 12-28 26-28s26 10 26 28v34c-8 6-44 6-52 0Z", face.hair));
	parts.push(`<ellipse cx="50" cy="46" rx="21" ry="23" fill="${face.skin}"/>`);
	if (face.beard === true) parts.push(path("M29 46c0 22 9 30 21 30s21-8 21-30c-6 10-36 10-42 0Z", face.hair));
	parts.push(circle(43, 45, 2.6, INK));
	parts.push(circle(57, 45, 2.6, INK));
	parts.push(`<path d="M45 56q5 4 10 0" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`);
	if (face.moustache === true) parts.push(path("M40 53q10-6 20 0q-10 4-20 0Z", face.hair));
	if (face.glasses === true) {
		parts.push(`<g fill="none" stroke="${INK}" stroke-width="2.2">`
			+ `<circle cx="43" cy="45" r="7"/><circle cx="57" cy="45" r="7"/><path d="M50 45h0M36 44h-5M64 44h5"/></g>`);
	}
	return parts.join("");
}

function hairFor(face) {
	if (face.wears === "bun") {
		return circle(50, 16, 10, face.hair) + path("M27 42c0-16 10-26 23-26s23 10 23 26c-6-10-40-10-46 0Z", face.hair);
	}
	if (face.long === true) return "";
	return path("M28 44c0-17 10-27 22-27s22 10 22 27c-5-11-39-11-44 0Z", face.hair);
}

function hatFor(face) {
	const colour = face.colour;
	switch (face.wears) {
		case "peaked-cap":
			return path("M26 32c0-14 11-22 24-22s24 8 24 22Z", colour)
				+ rect(22, 30, 56, 7, colour, 3)
				+ path("M74 31h14a4 4 0 0 1 0 6H74Z", "#12303e");
		case "flat-cap":
			return path("M27 32c0-14 10-21 23-21s23 7 23 21Z", colour)
				+ path("M25 31h50l10 6a3 3 0 0 1-3 4H25Z", colour);
		case "headscarf":
			return path("M26 40c0-18 11-28 24-28s24 10 24 28c-8-8-40-8-48 0Z", colour)
				+ path("M74 34l14 4-12 8Z", colour)
				+ circle(35, 22, 3, "#ffffff", 'opacity="0.65"')
				+ circle(52, 16, 3, "#ffffff", 'opacity="0.65"');
		case "beanie":
			return path("M27 34c0-15 10-24 23-24s23 9 23 24Z", colour)
				+ rect(25, 30, 50, 8, "#2f5f45", 4)
				+ circle(50, 8, 5, colour);
		case "keeper-cap":
			return path("M27 33c0-14 10-22 23-22s23 8 23 22Z", colour)
				+ rect(23, 31, 54, 7, "#33405c", 3)
				+ path("M23 32h-8a3 3 0 0 0 0 6h8Z", "#33405c");
		case "captain-cap":
			return path("M28 32c0-13 10-20 22-20s22 7 22 20Z", colour)
				+ rect(24, 30, 52, 8, "#1e2a33", 3)
				+ path("M24 32h-9a3 3 0 0 0 0 6h9Z", "#1e2a33")
				+ circle(50, 22, 5, "#e5a72c");
		case "dive-mask":
			return `<rect x="27" y="16" width="46" height="16" rx="7" fill="${colour}"/>`
				+ rect(31, 19, 17, 10, "#d7f0f6", 4)
				+ rect(52, 19, 17, 10, "#d7f0f6", 4)
				+ `<path d="M27 24h-6M73 24h6" stroke="#1d5c70" stroke-width="4" stroke-linecap="round"/>`;
		case "bandana":
			return path("M27 36c0-17 10-26 23-26s23 9 23 26c-8-7-38-7-46 0Z", colour)
				+ `<path d="M27 30h46" stroke="#a85c38" stroke-width="3"/>`
				+ path("M27 34l-12 6 12 5Z", colour);
		case "watch-cap":
			return path("M28 32c0-14 10-22 22-22s22 8 22 22Z", colour)
				+ rect(25, 28, 50, 11, "#41505c", 4);
		default:
			return "";
	}
}

/** One of the townsfolk, as a round badge. */
export function portrait(customerId) {
	const face = FACES[customerId];
	if (face === undefined) return wrap("");
	const body = circle(50, 50, 50, face.back)
		+ head(face)
		+ hairFor(face)
		+ hatFor(face);
	return framed(`face:${customerId}`, body);
}

// --- Dispatch -----------------------------------------------------------------

const DRAW = {
	salvage: [bolt, hinge, cog, tackle, lantern, anchor, compass, bottleShip],
	catch: [minnow, sardine, mackerel, seabass, lobster, swordfish, pearl],
	cafe: [cherry, bean, cupOfDrip, espresso, latte, mocha],
	crates: [sack, crate, toolbox, workbench, salvageYard],
	galley: [kettle, coffeePot, coffeeCart, cafeCounter, roastery],
	nets: [handLine, rod, castNet, trawlNet, fishingBoat],
};

/** The SVG for one item, or an empty box for an item that no longer exists. */
export function itemSprite(item) {
	const draw = DRAW[item?.chain]?.[item.tier - 1];
	if (draw === undefined) return wrap("");
	return framed(`${item.chain}:${item.tier}`, draw());
}

// --- Glyphs -------------------------------------------------------------------

const GLYPHS = {
	coin: () => circle(50, 50, 40, "#e0a92c") + circle(50, 50, 32, "#f6c95a")
		+ path("M50 26l6 14 15 2-11 10 3 15-13-7-13 7 3-15-11-10 15-2Z", "#e0a92c"),
	gem: () => path("M50 12L84 40L50 90L16 40Z", "#5ec8de")
		+ path("M50 12L84 40H16Z", "#8fe0f0")
		+ path("M50 12L66 40L50 90L34 40Z", "#b6ecf6", 'opacity="0.7"'),
	energy: () => path("M56 8L24 54H46L42 92L76 44H54Z", "#f6c342")
		+ path("M56 8L24 54H46Z", "#ffe08a"),
	xp: () => circle(50, 50, 38, "#7fb069")
		+ path("M50 22l8 18 20 3-14 14 3 20-17-10-17 10 3-20-14-14 20-3Z", "#d6efc4"),
	clock: () => circle(50, 50, 38, "#c9d3dc") + circle(50, 50, 30, "#f4f7fa")
		+ line(50, 50, 50, 30, "#5f6b78", 5) + line(50, 50, 64, 58, "#5f6b78", 5),
	basket: () => path("M18 40H82L72 82H28Z", WOOD) + rect(14, 32, 72, 10, WOOD_DARK, 4)
		+ `<path d="M34 32a16 16 0 0 1 32 0" fill="none" stroke="${WOOD_DARK}" stroke-width="5"/>`,
	anchor: () => anchor(),
};

/** A HUD or panel glyph: coin, gem, energy, xp, clock, basket, anchor. */
export function glyph(name) {
	const draw = GLYPHS[name];
	if (draw === undefined) return wrap("");
	return framed(`glyph:${name}`, draw());
}
