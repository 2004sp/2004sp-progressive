# Grand Exchange plugin staging

This directory is the Phase 2 staging area for the r481 Grand Exchange backport in PR #21.

It deliberately lives outside the normal `content/` tree. Native launcher paths must not compile or load these files. The option-2 custom-content path will later stage this tree into an isolated build only when `NODE_FEATURE_GRANDEXCHANGE=true`.

## Frozen source

- OpenRS2 cache: `runescape/568`
- Cache family: build 481
- Provided timestamp: 2007-12-12
- Frozen archive SHA-256: `868027c9ccf770b8bbb60c89aeeb9603796b40dcd501f32610176ffbf5bf1495`
- Interface group used by the first vertical slice: `105` (main Grand Exchange overview)

The source-to-local component rule from Phase 1 remains unchanged:

`local_component_id = 9000 + source_component_id`

Because a regular r254 IF1 interface needs an opening/root component while the r481 group has several top-level IF3 components, Phase 2 reserves local ID `8990` as a synthetic IF1 root for source group 105. This keeps source component 0 at local 9000 instead of shifting the frozen block.

## First Phase 2 slice

`assets/sprites/` contains only the r481 sprites directly needed to reconstruct the overview frame and empty offer slots. Their hashes and original dimensions are frozen in `overview-assets.json`.

`content/scripts/grand_exchange/interfaces/grand_exchange_overview.if` is a safe IF1 geometry scaffold. It intentionally uses native r254 rectangles/text only for now, so the r481 sprite-media packing problem can be solved without making the interface source depend on an invented media archive format.

The scaffold mirrors:

- 512x334 overview canvas
- the r481 title and description positions
- six 140x110 offer slots at the r481 coordinates
- buy/sell hit-area placement
- a working r254 close control

It is not wired into the normal build and it does not implement live offers.

## Next compatibility step

The next Phase 2 change should add an option-2-only overlay/staging build that:

1. copies the normal r254 source tree to a temporary custom-content source;
2. injects this plugin's interface source and reserved interface mappings only when the GE toggle is enabled;
3. packs the staged r481 PNGs into custom media names such as `r481_ge_sprite_831`;
4. starts option 2 against the custom build;
5. guarantees options 1 and 3 restore/use the untouched native pack.

Do not move this directory under normal `content/` until that isolation exists.
