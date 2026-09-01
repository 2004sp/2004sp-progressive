# Grand Exchange plugin staging

This directory is the Phase 2 staging area for the r481 Grand Exchange backport in PR #21.

It deliberately lives outside the normal `content/` tree. Native launcher paths do not compile or load these files. The option-2 custom-content path copies the normal r254 source into an ignored temporary stage and overlays this plugin only when `NODE_FEATURE_GRANDEXCHANGE=true`.

## Frozen source

- OpenRS2 cache: `runescape/568`
- Cache family: build 481
- Provided timestamp: 2007-12-12
- Frozen archive SHA-256: `868027c9ccf770b8bbb60c89aeeb9603796b40dcd501f32610176ffbf5bf1495`
- Interface group used by the first vertical slice: `105` (main Grand Exchange overview)

The source-to-local component rule from Phase 1 remains unchanged:

`local_component_id = 9000 + source_component_id`

Because a regular r254 IF1 interface needs an opening/root component while the r481 group has several top-level IF3 components, Phase 2 reserves local ID `8990` as a synthetic IF1 root for source group 105. This keeps source component 0 at local 9000 instead of shifting the frozen block.

## Option-2-only staging

`engine/grand-exchange-stage.ts` implements the isolated build path used by launcher option 2:

1. recover/restore any native pack snapshot left by an interrupted previous GE run;
2. snapshot the native `media`, `interface`, server pack, compiler symbols and installed RuneScript compiler wrapper;
3. copy normal `content/` into `engine/.custom-content-stage/grand-exchange/content`;
4. overlay this plugin's `.if` and `.rs2` sources into that copy;
5. inject the synthetic roots and implemented GE component names at their frozen local IDs;
6. append the staged GE debug procedures (`ge`, `ge106`, `ge107`, `ge108`) to the script name map;
7. temporarily add `sourcePaths` to the installed `@lostcityrs/runescript` wrapper so it compiles from `BUILD_SRC_DIR/scripts` instead of its native `../content/scripts` default;
8. convert and copy the frozen PNGs into the staged native sprite source directory;
9. build and start option 2 with `BUILD_SRC_DIR` pointing at the stage;
10. restore the native pack and compiler wrapper after the option-2 server exits.

Launcher options 1 and 3 explicitly force `NODE_FEATURE_GRANDEXCHANGE=false`. The launcher also restores a stale snapshot on its next start if an option-2 run was interrupted before its `finally` cleanup could run.

## Native r254 media path

The r254 packer does not need a new GE-specific cache format. Its media packer reads every PNG under `BUILD_SRC_DIR/sprites`, converts it into the shared sprite `index.dat` plus a `<name>.dat` entry, and writes the normal client `media` JagFile.

The r481 exports are staged with names such as:

- `r481_ge_sprite_831.png`
- `r481_ge_sprite_1168.png`
- `r481_ge_sprite_1170.png`

IF1 components then reference them in the native form, for example `graphic=r481_ge_sprite_1168,0`.

One compatibility conversion is required: r254 PixPack treats RGB magenta (`#ff00ff`) as transparent and does not preserve PNG alpha. The committed r481 source PNGs are left untouched; only their temporary staged copies convert alpha below 128 to magenta and force the staged image alpha opaque before the native media packer sees them.

## First sprite-backed overview

`content/scripts/grand_exchange/interfaces/grand_exchange_overview.if` now keeps the initial r254 geometry scaffold but uses staged r481 media for:

- the group-105 close control (`831`);
- the six buy action visuals (`1168`);
- the six sell action visuals (`1170`).

With the GE toggle enabled and launcher option 2 running, `~ge` opens this first recognisable sprite-backed overview through the staged `[debugproc,ge]` script. It is still a visual/compatibility slice: offer actions and live GE state are intentionally not wired yet.

## Group 107 helper/overlay

The r481 GE helper/overlay is reconstructed as `grand_exchange_group_107` with source components `0–18` mapped exactly to local IDs `9512–9530`; the unused tail `9531–9767` remains reserved. Its synthetic IF1 opening root is `8992`, outside the frozen component block. The source contains two top-level layers, a nested seventeen-rectangle alpha frame, no text, no sprites, and no hidden components. IF1 needs only explicit `scroll` extents on the two layers because the r481 zero extents imply their source heights; no listener, media, or visibility shim is needed.

With Grand Exchange custom content enabled, `~ge107` opens it for isolated verification. The root mapping and debug script map are inserted only into the temporary option-2 stage, alongside the other reconstructed GE groups; the native `content/` tree and native interface packs stay untouched and are restored after option 2 exits.

## Group 108 offer setup/state variant

The r481 offer setup/state variant is reconstructed as `grand_exchange_group_108` with all source components `0–97` mapped exactly to local IDs `9768–9865`; the unused tail `9866–10023` remains reserved for the frozen group-108 block. Its synthetic IF1 opening root is `8993`, outside that block.

This variant carries the buy-offer layout, item/price labels, quantity and price step controls, preset buttons, confirm state, yellow progress/state frames and submitted-offer popup. The IF1 reconstruction preserves the source hover affordances with native `activecolour`/`activegraphic` fields where possible. Source fonts `494`, `495` and `496` reuse the established native `p11`, `p12` and `b12` compatibility mappings.

Group 108 reuses the exact IF1 component renders already staged for source-equivalent group-105/group-106 tiled or canvas-offset graphics, so no duplicate derived PNGs are committed. The source model-2810 component keeps its source canvas and zoom as a runtime model slot; activating the reserved imported model is intentionally deferred with the wider item/model dependency work. No quantity, price, confirm or continue control in this milestone performs a server-side Grand Exchange transaction.

With Grand Exchange custom content enabled, `~ge108` opens the reconstructed state variant for isolated verification. The stage validates the full 98-component mapping and the dimensions of every reused media dependency before the temporary option-2 pack is built.

## Local verification

After copying this overlay onto the normal r254 base installation:

- enable **Grand Exchange (option 2 only)** under launcher **Custom Content**;
- start launcher option **2 — Custom Server + Hiscores** and allow the normal local build/repack to complete;
- log in and run `~ge`, `~ge106`, `~ge107` and `~ge108` as needed to verify the staged interface slices;
- confirm the overview opens with the r481 close/buy/sell sprites and group 108 exposes the offer controls/state visuals without creating server transactions;
- stop option 2, then start options 1 and 3 and confirm the GE debug procedures are absent and native cache/interface behaviour is unchanged.

Do not move this plugin under normal `content/`; the isolation boundary is intentional.
