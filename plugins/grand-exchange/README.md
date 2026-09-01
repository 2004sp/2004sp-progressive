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
6. append the staged GE debug procedures (`ge`, `ge106`, `ge107`, `ge108`, `ge110`) to the script name map;
7. temporarily add `sourcePaths` to the installed `@lostcityrs/runescript` wrapper so it compiles from `BUILD_SRC_DIR/scripts` instead of its native `../content/scripts` default;
8. convert and copy the frozen PNGs into the staged native sprite source directory;
9. apply the IF1-only buy/sell action compatibility shims to the twelve frozen group-105 offer hitboxes;
10. generate the option-2-only item-search interface, two temporary server inventories and RuneScript search catalogue directly from the staged native r254 `obj.pack`;
11. build and start option 2 with `BUILD_SRC_DIR` pointing at the stage;
12. restore the native pack and compiler wrapper after the option-2 server exits.

Launcher options 1 and 3 explicitly force `NODE_FEATURE_GRANDEXCHANGE=false`. The launcher also restores a stale snapshot on its next start if an option-2 run was interrupted before its `finally` cleanup could run.

## Native r254 media path

The r254 packer does not need a new GE-specific cache format. Its media packer reads every PNG under `BUILD_SRC_DIR/sprites`, converts it into the shared sprite `index.dat` plus a `<name>.dat` entry, and writes the normal client `media` JagFile.

The r481 exports are staged with names such as:

- `r481_ge_sprite_831.png`
- `r481_ge_sprite_1168.png`
- `r481_ge_sprite_1170.png`

IF1 components then reference them in the native form, for example `graphic=r481_ge_sprite_1168,0`.

One compatibility conversion is required: r254 PixPack treats RGB magenta (`#ff00ff`) as transparent and does not preserve PNG alpha. The committed r481 source PNGs are left untouched; only their temporary staged copies convert alpha below 128 to magenta and force the staged image alpha opaque before the native media packer sees them.

## Overview and offer setup

`content/scripts/grand_exchange/interfaces/grand_exchange_overview.if` uses staged r481 media for:

- the group-105 close control (`831`);
- the six buy action visuals (`1170`);
- the six sell action visuals (`1168`).

The frozen r481 buy hitboxes are source components `30`, `46`, `62`, `81`, `100` and `119`. The sell hitboxes are source components `31`, `47`, `63`, `82`, `101` and `120`. r481 drove both sets with IF3 listeners/CS2; the option-2 compatibility stage adds only the equivalent IF1 `Buy`/`Sell` button metadata to those same components without changing their source geometry.

The server-side `[if_button]` handlers keep the setup state authoritative. **Buy** switches the overview root (`com_16`) to the group-105 setup root (`com_126`), keeps the frozen `Buy Offer` title, and shows the buy-search prompt (`com_192`). **Sell** switches to the same source setup root, changes the shared title (`com_133`) to `Sell Offer`, hides the buy-search prompt, and shows the frozen sell-inventory prompt (`com_197`). The source Back control (`com_127`) returns to the six-slot summary without resetting the individual slot sub-states. Opening Buy explicitly restores the `Buy Offer` title so alternating Sell → Back → Buy cannot leave stale sell text behind.

Buy-item search/result selection is now wired; sell inventory selection, quantity controls, price controls and offer submission remain deliberately unwired, so no server-side GE transaction or player-wealth mutation is introduced by this slice.

## Native r254 item search and selection

`engine/grand-exchange-item-search-stage.ts` adds the buy-search interaction without importing any r481 item definition, item icon or item model:

- source group-105 `com_194` becomes the IF1 **Search** action for the existing buy-search icon;
- the search prompt uses the native `p_namedialog`/`last_string` path;
- at option-2 staging time, the search catalogue is generated from the staged native r254 `pack/obj.pack`, preserving native object IDs/symbols and ID order;
- runtime matching uses native `oc_name`, filters through native `oc_tradeable`, and rejects certificate/noted variants with native `oc_uncert`;
- results are written into option-2-only temporary inventory `ge_search_results` (local inv `164`) and transmitted to a one-column IF1 inventory inside a scrollable layer, so the client draws the ordinary native r254 item icons;
- up to 80 matches are shown per query with their native `oc_name` text alongside the icons; broad queries explicitly report that the first 80 matches are shown;
- selecting a result revalidates tradeability/noted state server-side, stores the native object in `ge_selected_item` (local inv `165`), returns to the group-105 Buy Offer setup, and renders the selected item through native `if_setobject` plus native `oc_name`/`oc_desc`;
- opening a fresh Buy setup clears both temporary search/selection containers, so no stale selected item survives into a new setup flow.

The generated search interface uses synthetic root `8989` and component IDs `11304–11392`, immediately after the frozen r481 interface reservation ending at `11303`. These IDs exist only in the temporary option-2 stage. Launcher options 1 and 3 do not receive the interface, inventories, generated search scripts, or search mappings.

This intentionally keeps the item boundary stronger than a copied lookup table: every searchable ID/name and every displayed item icon/model originates from the same staged native r254 catalogue used by the rest of the server/client. r481 assets remain chrome/reference material only.

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
- log in and run `~ge`, then click **Buy** in any of the six empty offer slots;
- click the buy-search icon, enter a native r254 item substring such as `lobster` or `rune`, and confirm native item names/icons populate the result list;
- mouse-wheel/drag the native IF1 result scrollbar and confirm the item names/icons remain aligned while scrolling;
- select a result icon and confirm the Buy Offer setup reopens with the selected native r254 item model, name and description, with the quantity/price layer now visible for the next milestone;
- use **Back**, start a new Buy setup and confirm the search/selection state is reset; search a non-tradeable/noted-only object name and confirm it cannot enter the selection state;
- click **Sell** in any empty offer slot and confirm the shared setup changes to **Sell Offer** with `Select an item in your inventory to sell.`, then use **Back** and verify a subsequent **Buy** restores the Buy Offer title/search prompt;
- confirm quantity, price and Confirm Offer controls still do not create a transaction;
- run `~ge106`, `~ge107`, `~ge108` and `~ge110` as needed to verify the other staged interface slices;
- stop option 2, then start options 1 and 3 and confirm the GE debug procedures/actions are absent and native cache/interface behaviour is unchanged.

Do not move this plugin under normal `content/`; the isolation boundary is intentional.
