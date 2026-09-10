/**
 * Draws the app icons.
 *
 *     node tools/make-icons.mjs
 *
 * The icon is the game in one picture: two of a kind at the bottom, one better
 * thing above them. It is drawn here rather than exported from a drawing program
 * so that changing a colour is a one-line edit followed by a re-run, with no
 * binary to keep in step by hand.
 *
 * Shapes are signed distance fields, so a pixel's coverage is its distance from
 * the edge rather than a count of samples inside it. That is one evaluation per
 * pixel instead of the sixteen supersampling would take, and the edges come out
 * cleaner than either at this size.
 *
 * Output is a PNG written by hand: raw scanlines, one zlib stream, three chunks.
 * A dependency-free build step for five files is worth more than the twenty
 * lines it costs.
 */
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ICONS = join(dirname(fileURLToPath(import.meta.url)), "..", "icons");

const NAVY = "#1b3b4b";
const DEEP = "#14303e";
const CORAL = "#ef8f5a";
const CORAL_EDGE = "#d4703c";
const GOLD = "#e5a72c";
const CREAM = "#fffaf1";

/** Everything below is in fractions of the icon's width, so one drawing serves every size. */
const SMALL = { half: 0.125, radius: 0.042, y: 0.735, dx: 0.185 };
const BIG = { half: 0.185, radius: 0.06, y: 0.36 };
const ARROW = { y: 0.578, half: 0.09, thickness: 0.038 };

/** Every icon the manifest and the shell name, and how far the drawing is pulled in. */
const SIZES = [
	["icon-192.png", 192, 1],
	["icon-512.png", 512, 1],
	["icon-1024.png", 1024, 1],
	["apple-touch-icon-180.png", 180, 1],
	// Maskable icons are cropped to a circle inside the square by some launchers,
	// so this one is pulled in far enough to survive it.
	["icon-maskable-512.png", 512, 0.72],
];

function main() {
	for (const [name, size, inset] of SIZES) {
		writeFileSync(join(ICONS, name), encode(size, size, draw(size, inset)));
		process.stdout.write(`icons/${name}\n`);
	}
}

function draw(size, inset) {
	const pixels = new Uint8Array(size * size * 4);
	const background = rgb(NAVY);
	for (let i = 0; i < size * size; i += 1) {
		pixels[i * 4] = background[0];
		pixels[i * 4 + 1] = background[1];
		pixels[i * 4 + 2] = background[2];
		pixels[i * 4 + 3] = 255;
	}

	const at = (value) => (value - 0.5) * inset * size + size / 2;
	const of = (value) => value * inset * size;

	// A darker floor, so the tiles sit on something rather than float.
	fill(pixels, size, box(at(0.5), at(0.86), of(0.34), of(0.055), of(0.055)), rgb(DEEP), 1);

	// The pair.
	for (const direction of [-1, 1]) {
		const x = at(0.5 + direction * SMALL.dx);
		fill(pixels, size, box(x, at(SMALL.y) + of(0.012), of(SMALL.half), of(SMALL.half), of(SMALL.radius)),
			rgb(CORAL_EDGE), 1);
		fill(pixels, size, box(x, at(SMALL.y), of(SMALL.half), of(SMALL.half), of(SMALL.radius)),
			rgb(CORAL), 1);
	}

	// What they become.
	fill(pixels, size, box(at(0.5), at(BIG.y) + of(0.016), of(BIG.half), of(BIG.half), of(BIG.radius)),
		rgb(CORAL_EDGE), 1);
	fill(pixels, size, box(at(0.5), at(BIG.y), of(BIG.half), of(BIG.half), of(BIG.radius)), rgb(GOLD), 1);
	fill(pixels, size, ring(at(0.5), at(BIG.y), of(0.085), of(0.036)), rgb(CREAM), 1);

	// The chevron between them, pointing up at what the pair turns into.
	const arm = (direction) => box(
		at(0.5) + direction * of(ARROW.half) / 2,
		at(ARROW.y),
		of(ARROW.half) * 0.58,
		of(ARROW.thickness) / 2,
		of(ARROW.thickness) / 2,
		direction * 0.72,
	);
	fill(pixels, size, arm(-1), rgb(CREAM), 0.9);
	fill(pixels, size, arm(1), rgb(CREAM), 0.9);
	return pixels;
}

/** A rounded box as a signed distance: negative inside, in pixels. */
function box(centreX, centreY, halfWidth, halfHeight, radius, angle = 0) {
	const r = Math.min(radius, halfWidth, halfHeight);
	const cos = Math.cos(angle);
	const sin = Math.sin(angle);
	return (x, y) => {
		const localX = (x - centreX) * cos + (y - centreY) * sin;
		const localY = -(x - centreX) * sin + (y - centreY) * cos;
		const dx = Math.abs(localX) - halfWidth + r;
		const dy = Math.abs(localY) - halfHeight + r;
		const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
		return outside + Math.min(Math.max(dx, dy), 0) - r;
	};
}

/** A circle with the middle taken out. */
function ring(centreX, centreY, radius, thickness) {
	return (x, y) => Math.abs(Math.hypot(x - centreX, y - centreY) - radius) - thickness / 2;
}

/**
 * Paints a shape, using the distance at each pixel centre as its coverage. One
 * pixel of falloff either side of the edge is what antialiases it.
 */
function fill(pixels, size, shape, colour, alpha) {
	for (let y = 0; y < size; y += 1) {
		for (let x = 0; x < size; x += 1) {
			const distance = shape(x + 0.5, y + 0.5);
			if (distance > 1) continue;
			const coverage = Math.min(Math.max(0.5 - distance, 0), 1) * alpha;
			if (coverage <= 0) continue;
			const at = (y * size + x) * 4;
			for (let channel = 0; channel < 3; channel += 1) {
				pixels[at + channel] = Math.round(
					pixels[at + channel] * (1 - coverage) + colour[channel] * coverage,
				);
			}
		}
	}
}

function rgb(hex) {
	return [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16));
}

// --- PNG --------------------------------------------------------------------

function encode(width, height, pixels) {
	const stride = width * 4;
	// One filter byte per scanline. Filter 0 means "store the bytes as they are",
	// which is all this needs: the shapes are flat colour and deflate handles the
	// repetition without help.
	const raw = Buffer.alloc((stride + 1) * height);
	for (let y = 0; y < height; y += 1) {
		raw[y * (stride + 1)] = 0;
		Buffer.from(pixels.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1);
	}

	const header = Buffer.alloc(13);
	header.writeUInt32BE(width, 0);
	header.writeUInt32BE(height, 4);
	header[8] = 8; // bits per channel
	header[9] = 6; // truecolour with alpha
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk("IHDR", header),
		chunk("IDAT", deflateSync(raw, { level: 9 })),
		chunk("IEND", Buffer.alloc(0)),
	]);
}

function chunk(type, body) {
	const length = Buffer.alloc(4);
	length.writeUInt32BE(body.length, 0);
	const tagged = Buffer.concat([Buffer.from(type, "ascii"), body]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(tagged), 0);
	return Buffer.concat([length, tagged, crc]);
}

const CRC_TABLE = (() => {
	const table = new Uint32Array(256);
	for (let i = 0; i < 256; i += 1) {
		let value = i;
		for (let bit = 0; bit < 8; bit += 1) {
			value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
		}
		table[i] = value >>> 0;
	}
	return table;
})();

function crc32(buffer) {
	let crc = 0xffffffff;
	for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
	return (crc ^ 0xffffffff) >>> 0;
}

main();
