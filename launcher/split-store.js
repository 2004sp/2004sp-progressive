'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const STORE_DIR = path.join(ROOT, 'store');
const SOURCE_PATH = path.join(STORE_DIR, 'data.bin');
const SOURCE_BACKUP_PATH = path.join(STORE_DIR, 'data.bin.original');
const INDEX_PATH = path.join(STORE_DIR, 'index.json');
const INDEX_BACKUP_PATH = path.join(STORE_DIR, 'index.json.original');
const INDEX_NEW_PATH = path.join(STORE_DIR, 'index.json.new');
const TARGET_BYTES = 45 * 1024 * 1024;
const COPY_BUFFER_BYTES = 8 * 1024 * 1024;

function mib(n) {
  return (n / 1024 / 1024).toFixed(2) + ' MiB';
}

function fail(message) {
  throw new Error(message);
}

function sha256File(filePath) {
  const h = crypto.createHash('sha256');
  const fd = fs.openSync(filePath, 'r');
  const buf = Buffer.allocUnsafe(COPY_BUFFER_BYTES);
  try {
    while (true) {
      const n = fs.readSync(fd, buf, 0, buf.length, null);
      if (!n) break;
      h.update(buf.subarray(0, n));
    }
  } finally {
    fs.closeSync(fd);
  }
  return h.digest('hex');
}

function copyRangeAndHash(sourceFd, sourceOffset, length, destinationPath) {
  const tempPath = destinationPath + '.tmp';
  if (fs.existsSync(tempPath)) fs.rmSync(tempPath, { force: true });

  const outFd = fs.openSync(tempPath, 'w');
  const buf = Buffer.allocUnsafe(COPY_BUFFER_BYTES);
  const h = crypto.createHash('sha256');
  let done = 0;

  try {
    while (done < length) {
      const want = Math.min(buf.length, length - done);
      const got = fs.readSync(sourceFd, buf, 0, want, sourceOffset + done);
      if (!got) fail('Unexpected EOF while copying store data.');

      let written = 0;
      while (written < got) {
        written += fs.writeSync(outFd, buf, written, got - written);
      }
      h.update(buf.subarray(0, got));
      done += got;
    }
  } finally {
    fs.closeSync(outFd);
  }

  if (fs.statSync(tempPath).size !== length) {
    fail('Shard size verification failed for ' + path.basename(destinationPath));
  }

  const sourceHash = h.digest('hex');
  const destinationHash = sha256File(tempPath);
  if (sourceHash !== destinationHash) {
    fail('Shard hash verification failed for ' + path.basename(destinationPath));
  }

  if (fs.existsSync(destinationPath)) fs.rmSync(destinationPath, { force: true });
  fs.renameSync(tempPath, destinationPath);
}

function main() {
  console.log('2004Scape store splitter');
  console.log('========================');
  console.log('Target shard size: ' + mib(TARGET_BYTES));
  console.log('');

  if (!fs.existsSync(INDEX_PATH)) fail('store\\index.json is missing.');

  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  const entries = Object.entries(index);

  if (!entries.length) fail('store\\index.json is empty.');

  const alreadySharded = entries.every(([, obj]) => typeof obj.pack === 'string' && obj.pack.length > 0);
  if (alreadySharded) {
    const packs = [...new Set(entries.map(([, obj]) => obj.pack))].sort();
    const missing = packs.filter(name => !fs.existsSync(path.join(STORE_DIR, name)));
    if (missing.length) fail('Index is already sharded, but these packs are missing: ' + missing.join(', '));
    console.log('Store is already split into ' + packs.length + ' shard(s):');
    for (const name of packs) console.log('  ' + name + '  ' + mib(fs.statSync(path.join(STORE_DIR, name)).size));
    return;
  }

  if (entries.some(([, obj]) => obj.pack !== undefined)) {
    fail('Index contains a mixture of sharded and legacy entries; refusing to modify it.');
  }

  if (!fs.existsSync(SOURCE_PATH)) {
    fail('store\\data.bin is missing and the index is not already sharded.');
  }

  if (fs.existsSync(SOURCE_BACKUP_PATH)) {
    fail('store\\data.bin.original already exists. Move or delete that backup before splitting again.');
  }

  const sourceSize = fs.statSync(SOURCE_PATH).size;
  const sorted = entries.sort((a, b) => a[1].offset - b[1].offset);

  let expectedOffset = 0;
  for (const [sha, obj] of sorted) {
    if (!Number.isSafeInteger(obj.offset) || !Number.isSafeInteger(obj.length) || obj.offset < 0 || obj.length < 0) {
      fail('Invalid offset/length for object ' + sha);
    }
    if (obj.offset !== expectedOffset) {
      fail('Store is not contiguous at object ' + sha + ': expected offset ' + expectedOffset + ', found ' + obj.offset);
    }
    expectedOffset += obj.length;
  }

  if (expectedOffset !== sourceSize) {
    fail('Index covers ' + expectedOffset + ' bytes but data.bin is ' + sourceSize + ' bytes.');
  }

  const shards = [];
  let current = null;

  for (const [sha, obj] of sorted) {
    if (!current || (current.length > 0 && current.length + obj.length > TARGET_BYTES)) {
      current = {
        number: shards.length,
        name: 'data-' + String(shards.length).padStart(3, '0') + '.bin',
        sourceOffset: obj.offset,
        length: 0,
        objects: []
      };
      shards.push(current);
    }

    current.objects.push([sha, obj]);
    current.length += obj.length;
  }

  console.log('Source: ' + mib(sourceSize) + ' across ' + sorted.length + ' unique objects');
  console.log('Planned shards: ' + shards.length);
  for (const shard of shards) {
    console.log('  ' + shard.name + '  ' + mib(shard.length) + '  (' + shard.objects.length + ' objects)');
  }
  console.log('');

  const sourceFd = fs.openSync(SOURCE_PATH, 'r');
  try {
    for (const shard of shards) {
      const destinationPath = path.join(STORE_DIR, shard.name);
      process.stdout.write('Writing ' + shard.name + '... ');
      copyRangeAndHash(sourceFd, shard.sourceOffset, shard.length, destinationPath);
      console.log('verified');
    }
  } finally {
    fs.closeSync(sourceFd);
  }

  const newIndex = {};
  let totalReindexed = 0;

  for (const shard of shards) {
    for (const [sha, obj] of shard.objects) {
      const localOffset = obj.offset - shard.sourceOffset;
      newIndex[sha] = {
        pack: shard.name,
        offset: localOffset,
        length: obj.length
      };
      totalReindexed += obj.length;
    }
  }

  if (Object.keys(newIndex).length !== entries.length || totalReindexed !== sourceSize) {
    fail('Reindexed object/byte totals do not match the original store.');
  }

  fs.writeFileSync(INDEX_NEW_PATH, JSON.stringify(newIndex) + '\n');

  const parsedNewIndex = JSON.parse(fs.readFileSync(INDEX_NEW_PATH, 'utf8'));
  if (Object.keys(parsedNewIndex).length !== entries.length) {
    fail('New index verification failed.');
  }

  fs.copyFileSync(INDEX_PATH, INDEX_BACKUP_PATH);
  fs.renameSync(INDEX_NEW_PATH, INDEX_PATH);
  fs.renameSync(SOURCE_PATH, SOURCE_BACKUP_PATH);

  console.log('');
  console.log('Split complete.');
  console.log('Original kept locally as: store\\data.bin.original');
  console.log('Original index kept locally as: store\\index.json.original');
  console.log('');
  console.log('You can now commit store\\data-*.bin and store\\index.json with normal Git.');
}

try {
  main();
} catch (err) {
  console.error('');
  console.error('ERROR: ' + err.message);
  process.exitCode = 1;
}
