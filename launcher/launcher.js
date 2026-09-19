'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const crypto = require('crypto');
const os = require('os');
const readline = require('readline/promises');
const { stdin: input, stdout: output } = require('process');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
const STATE_PATH = path.join(__dirname, 'state.json');
const STORE_DIR = path.join(ROOT, 'store');
const PACK_PATH = path.join(STORE_DIR, 'data.bin');
const INDEX_PATH = path.join(STORE_DIR, 'index.json');
const MANIFESTS_DIR = path.join(STORE_DIR, 'manifests');
const RUNTIME_DIR = path.join(ROOT, 'runtime', 'active');
const USERDATA_DIR = path.join(ROOT, 'userdata');
const BACKUPS_DIR = path.join(USERDATA_DIR, 'backups');
const PROGRESSIVE_DIR = path.join(ROOT, MANIFEST.progressive.bundledPath);
const ACTIVE_MARKER = '.manager-active.json';
const REVISION_ORDER = MANIFEST.revisionOrder;
const PERSISTENT = MANIFEST.persistentPaths || [];
const BACKUP_LIMIT = MANIFEST.backupLimit || 5;

for (const d of [path.dirname(RUNTIME_DIR), USERDATA_DIR, BACKUPS_DIR, PROGRESSIVE_DIR]) {
  fs.mkdirSync(d, { recursive: true });
}

let storeIndex = null;
function getStoreIndex() {
  if (!storeIndex) storeIndex = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  return storeIndex;
}
function storePackName(obj) {
  return obj.pack || 'data.bin';
}
function storeAvailable() {
  try {
    const names = new Set(Object.values(getStoreIndex()).map(storePackName));
    return names.size > 0 && [...names].every(name => fs.existsSync(path.join(STORE_DIR, name)));
  } catch {
    return false;
  }
}

function readState() {
  try { return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')); }
  catch { return { lastMode: 'progressive', lastRevision: MANIFEST.progressive.revision }; }
}
function writeState(s) { fs.writeFileSync(STATE_PATH, JSON.stringify(s, null, 2) + '\n'); }
let state = readState();

function color(text, n) { return process.stdout.isTTY ? `\x1b[${n}m${text}\x1b[0m` : text; }
const bold = x => color(x, 1), green = x => color(x, 32), yellow = x => color(x, 33), cyan = x => color(x, 36), red = x => color(x, 31), gray = x => color(x, 90);
function clear() { if (process.stdout.isTTY) process.stdout.write('\x1Bc'); }
function header(sub='') {
  console.log(bold('=============================================='));
  console.log(bold('          2004Scape Compact Manager'));
  console.log(bold('=============================================='));
  if (sub) console.log(sub + '\n');
}

function rm(p) { fs.rmSync(p, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); }
function copyOne(src, dst) {
  if (!fs.existsSync(src)) return false;
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    rm(dst);
    fs.cpSync(src, dst, { recursive: true, force: true, preserveTimestamps: true });
  } else fs.copyFileSync(src, dst);
  return true;
}
function copyTree(src, dst) {
  if (!fs.existsSync(src)) return;
  const root = path.resolve(src);
  fs.cpSync(root, dst, {
    recursive: true, force: true, errorOnExist: false, preserveTimestamps: true,
    filter: p => {
      const rel = path.relative(root, p);
      if (!rel) return true;
      const parts = rel.split(path.sep);
      return !parts.includes('.git') && !parts.includes('node_modules');
    }
  });
}

function instanceId(mode, rev) { return `${mode}-${rev}`; }
function userDir(mode, rev) { return path.join(USERDATA_DIR, instanceId(mode, rev)); }
function readActiveMarker() {
  try { return JSON.parse(fs.readFileSync(path.join(RUNTIME_DIR, ACTIVE_MARKER), 'utf8')); }
  catch { return null; }
}

function captureUserData(mode, rev) {
  if (!fs.existsSync(RUNTIME_DIR)) return 0;
  const target = userDir(mode, rev);
  fs.mkdirSync(target, { recursive: true });
  let n=0;
  for (const rel of PERSISTENT) if (copyOne(path.join(RUNTIME_DIR, rel), path.join(target, rel))) n++;
  return n;
}
function restoreUserData(mode, rev) {
  const src = userDir(mode, rev);
  if (!fs.existsSync(src) || !fs.existsSync(RUNTIME_DIR)) return 0;
  let n=0;
  for (const rel of PERSISTENT) if (copyOne(path.join(src, rel), path.join(RUNTIME_DIR, rel))) n++;
  return n;
}
function timestamp() {
  const d=new Date(), p=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
function pruneBackups(id) {
  const d=path.join(BACKUPS_DIR,id); if(!fs.existsSync(d)) return;
  const a=fs.readdirSync(d,{withFileTypes:true}).filter(x=>x.isDirectory()).map(x=>x.name).sort().reverse();
  for(const x of a.slice(BACKUP_LIMIT)) rm(path.join(d,x));
}
function backup(mode, rev, reason='manual') {
  const marker=readActiveMarker();
  if(marker && marker.mode===mode && marker.revision===rev) captureUserData(mode,rev);
  const src=userDir(mode,rev);
  if(!fs.existsSync(src)) { console.log(yellow('No saved userdata yet.')); return null; }
  const id=instanceId(mode,rev), name=`${timestamp()}_${reason.replace(/[^a-z0-9_-]/gi,'-')}`;
  const dst=path.join(BACKUPS_DIR,id,name); fs.mkdirSync(path.dirname(dst),{recursive:true});
  fs.cpSync(src,dst,{recursive:true,force:true,preserveTimestamps:true}); pruneBackups(id);
  console.log(green(`Backup created: userdata\\backups\\${id}\\${name}`)); return dst;
}

function progressiveAvailable() {
  return fs.existsSync(path.join(PROGRESSIVE_DIR,'engine')) && fs.existsSync(path.join(PROGRESSIVE_DIR,'start.bat'));
}
function treeFingerprint(root) {
  if(!fs.existsSync(root)) return 'missing';
  const h=crypto.createHash('sha256');
  function walk(dir) {
    const entries=fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name));
    for(const e of entries) {
      if(e.name==='.git' || e.name==='node_modules') continue;
      const p=path.join(dir,e.name), rel=path.relative(root,p).replaceAll('\\','/');
      if(e.isDirectory()) walk(p); else { const st=fs.statSync(p); h.update(rel+'\0'+st.size+'\0'+Math.trunc(st.mtimeMs)+'\n'); }
    }
  }
  walk(root); return h.digest('hex');
}

function manifestFor(rev) {
  const p=path.join(MANIFESTS_DIR,`${rev}.json`);
  if(!fs.existsSync(p)) throw new Error(`Revision ${rev} manifest is missing.`);
  return JSON.parse(fs.readFileSync(p,'utf8'));
}

function extractRevision(rev) {
  const mf=manifestFor(rev), index=getStoreIndex();
  const fds=new Map();
  function fdFor(obj) {
    const packName=storePackName(obj);
    const packPath=path.join(STORE_DIR,packName);
    if(!fs.existsSync(packPath)) throw new Error(`Store pack is missing: store\\${packName}`);
    if(!fds.has(packName)) fds.set(packName,fs.openSync(packPath,'r'));
    return fds.get(packName);
  }
  try {
    let i=0;
    for(const f of mf.files) {
      const obj=index[f.sha256]; if(!obj) throw new Error(`Missing store object ${f.sha256}`);
      const fd=fdFor(obj);
      const dst=path.join(RUNTIME_DIR,...f.path.split('/'));
      fs.mkdirSync(path.dirname(dst),{recursive:true});
      const buf=Buffer.allocUnsafe(obj.length);
      let done=0;
      while(done<obj.length) {
        const got=fs.readSync(fd,buf,done,obj.length-done,obj.offset+done);
        if(!got) throw new Error(`Unexpected EOF reading ${f.path}`);
        done+=got;
      }
      fs.writeFileSync(dst,buf);
      i++;
      if(process.stdout.isTTY && i%750===0) process.stdout.write(`\rExtracting ${rev}: ${i}/${mf.files.length}`);
    }
    if(process.stdout.isTTY) process.stdout.write(`\rExtracting ${rev}: ${mf.files.length}/${mf.files.length}\n`);
  } finally {
    for(const fd of fds.values()) fs.closeSync(fd);
  }
}

function expectedMarker(mode, rev) {
  return {
    schema: 3,
    mode,
    revision: rev,
    progressiveFingerprint: mode==='progressive' ? treeFingerprint(PROGRESSIVE_DIR) : null
  };
}
function sameMarker(a,b) { return a && a.schema===b.schema && a.mode===b.mode && a.revision===b.revision && a.progressiveFingerprint===b.progressiveFingerprint; }

function buildActive(mode, rev, force=false) {
  if(!REVISION_ORDER.includes(rev)) throw new Error(`Unknown revision ${rev}`);
  if(mode==='progressive' && rev!==MANIFEST.progressive.revision) throw new Error('Progressive currently targets revision 254 only.');
  if(mode==='progressive' && !progressiveAvailable()) throw new Error('Progressive snapshot is not bundled in this package. Use IMPORT_PROGRESSIVE.bat with the actual 2004sp-progressive folder/ZIP, then run PLAY.bat again.');

  const expected=expectedMarker(mode,rev), active=readActiveMarker();
  if(!force && fs.existsSync(RUNTIME_DIR) && sameMarker(active,expected)) { restoreUserData(mode,rev); return false; }

  if(active) {
    console.log(cyan(`Saving ${active.mode} ${active.revision} userdata...`));
    captureUserData(active.mode,active.revision);
  }
  if(fs.existsSync(RUNTIME_DIR)) rm(RUNTIME_DIR);
  fs.mkdirSync(RUNTIME_DIR,{recursive:true});
  console.log(cyan(`Building ${mode} ${rev} from compact store...`));
  extractRevision(rev);
  if(mode==='progressive') {
    console.log(cyan('Applying bundled Progressive files...'));
    copyTree(PROGRESSIVE_DIR,RUNTIME_DIR);
    fs.writeFileSync(path.join(RUNTIME_DIR,'server.json'),JSON.stringify({rev},null,2)+'\n');
  }
  restoreUserData(mode,rev);
  fs.writeFileSync(path.join(RUNTIME_DIR,ACTIVE_MARKER),JSON.stringify({...expected,builtAt:new Date().toISOString()},null,2)+'\n');
  console.log(green('Active server ready.'));
  return true;
}

function launchActive(mode, rev) {
  buildActive(mode,rev,false);
  state.lastMode=mode; state.lastRevision=rev; state.lastRun=new Date().toISOString(); writeState(state);
  if(process.platform!=='win32') { console.log(yellow('Runtime built successfully. Launching start.bat is Windows-only.')); return 0; }
  const bat=path.join(RUNTIME_DIR,'start.bat'); if(!fs.existsSync(bat)) throw new Error('start.bat is missing from active runtime.');
  console.log(green(`\nLaunching ${mode==='progressive'?'2004Scape Progressive':'LostCity'} ${rev}...\n`));
  const r=cp.spawnSync('cmd.exe',['/d','/c','start.bat'],{cwd:RUNTIME_DIR,stdio:'inherit',windowsHide:false});
  captureUserData(mode,rev); return r.status??0;
}

function findProgressiveRoot(extracted) {
  if(fs.existsSync(path.join(extracted,'engine')) && fs.existsSync(path.join(extracted,'start.bat'))) return extracted;
  const dirs=fs.readdirSync(extracted,{withFileTypes:true}).filter(x=>x.isDirectory());
  for(const d of dirs) {
    const p=path.join(extracted,d.name);
    if(fs.existsSync(path.join(p,'engine')) && fs.existsSync(path.join(p,'start.bat'))) return p;
  }
  return null;
}
function importProgressive(source) {
  if(!source) throw new Error('Give me a Progressive folder or ZIP path.');
  source=path.resolve(source.replace(/^"|"$/g,''));
  if(!fs.existsSync(source)) throw new Error(`Not found: ${source}`);
  let root=source, temp=null;
  const st=fs.statSync(source);
  if(st.isFile()) {
    if(path.extname(source).toLowerCase()!=='.zip') throw new Error('Progressive import supports a folder or .zip file.');
    if(process.platform!=='win32') {
      temp=fs.mkdtempSync(path.join(os.tmpdir(),'2004sp-progressive-'));
      const r=cp.spawnSync('unzip',['-q',source,'-d',temp],{stdio:'inherit'}); if(r.status!==0) throw new Error('Could not extract Progressive ZIP.');
    } else {
      temp=fs.mkdtempSync(path.join(os.tmpdir(),'2004sp-progressive-'));
      const ps=`Expand-Archive -LiteralPath '${source.replaceAll("'","''")}' -DestinationPath '${temp.replaceAll("'","''")}' -Force`;
      const r=cp.spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-Command',ps],{stdio:'inherit'}); if(r.status!==0) throw new Error('Could not extract Progressive ZIP.');
    }
    root=findProgressiveRoot(temp);
  } else root=findProgressiveRoot(source);
  if(!root) { if(temp) rm(temp); throw new Error('That source does not look like 2004sp-progressive (engine + start.bat were not found).'); }
  console.log(cyan('Embedding Progressive snapshot...'));
  rm(PROGRESSIVE_DIR); fs.mkdirSync(PROGRESSIVE_DIR,{recursive:true}); copyTree(root,PROGRESSIVE_DIR);
  if(temp) rm(temp);
  console.log(green('Progressive is now bundled locally. No git clone is needed.'));
  const active=readActiveMarker(); if(active?.mode==='progressive') rm(RUNTIME_DIR);
}

function doctor() {
  header('Installation check');
  let problems=0;
  const storeOk=storeAvailable(); console.log(`${storeOk?green('[OK]'):red('[MISSING]')} compact data store`); if(!storeOk) problems++;
  for(const r of REVISION_ORDER) { const ok=fs.existsSync(path.join(MANIFESTS_DIR,`${r}.json`)); console.log(`${ok?green('[OK]'):red('[MISSING]')} revision ${r} manifest`); if(!ok) problems++; }
  console.log(`${progressiveAvailable()?green('[OK]'):yellow('[NOT BUNDLED]')} Progressive 254 snapshot`);
  console.log(`${MANIFEST.javaClientIncluded?green('[included]'):gray('[excluded]')} Legacy Java client`);
  const mb=Math.round((MANIFEST.store?.uniqueBytes||0)/1024/1024);
  console.log(`\nUnique revision data: ~${mb} MiB before ZIP compression.`);
  return problems?1:0;
}

async function chooseRev(rl) {
  console.log(''); REVISION_ORDER.forEach((r,i)=>console.log(`  ${i+1}. ${r.padEnd(7)} ${MANIFEST.revisions[r].date}`)); console.log('  0. Back');
  const a=(await rl.question('\nSelect revision: ')).trim(); if(a==='0') return null;
  const n=Number(a); return Number.isInteger(n)&&n>=1&&n<=REVISION_ORDER.length?REVISION_ORDER[n-1]:undefined;
}
async function vanillaMenu(rl) {
  while(true) { clear(); header('LostCity Vanilla'); const r=await chooseRev(rl); if(r===null)return; if(!r)continue;
    try{ launchActive('vanilla',r); }catch(e){console.log(red('\n'+e.message)); await rl.question('\nPress Enter...');}
  }
}
async function backupMenu(rl) {
  clear(); header('Backups');
  console.log(`  1. Progressive ${MANIFEST.progressive.revision}`); console.log('  2. Vanilla revision'); console.log('  0. Back');
  const a=(await rl.question('\nChoose: ')).trim(); if(a==='1') backup('progressive',MANIFEST.progressive.revision,'manual'); else if(a==='2'){const r=await chooseRev(rl);if(r)backup('vanilla',r,'manual');}
  if(a!=='0') await rl.question('\nPress Enter...');
}
async function mainMenu() {
  const rl=readline.createInterface({input,output});
  try{
    while(true){
      clear(); header('One active runtime · revision data stored once');
      console.log(`  ${green('1.')} Play 2004Scape Progressive ${gray('(254)')} ${progressiveAvailable()?green('[bundled]'):yellow('[snapshot missing]')}`);
      console.log(`  ${cyan('2.')} Play LostCity Vanilla`);
      console.log(`\n  ${yellow('3.')} Repair/rebuild current game`);
      console.log(`  ${yellow('4.')} Backups`);
      console.log(`  ${yellow('5.')} Installation check`);
      console.log(`  ${yellow('6.')} Import/replace bundled Progressive`);
      console.log('\n  0. Exit');
      const a=(await rl.question('\nChoose an option: ')).trim();
      try{
        if(a==='0')return 0;
        if(a==='1')launchActive('progressive',MANIFEST.progressive.revision);
        else if(a==='2')await vanillaMenu(rl);
        else if(a==='3'){
          const m=readActiveMarker(); if(!m) console.log(yellow('No active game has been built yet.')); else { backup(m.mode,m.revision,'pre-repair'); buildActive(m.mode,m.revision,true); console.log(green('Repair complete.')); }
          await rl.question('\nPress Enter...');
        } else if(a==='4') await backupMenu(rl);
        else if(a==='5'){clear();doctor();await rl.question('\nPress Enter...');}
        else if(a==='6'){
          const p=(await rl.question('\nPath to 2004sp-progressive folder or ZIP: ')).trim(); importProgressive(p); await rl.question('\nPress Enter...');
        }
      }catch(e){console.log(red('\n'+e.message));await rl.question('\nPress Enter...');}
    }
  }finally{rl.close();}
}

function usage(){console.log('Commands: --doctor | --build vanilla-REV | --build progressive-254 | --repair | --import-progressive PATH');}
async function cli(){
  const a=process.argv.slice(2); if(!a.length)return mainMenu();
  try{
    if(a[0]==='--doctor')return doctor();
    if(a[0]==='--import-progressive'){importProgressive(a.slice(1).join(' '));return 0;}
    if(a[0]==='--repair'){const m=readActiveMarker();if(!m)throw new Error('No active runtime.');buildActive(m.mode,m.revision,true);return 0;}
    if(a[0]==='--build'){
      const v=a[1]||''; if(v==='progressive-254'){buildActive('progressive','254');return 0;}
      const m=/^vanilla-(.+)$/.exec(v); if(m&&REVISION_ORDER.includes(m[1])){buildActive('vanilla',m[1]);return 0;}
      throw new Error('Unknown build target.');
    }
    usage();return 1;
  }catch(e){console.error(red('ERROR: '+e.message));return 1;}
}
cli().then(c=>process.exitCode=c).catch(e=>{console.error(e);process.exitCode=1;});
