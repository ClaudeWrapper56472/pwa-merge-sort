/**
 * Offline play.
 *
 * Everything the game needs is static and small, so the whole app is precached
 * on install. A board you were halfway through merging should not stop working
 * because the train went into a tunnel -- and since the save lives in
 * localStorage and every clock is absolute, an offline session is a real
 * session: it keeps its progress and catches up the moment it reconnects.
 *
 * Two strategies, split by what goes wrong when a file is stale.
 *
 * Code -- the shell, the modules, the stylesheet -- is fetched from the network
 * first and falls back to the cache. They are a few kilobytes each, so the cost
 * of asking is small, and the cost of not asking is a browser pinned to an old
 * build forever: a cache-first worker with a hand-written version string serves
 * whatever it captured until someone remembers to bump the string, and a stale
 * mix of modules fails in ways that look like the app is simply broken.
 *
 * Content -- the icons -- is served cache-first. All of the art is drawn in
 * script, so there is very little of it.
 */
const CACHE = "merge-sort-v1";

/** Files whose freshness matters more than the round trip to check it. */
const CODE = /\.(?:html|js|css|webmanifest)$/;

const ASSETS = [
	"./",
	"index.html",
	"manifest.webmanifest",
	"css/style.css",
	"icons/apple-touch-icon-180.png",
	"icons/icon-192.png",
	"icons/icon-512.png",
	"icons/icon-1024.png",
	"icons/icon-maskable-512.png",
	"js/board.js",
	"js/content/chains.js",
	"js/content/orders.js",
	"js/content/progression.js",
	"js/content/projects.js",
	"js/content/shop.js",
	"js/economy.js",
	"js/game-state.js",
	"js/orders.js",
	"js/producers.js",
	"js/save-manager.js",
	"js/save-migration.js",
	"js/settings.js",
	"js/ui/board-view.js",
	"js/ui/hud.js",
	"js/ui/item-bar.js",
	"js/ui/main.js",
	"js/ui/order-dock.js",
	"js/ui/overlays.js",
	"js/ui/page-zoom.js",
	"js/ui/panels.js",
	"js/ui/rewards.js",
	"js/ui/sheet.js",
	"js/ui/sprites.js",
	"js/ui/toast.js",
	"js/util/emitter.js",
	"js/util/format.js",
	"js/util/rng.js",
];

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches.open(CACHE)
			.then((cache) => cache.addAll(ASSETS))
			.then(() => self.skipWaiting()),
	);
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches.keys()
			.then((names) => Promise.all(
				names.filter((name) => name !== CACHE).map((name) => caches.delete(name)),
			))
			.then(() => self.clients.claim()),
	);
});

self.addEventListener("fetch", (event) => {
	const request = event.request;
	if (request.method !== "GET") return;
	if (new URL(request.url).origin !== self.location.origin) return;

	if (request.mode === "navigate") {
		event.respondWith(navigate(request));
		return;
	}

	if (CODE.test(new URL(request.url).pathname)) {
		event.respondWith(freshest(request));
		return;
	}

	event.respondWith(
		caches.match(request).then((cached) => cached ?? store(request)),
	);
});

/**
 * Opening the app. Any URL in scope is the app, so a deep link, a refresh from
 * the home screen, or a launch with no network gets the shell rather than a 404
 * or an error page.
 */
async function navigate(request) {
	const shell = async () => await caches.match(request) ?? await caches.match("index.html");
	let response;
	try {
		response = await store(request);
	} catch (error) {
		const cached = await shell();
		if (cached !== undefined) return cached;
		throw error;
	}
	if (response.ok) return response;
	return await shell() ?? response;
}

/** Network first, with the cache as the answer when the network has no good one. */
async function freshest(request) {
	let response;
	try {
		response = await store(request);
	} catch (error) {
		const cached = await caches.match(request);
		if (cached !== undefined) return cached;
		throw error;
	}
	if (response.ok) return response;
	return await caches.match(request) ?? response;
}

/** Fetches and files the result, so the next load has it offline. */
async function store(request) {
	const response = await fetch(request);
	if (response.ok) {
		const copy = response.clone();
		const cache = await caches.open(CACHE);
		await cache.put(request, copy);
	}
	return response;
}
