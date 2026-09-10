# Merge Sort

A merge game, as an installable progressive web app. Salvage washes up in a
harbour depot; you drag two of a kind together to make one better thing, and fill
the orders that put the town back together.

Built to the pattern of `~/Games/pwa-nine-lives`: no dependencies, no build step,
no framework. Plain ES modules served as files, a hand-drawn service worker, and
a save in `localStorage`.

**No ads, no accounts, no sign-in, no leaderboards, and nothing to buy.** Gems
are a reward, not a product. Everything the game knows lives in the browser it is
open in.

## The game

Drag one thing onto another just like it. Two become one, one tier up. That is
the whole rule; everything below is what the tiers are for.

**Producers.** A sack, a kettle or a hand line. Tap one to spend energy and pop
something out of the chain it feeds. Each holds a number of taps that fills back
up over time — while the tab is closed as much as while it is open — and each
merges like anything else, into a bigger one that is faster, deeper and holds
more. A producer that has run dry counts down on its own tile, so the wait is a
number rather than a shrug.

Charges come back faster than energy does, deliberately. Energy is the limiter;
charges only cap how much of it can go through one producer at once, so a full
bar cannot be poured through a single sack in a minute. Two things rationing the
same tap at the same rate is just a board that sits still.

**Energy.** One point every two minutes, up to the bar. A tap costs one to four.
The way back up is coffee: the galley makes it, and a tier-one cherry gives back
exactly what the tap that made it cost. Merging is what turns that into a profit —
two cherries make a bean worth three, and two beans a cup worth eight. A player
who never merges runs level for an evening and then stops.

**Orders.** Three to five townsfolk waiting along the bottom, each after a short
list. Ten people, each with a face and a job, and never two cards from the same
one at once. Nothing on a card is ever something a producer makes directly — a
tier one is two taps and no thought, so everything asked for has been merged at
least once. Get everything on a card onto the board and deliver for coins,
experience and often a gem. Orders are only ever handed over whole. Sending one
away costs a gem, so the board is arranged around the orders rather than the
orders rerolled around the board.

What a card asks for climbs a tier every few levels and stops two short of the
top of a chain. Past level fifteen one card in thirty asks for the top itself — a
ship in a bottle is a hundred and twenty-eight rusty bolts, so it is a thing to
build a board around rather than the new normal.

**Room.** Sixty-three cells and no more, which is the real constraint. Tap
anything to see what it is, what it is worth and what two of it would make, and
sell what you are not merging.

**Coins.** Two uses, both under *Coins*. The chandler sells producers — another
sack is another eight taps an hour — and every one bought makes the next dearer,
so it is a sink rather than a strategy. The rest goes on the harbour: nine
projects, from clearing the jetty to opening the museum, each paying back in
experience, a bigger energy bar, another order slot, or a producer dropped onto
the board. The museum wants two exhibits as well as the money — the top of the
salvage chain and the top of the catch — which is where a trophy goes when you
would rather not sell it.

**Levels.** Experience comes from orders and projects. Every level fills the bar
and pays at least one gem, and the early ones open the chains: coffee at two,
fishing at four.

**Gems.** From levels, from any order worth the trouble, and from the harbour in
handfuls. They buy time and never items — a full energy bar for ten, a producer
that is ready now for three, an order sent away for one. There is nothing to buy
them with.

## The chains

| Producer | Feeds | Tiers |
| --- | --- | --- |
| Salvage carts — sack to salvage yard | Salvage | Rusty bolt → hinge → cog → block and tackle → storm lantern → anchor → compass → ship in a bottle |
| Galley — kettle to roastery | Café | Coffee cherry → bean → cup of drip → espresso → latte → mocha grande |
| Tackle — hand line to fishing boat | Catch | Minnow → sardine → mackerel → sea bass → lobster → swordfish → pearl |

Thirty-six items, and every one of them is drawn in code — `js/ui/sprites.js` is
shapes and numbers, so a new tier costs a function rather than a spritesheet, and
the whole app installs offline with no binary assets except the icons.

## Time

Every clock in the game is absolute. Energy and producer charges are stored as a
count plus the moment the part-filled one started, so six hours with the tab shut
and six hours with it open come to exactly the same thing, and resuming is the
ordinary tick given a large gap. Coming back to anything worth mentioning gets a
card that says what arrived.

## Running it

Modules and the service worker need a real origin, so open it over HTTP rather
than as a file:

```bash
cd ~/Games/merge-sort
python3 -m http.server 8000
# then http://localhost:8000
```

Installing it from the browser's Add to Home Screen gives a standalone portrait
app that plays offline.

```bash
node tests/verify.mjs      # the whole game layer, about a second
node tools/make-icons.mjs  # redraws the five app icons
```

The self-check needs Node 18 or newer. It runs everything that is not a view:
the chains, the economy, the board, producer charges, order rolling and
delivery, save migration, and a played session through `GameState` — plus the
sprite layer, because a typo in a path renders as nothing at all and a board of
nothing looks exactly like a broken app.

## Deploying

A push to `main` runs the self-check and, if it passes, publishes to GitHub
Pages. There is no build step: the job copies the app's files into `_site` and
uploads that, so the list in `.github/workflows/pages.yml` has to stay in step
with `ASSETS` in `sw.js`.

Settings → Pages → Source has to be set to **GitHub Actions** for the workflow to
have anywhere to publish to. Every URL in the app is relative, so it runs under
the project path without any base configuration.

## Layout

```
index.html               The shell, and the boot panel that catches a dead module
manifest.webmanifest     Installability: name, icons, portrait, standalone
sw.js                    Precaches everything; code network-first, icons cache-first
css/style.css            Widget chrome, layout, and every cell rule

js/content/              Data, no behaviour. All of it runs under Node.
  chains.js              Every item: tiers, values, producer output tables
  orders.js              The townsfolk, and the rule for what they ask for
  progression.js         What each level hands over, and when a chain opens
  projects.js            The harbour, and what it costs to put back

js/
  board.js               The grid: merge, move, swap, and where a drop lands
  producers.js           Charges, and the clock they come back on
  orders.js              The order book: filling slots, delivering, skipping
  economy.js             Every number the economy turns on
  game-state.js          The running game, and every event a view listens to
  save-manager.js        The save document in localStorage, plus suspend hooks
  save-migration.js      Pure version-migration functions
  settings.js            Preferences
  util/emitter.js        Named events
  util/rng.js            Seeded PCG32, saved with the game
  util/format.js         Counts and clocks
  ui/
    sprites.js           All thirty-six items and the HUD glyphs, as SVG
    board-view.js        The grid, and the drag
    hud.js, item-bar.js, order-dock.js, sheet.js, panels.js, overlays.js,
    toast.js, main.js

icons/                   The app icons, drawn by tools/make-icons.mjs
tools/make-icons.mjs     Signed distance fields to a hand-written PNG
tests/verify.mjs         Self-check for everything that is not a view
.github/workflows/       Self-check on every push; deploy to Pages from main
```

## Notes on the design

**The gesture.** Pointer events on `window` for the length of a drag, one path
for touch and mouse alike. A press that never travels eight pixels is a tap;
anything past that lifts the item onto a ghost under the finger. The cell under
the pointer is found by dividing the board's own box rather than by hit-testing,
so the gap between two cells belongs to whichever is nearer — which is what a
finger expects.

**Sprites frame themselves.** Every drawing works in a hundred-unit box and uses
as much of it as its shape happens to need — a minnow half of it, a swordfish
rather more than all of it. So the box is not fixed: each sprite is measured once
through `getBBox`, framed on what it actually drew and squared up, so a tall item
and a wide one both fill a tile without either being stretched. Hand-written
viewBoxes would do the same job and go stale the first time a drawing changed.

**Repainting.** Cells are built once and repainted only when what they hold
changes, keyed by a signature. The countdown to a producer's next charge is
deliberately not part of that signature: a tile that rewrote its own art every
second would flicker and would cancel its own pop animation. The clock lives on
the item bar, which has room for it.

**The board fits rather than being sized.** The area around the grid is a size
container and the grid takes the smaller of its two dimensions, so a seven by
nine board is as large as the screen allows on a tall phone and shrinks to fit on
a short one without ever going out of square.

**Merging never refills.** A merged producer carries both parents' charges,
capped at the new tier's, so merging is a way to grow one and never a way to
skip its clock.

**Rewards queue.** A producer handed over on a full board waits rather than
vanishing, and lands the moment a cell frees up.

## Deliberate omissions

- **No sound.** Two things move: an item pops as it lands, and everything the
  selected item would merge with breathes. Both stop under
  `prefers-reduced-motion`.
- **No tutorial.** The rule is one line, and *How to play* holds the rest.
- **No timers on orders.** An order waits as long as you do. The pressure in the
  game is the board filling up, and a second source of pressure would only make
  the first one unreadable.
- **No decoration to place.** The harbour is a list of projects and a coin sink,
  not a second game about laying out a town.
- **No chests, no wheels, no daily rewards.** They exist in the genre to bring
  players back to an app that wants their attention. This one is just here.
