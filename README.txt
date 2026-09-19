2004Scape Compact Manager
=========================

Run run.bat.

Storage design
--------------
The five LostCity revisions (225, 244, 245.2, 254 and 274) are not stored as
five complete installations. Their identical files are stored once in compact
store pack files (store\data-*.bin; legacy bundles may use store\data.bin),
and revision manifests describe which files each build uses. Only
runtime\active is reconstructed when you choose a game.

The legacy Java client is intentionally excluded from this compact bundle.
The TypeScript/web client is included for every revision.

Player data
-----------
Each game/revision has separate persistent userdata under userdata\.
The manager preserves .env, SQLite database files, player saves and world config
when switching or repairing.