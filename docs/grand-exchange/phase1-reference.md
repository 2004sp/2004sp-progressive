# Grand Exchange Phase 1 reference freeze

Phase 1 is frozen against the user-supplied cache archive rather than an inferred cache.

## Frozen source

- OpenRS2 cache: `runescape/568`
- Provided archive: `cache-runescape-live-en-b481-2007-12-12-00-00-00-openrs2#568.zip`
- ZIP SHA-256: `868027c9ccf770b8bbb60c89aeeb9603796b40dcd501f32610176ffbf5bf1495`
- Cache family: build 481
- Provided timestamp: 2007-12-12
- Cache format: versioned JS5 (`main_file_cache.dat2`, `idx0..idx15`, `idx255`)

### Revision mismatch

PR #21 currently says r479. The supplied archive is OpenRS2 cache #568 and is labelled b481. OpenRS2's cache record combines a 2007-12-12 source with unspecified build and a 2007-12-15 source identified as build 481. Do not relabel this frozen input as r479.

Until the PR wording is intentionally changed, treat `r481` in these Phase 1 manifests as the authoritative source label for the uploaded cache.

## Grand Exchange interface family

The source interface groups frozen for the backport are:

| Source group | Purpose | Components | Local component block |
| ---: | --- | ---: | --- |
| 105 | Main GE overview / offer setup | 214 | 9000–9255 |
| 106 | GE overview / submitted-offer state | 146 | 9256–9511 |
| 107 | GE state helper/overlay | 19 | 9512–9767 |
| 108 | GE offer setup/state variant | 98 | 9768–10023 |
| 109 | Grand Exchange Collection Box | 58 | 10024–10279 |
| 110 | GE offer setup/state variant | 93 | 10280–10535 |
| 643 | GE item/offer history | 51 | 10536–10791 |
| 645 | Grand Exchange Item Sets | 20 | 10792–11047 |
| 646 | GE tutorial/reference step | 14 | 11048–11303 |

Each interface group receives a fixed 256-ID local block. A component maps as:

`local_component_id = block_base + source_component_id`

This preserves component-relative IDs and parent relationships while leaving all existing 2004 interface IDs unchanged.

The exported family directly references 55 sprite groups and fonts 494, 495 and 496. Font resources should be reused from the native 2004 client when compatible; otherwise import them under explicit `r481_ge_font_*` names.

## Grand Exchange NPCs

The supplied cache contains the following GE-specific NPCs:

| Source NPC | Name | Role | Local NPC |
| ---: | --- | --- | ---: |
| 6528 | Grand Exchange clerk | primary clerk candidate | 1200 |
| 6529 | Grand Exchange clerk | clerk visual variant | 1201 |
| 6530 | Grand Exchange clerk | clerk visual variant | 1202 |
| 6531 | Grand Exchange clerk | clerk visual variant | 1203 |
| 6521 | Grand Exchange Tutor | reference-only | 1204 |

All four clerk variants expose `Talk-to`, `Exchange`, `History`, and `Sets`. They use idle sequence 808. The tutor is frozen for reference but is not selected for Phase 3 by default.

The clerk model/head-model dependencies are frozen in `r481-ge-id-map.json` and the extraction bundle. Sequence 808 resolves to frameset 207 and skeleton 0. Tutor sequence 7368 resolves to frameset 1869 and skeleton 0.

## Stable local ranges

The ranges were reserved after checking the current feature branch pack ceilings:

- interface: current max 8461 → imported blocks start at 9000
- NPC: current max 1174 → imported GE NPCs start at 1200
- model: current max 3649 → imported r481 model dependencies start at 4000
- sequence: current max 1190 → imported r481 sequences start at 1200

These reservations are source-to-local mappings only. They do not import or rewrite cache content during Phase 1.

## Export scope

The Phase 1 extraction bundle contains:

- decoded raw IF3 component blobs for all frozen GE interface groups;
- component metadata, hierarchy, text and direct sprite/font/model references;
- PNG exports of every directly referenced sprite/button group plus the raw sprite source blobs;
- GE clerk/tutor NPC configs;
- required body/head model source blobs;
- sequence configs, referenced animation frames and skeletons;
- stable ID mapping and dependency manifests.

The following are intentionally unresolved until Phase 2 because they are referenced indirectly through client scripts/state rather than directly by the IF3 component payloads:

- GE inventory/container config IDs;
- varp/varbit IDs;
- client script IDs/opcodes and any compatibility shims required by the 2004 interface engine.

## Guardrail

No r481 map squares, landscape, collision, minimap/mapscene, GE building/scenery assets, or unrelated NPC content are part of this Phase 1 freeze.
