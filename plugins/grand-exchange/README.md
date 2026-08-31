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
2. snapshot the native `media`, `interface`, server pack, compiler symbols and `neptune.toml`;
3. copy normal `content/` into `engine/.custom-content-stage/grand-exchange/content`;
4. overlay this plugin's `.if` and `.rs2` sources into that copy;
5. inject the synthetic root and only the currently implemented group-105 component names at their frozen local IDs;
6. append `[debugproc,ge]` to the staged script name map;
7. point Neptune's temporary `sources` entry at the staged scripts;
8. convert and copy the frozen PNGs into the staged native sprite source directory;
9. build and start option 2 with `BUILD_SRC_DIR` pointing at the stage;
10. restore the native pack/config after the option-2 server exits.

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

## Local verification

After copying this overlay onto the normal r254 base installation:

- enable **Grand Exchange (option 2 only)** under launcher **Custom Content**;
- start launcher option **2 — Custom Server + Hiscores** and allow the normal local build/repack to complete;
- log in and run `~ge`;
- confirm the overview opens with the r481 close/buy/sell sprites;
- stop option 2, then start options 1 and 3 and confirm `~ge` is absent and native cache/interface behaviour is unchanged.

Do not move this plugin under normal `content/`; the isolation boundary is intentional.
