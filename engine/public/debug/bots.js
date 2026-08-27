/* Bot Debugger dashboard — vanilla JS, no build step, no framework. */
(function () {
    'use strict';

    const state = {
        bots: new Map(),       // name -> BotSummary
        selected: null,        // bot name
        detail: null,          // last BotDetail for selected bot
        activeTab: 'overview',
        streamPaused: false,
        streamLines: [],       // {el, category, text}
        streamMax: 1000,
        filters: { search: '', task: '', planner: '', status: '', sort: 'name' },
        ws: null,
        wsRetryMs: 1000
    };

    const el = id => document.getElementById(id);

    // ── formatting helpers ──────────────────────────────────────────────────
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    }
    function timeAgo(ms) {
        if (!ms) return '-';
        const d = Date.now() - ms;
        if (d < 1000) return 'just now';
        if (d < 60000) return Math.floor(d / 1000) + 's ago';
        if (d < 3600000) return Math.floor(d / 60000) + 'm ago';
        return Math.floor(d / 3600000) + 'h ago';
    }
    function fmtTicks(t) { return t == null ? '-' : t + 't'; }

    // ── WebSocket live feed ─────────────────────────────────────────────────
    function connectWS() {
        const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${proto}//${location.host}/debug/api/live`);
        state.ws = ws;

        ws.onopen = () => {
            el('wsStatus').textContent = 'WS: live';
            el('wsStatus').className = 'ws-status ws-up';
            state.wsRetryMs = 1000;
        };
        ws.onclose = () => {
            el('wsStatus').textContent = 'WS: down (retrying)';
            el('wsStatus').className = 'ws-status ws-down';
            setTimeout(connectWS, state.wsRetryMs);
            state.wsRetryMs = Math.min(15000, state.wsRetryMs * 1.5);
        };
        ws.onerror = () => { try { ws.close(); } catch (_) {} };
        ws.onmessage = ev => {
            let msg;
            try { msg = JSON.parse(ev.data); } catch (_) { return; }
            if (msg.type !== 'snapshot') return;
            applySnapshot(msg.bots || [], msg.metrics || null);
            if (msg.events && msg.events.length) appendStreamEvents(msg.events);
        };
    }

    // fallback poller in case WS never connects (e.g. blocked upgrade)
    let pollFallbackActive = false;
    function startPollFallback() {
        if (pollFallbackActive) return;
        pollFallbackActive = true;
        setInterval(async () => {
            if (state.ws && state.ws.readyState === WebSocket.OPEN) return; // WS is doing the job
            try {
                const [bots, metrics] = await Promise.all([
                    fetch('/debug/api/bots').then(r => r.json()),
                    fetch('/debug/api/metrics').then(r => r.json())
                ]);
                applySnapshot(bots, metrics);
            } catch (_) { /* server not reachable yet */ }
        }, 1000);
    }

    // ── snapshot application ────────────────────────────────────────────────
    function applySnapshot(bots, metrics) {
        state.bots.clear();
        for (const b of bots) state.bots.set(b.name, b);
        renderStatline(metrics, bots);
        populateFilterOptions(bots);
        renderBotTable();
    }

    function renderStatline(metrics, bots) {
        const online = bots.filter(b => b.online).length;
        const stuck = bots.filter(b => b.stuck).length;
        const errs = bots.filter(b => b.errorCount > 0).length;
        let line = `${online} online   ${stuck} stuck   ${errs} errors`;
        if (metrics) {
            line += `   avg tick ${metrics.avgTickDurationMs}ms   max ${metrics.maxTickDurationMs}ms   ${metrics.eventsPerSecond} evt/s   ${metrics.dashboardClients} client(s)`;
        }
        el('statline').textContent = line;
    }

    function populateFilterOptions(bots) {
        fillSelectOnce('fTask', uniqueSorted(bots.map(b => b.task).filter(Boolean)));
        fillSelectOnce('fPlanner', uniqueSorted(bots.map(b => b.planner).filter(Boolean)));
    }
    const filledSelects = {};
    function fillSelectOnce(id, values) {
        const key = id + ':' + values.join(',');
        if (filledSelects[id] === key) return;
        filledSelects[id] = key;
        const sel = el(id);
        const current = sel.value;
        const first = sel.options[0];
        sel.innerHTML = '';
        sel.appendChild(first);
        for (const v of values) {
            const o = document.createElement('option');
            o.value = v; o.textContent = v;
            sel.appendChild(o);
        }
        sel.value = current;
    }
    function uniqueSorted(arr) { return [...new Set(arr)].sort(); }

    // ── bot list rendering ──────────────────────────────────────────────────
    function passesFilter(b) {
        const f = state.filters;
        if (f.search && !b.name.toLowerCase().includes(f.search.toLowerCase())) return false;
        if (f.task && b.task !== f.task) return false;
        if (f.planner && b.planner !== f.planner) return false;
        if (f.status === 'stuck' && !b.stuck) return false;
        if (f.status === 'idle' && b.task && b.task !== 'idle') return false;
        if (f.status === 'warning' && b.warningCount === 0) return false;
        if (f.status === 'error' && b.errorCount === 0) return false;
        if (f.status === 'script' && !b.scriptActive) return false;
        if (f.status === 'failing' && b.actionStatus !== 'failed' && b.actionStatus !== 'timeout') return false;
        return true;
    }

    function sortBots(list) {
        const s = state.filters.sort;
        const arr = list.slice();
        if (s === 'name') arr.sort((a, b) => a.name.localeCompare(b.name));
        else if (s === 'task') arr.sort((a, b) => (a.task || '').localeCompare(b.task || ''));
        else if (s === 'ticksInTask') arr.sort((a, b) => b.ticksInTask - a.ticksInTask);
        else if (s === 'stuck') arr.sort((a, b) => (b.stuck ? 1 : 0) - (a.stuck ? 1 : 0));
        else if (s === 'warnings') arr.sort((a, b) => b.warningCount - a.warningCount);
        return arr;
    }

    function renderBotTable() {
        const body = el('botTableBody');
        const list = sortBots([...state.bots.values()].filter(passesFilter));
        const frag = document.createDocumentFragment();

        for (const b of list) {
            const tr = document.createElement('tr');
            tr.dataset.name = b.name;
            if (b.name === state.selected) tr.className = 'selected';

            const flags = [];
            if (b.stuck) flags.push('<span class="badge badge-err">STUCK</span>');
            if (b.errorCount > 0) flags.push('<span class="badge badge-err">ERR</span>');
            if (b.warningCount > 0) flags.push('<span class="badge badge-warn">WARN</span>');
            if (b.scriptActive) flags.push('<span class="badge badge-ok">SCRIPT</span>');
            if (!b.online) flags.push('<span class="badge badge-idle">OFFLINE</span>');
            if (flags.length === 0) flags.push('<span class="badge badge-ok">OK</span>');

            tr.innerHTML = `
                <td><span class="botname ${b.online ? '' : 'offline'}">${esc(b.name)}</span><br><span class="dim">${esc(b.planner)}</span></td>
                <td>${esc(b.task || 'idle')}${b.action ? `<br><span class="dim">${esc(b.action)}</span>` : ''}</td>
                <td>${esc(b.taskState || '-')}<br><span class="dim">${fmtTicks(b.ticksInState)}</span></td>
                <td>${b.x},${b.z},${b.level}</td>
                <td>${b.hp}/${b.maxHp}</td>
                <td>${flags.join(' ')}</td>
            `;
            tr.addEventListener('click', () => selectBot(b.name));
            frag.appendChild(tr);
        }
        body.innerHTML = '';
        body.appendChild(frag);
    }

    // ── bot inspector ────────────────────────────────────────────────────────
    function selectBot(name) {
        state.selected = name;
        el('inspectorEmpty').classList.add('hidden');
        el('inspector').classList.remove('hidden');
        el('inspName').textContent = name;
        renderBotTable();
        refreshDetail();
    }

    async function refreshDetail() {
        if (!state.selected) return;
        try {
            const res = await fetch(`/debug/api/bots/${encodeURIComponent(state.selected)}`);
            if (!res.ok) return;
            const detail = await res.json();
            state.detail = detail;
            renderInspector(detail);
        } catch (_) { /* transient — next poll retries */ }
    }
    setInterval(refreshDetail, 1000);

    function renderInspector(d) {
        const flags = [];
        if (d.stuck) flags.push('<span class="badge badge-err">STUCK</span>');
        if (d.errorCount > 0) flags.push('<span class="badge badge-err">ERR</span>');
        if (d.warningCount > 0) flags.push('<span class="badge badge-warn">WARN</span>');
        el('inspFlags').innerHTML = flags.join(' ');

        renderOverview(d);
        renderTask(d);
        renderPlanner(d);
        renderSkills(d);
        renderInventory(d);
        renderMovement(d);
        renderActions(d);
        if (state.activeTab === 'events') renderEvents(d);
    }

    function kv(pairs) {
        return '<div class="kv">' + pairs.map(([k, v]) => `<div class="k">${esc(k)}</div><div>${v}</div>`).join('') + '</div>';
    }

    function renderOverview(d) {
        el('pane-overview').innerHTML = kv([
            ['Online', d.online ? '<span class="ok">yes</span>' : '<span class="err">no</span>'],
            ['Planner', esc(d.planner)],
            ['Slot', d.slot],
            ['Position', `${d.x}, ${d.z}, ${d.level}`],
            ['Ticks alive', d.ticksAlive],
            ['Task', esc(d.task || 'idle') + (d.taskState ? ` / ${esc(d.taskState)}` : '')],
            ['Ticks in task', fmtTicks(d.ticksInTask)],
            ['Ticks in state', fmtTicks(d.ticksInState)],
            ['Action', esc(d.action || '-') + (d.actionStatus ? ` (${d.actionStatus})` : '')],
            ['Action target', esc(d.actionTarget || '-')],
            ['HP', `${d.hp} / ${d.maxHp}`],
            ['Combat level', d.combatLevel],
            ['Inventory', `${d.invUsed} used / ${d.invFree} free`],
            ['Moving', d.moving ? 'yes' : 'no'],
            ['Delayed', d.delayed ? 'yes' : 'no'],
            ['Script active', d.scriptActive ? 'yes' : 'no'],
            ['Interaction pending', d.interactionPending ? 'yes' : 'no'],
            ['Last event', esc(d.lastEvent || '-')],
            ['Last error', d.lastError ? `<span class="err">${esc(d.lastError)}</span>` : '-']
        ]);
    }

    function renderTask(d) {
        let html = kv([
            ['Task', esc(d.task || 'idle')],
            ['State', esc(d.taskState || '-')],
            ['Ticks in task', fmtTicks(d.ticksInTask)],
            ['Ticks in state', fmtTicks(d.ticksInState)]
        ]);

        if (d.taskDebug) {
            html += '<div class="section-title">Task debug info</div>';
            html += kv([
                ['target', esc(d.taskDebug.target || '-')],
                ['destination', d.taskDebug.destination ? `${d.taskDebug.destination.x},${d.taskDebug.destination.z},${d.taskDebug.destination.level}` : '-']
            ]);
            if (d.taskDebug.details) {
                html += '<table class="datatable"><thead><tr><th>key</th><th>value</th></tr></thead><tbody>';
                for (const [k, v] of Object.entries(d.taskDebug.details)) {
                    html += `<tr><td>${esc(k)}</td><td>${esc(JSON.stringify(v))}</td></tr>`;
                }
                html += '</tbody></table>';
            }
        }

        html += '<div class="section-title">Stuck detection</div>';
        html += kv([
            ['Stuck', d.stuckInfo.isStuck ? '<span class="err">yes</span>' : 'no'],
            ['Oscillating', d.stuckInfo.isOscillating ? '<span class="warn">yes</span>' : 'no'],
            ['Ticks without progress', d.stuckInfo.ticksWithoutProgress],
            ['Desperately stuck', d.stuckInfo.desperatelyStuck ? '<span class="err">yes</span>' : 'no'],
            ['Detour attempts', d.stuckInfo.detourAttempts],
            ['Teleport recoveries', d.stuckInfo.teleportRecoveries],
            ['Last recovery', d.stuckInfo.lastRecoveryType ? `${d.stuckInfo.lastRecoveryType} @ t${d.stuckInfo.lastRecoveryTick}` : '-']
        ]);

        html += '<div class="section-title">Active script</div>';
        html += kv([
            ['Active', d.script.active ? 'yes' : 'no'],
            ['Execution', d.script.executionName || '-'],
            ['Script file', esc(d.script.scriptFile || '-')],
            ['Delayed', d.script.delayed ? 'yes' : 'no']
        ]);

        html += '<div class="section-title">Recent destinations</div>';
        html += '<table class="datatable"><thead><tr><th>x</th><th>z</th><th>level</th><th>when</th></tr></thead><tbody>';
        for (const dest of (d.recentDestinations || []).slice().reverse()) {
            html += `<tr><td>${dest.x}</td><td>${dest.z}</td><td>${dest.level}</td><td>${timeAgo(dest.time)}</td></tr>`;
        }
        html += '</tbody></table>';

        html += '<div class="section-title">Recent targets</div>';
        html += '<table class="datatable"><thead><tr><th>name</th><th>when</th></tr></thead><tbody>';
        for (const tg of (d.recentTargets || []).slice().reverse()) {
            html += `<tr><td>${esc(tg.name)}</td><td>${timeAgo(tg.time)}</td></tr>`;
        }
        html += '</tbody></table>';

        el('pane-task').innerHTML = html;
    }

    function renderPlanner(d) {
        const pd = d.plannerDetail;
        let html = kv([
            ['Personality', esc(pd.personality)],
            ['Rescan countdown', pd.rescanCountdown],
            ['Consecutive fail count', pd.planFailCount]
        ]);

        const decision = pd.lastDecision;
        html += '<div class="section-title">Last decision</div>';
        if (!decision) {
            html += '<div class="dim">No planner decision recorded yet.</div>';
        } else {
            html += `<div class="kv"><div class="k">Chosen</div><div>${esc(decision.chosen || 'none')}</div><div class="k">Reason</div><div>${esc(decision.reason)}</div></div>`;
            html += '<table class="datatable"><thead><tr><th>candidate</th><th>should run</th><th>reason</th></tr></thead><tbody>';
            for (const c of decision.candidates || []) {
                html += `<tr><td>${esc(c.name)}</td><td>${c.shouldRun ? '<span class="ok">yes</span>' : '<span class="dim">no</span>'}</td><td>${esc(c.reason || '-')}</td></tr>`;
            }
            html += '</tbody></table>';
        }

        html += '<div class="section-title">Recent decisions</div>';
        html += '<table class="datatable"><thead><tr><th>when</th><th>chosen</th><th>reason</th></tr></thead><tbody>';
        for (const dec of (pd.recentDecisions || []).slice().reverse()) {
            html += `<tr><td>${timeAgo(dec.time)}</td><td>${esc(dec.chosen || 'none')}</td><td>${esc(dec.reason)}</td></tr>`;
        }
        html += '</tbody></table>';

        el('pane-planner').innerHTML = html;
    }

    function renderSkills(d) {
        let html = '<table class="datatable"><thead><tr><th>skill</th><th>lvl</th><th>xp</th><th>to next</th><th>session</th><th>task</th><th>xp/hr</th></tr></thead><tbody>';
        for (const s of d.skills || []) {
            html += `<tr class="${s.recentlyGained ? 'gain-recent' : ''}">
                <td>${esc(s.name)}</td>
                <td>${s.level}${s.level !== s.baseLevel ? `/${s.baseLevel}` : ''}</td>
                <td>${s.xp}</td>
                <td>${s.xpToNextLevel == null ? '-' : s.xpToNextLevel}</td>
                <td>${s.xpGainedSession}</td>
                <td>${s.xpGainedTask}</td>
                <td>${s.xpPerHour == null ? '-' : s.xpPerHour}</td>
            </tr>`;
        }
        html += '</tbody></table>';
        el('pane-skills').innerHTML = html;
    }

    function renderInventory(d) {
        let html = kv([
            ['Used', d.inventory.usedSlots],
            ['Free', d.inventory.freeSlots],
            ['Coins', d.inventory.coins]
        ]);
        html += '<table class="datatable"><thead><tr><th>slot</th><th>item</th><th>qty</th></tr></thead><tbody>';
        for (const s of d.inventory.slots || []) {
            html += `<tr><td>${s.slot}</td><td>${esc(s.name)}</td><td>${s.count}</td></tr>`;
        }
        html += '</tbody></table>';
        el('pane-inventory').innerHTML = html;
    }

    function renderMovement(d) {
        const m = d.movement;
        el('pane-movement').innerHTML = kv([
            ['Position', `${m.x}, ${m.z}, ${m.level}`],
            ['Destination', m.destination ? `${m.destination.x}, ${m.destination.z}` : '-'],
            ['Distance to destination', m.distanceToDestination == null ? '-' : m.distanceToDestination],
            ['Moving', m.moving ? 'yes' : 'no'],
            ['Delayed', m.delayed ? 'yes' : 'no']
        ]);
    }

    function renderActions(d) {
        let html = '<div class="section-title">Action statistics</div>';
        html += '<table class="datatable"><thead><tr><th>type</th><th>attempts</th><th>success</th><th>failed</th><th>timeout</th><th>success %</th></tr></thead><tbody>';
        for (const [type, s] of Object.entries(d.actionStats || {})) {
            const pct = s.attempts ? Math.round((s.success / s.attempts) * 1000) / 10 : 0;
            html += `<tr><td>${esc(type)}</td><td>${s.attempts}</td><td class="ok">${s.success}</td><td class="err">${s.failed}</td><td class="warn">${s.timeout}</td><td>${pct}%</td></tr>`;
        }
        html += '</tbody></table>';

        html += '<div class="section-title">Recent actions</div>';
        html += '<table class="datatable"><thead><tr><th>type</th><th>description</th><th>status</th><th>tick</th></tr></thead><tbody>';
        for (const a of (d.recentActions || []).slice().reverse().slice(0, 60)) {
            const cls = a.status === 'success' ? 'ok' : (a.status === 'failed' || a.status === 'timeout' ? 'err' : (a.status === 'running' ? 'warn' : 'dim'));
            html += `<tr><td>${esc(a.type)}</td><td>${esc(a.description)}</td><td class="${cls}">${a.status}</td><td>${a.startedTick}</td></tr>`;
        }
        html += '</tbody></table>';
        el('pane-actions').innerHTML = html;
    }

    async function renderEvents(d) {
        try {
            const res = await fetch(`/debug/api/bots/${encodeURIComponent(d.name)}/events`);
            const events = await res.json();
            let html = '<table class="datatable"><thead><tr><th>tick</th><th>category</th><th>message</th></tr></thead><tbody>';
            for (const e of events.slice().reverse()) {
                html += `<tr><td>${e.tick}</td><td class="dim">${esc(e.category)}</td><td>${esc(e.message)}</td></tr>`;
            }
            html += '</tbody></table>';
            el('pane-events').innerHTML = html;
        } catch (_) {
            el('pane-events').innerHTML = '<div class="dim">Failed to load events.</div>';
        }
    }

    // ── tabs ─────────────────────────────────────────────────────────────────
    document.addEventListener('click', ev => {
        const tab = ev.target.closest('.tab');
        if (!tab) return;
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.pane').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        const name = tab.dataset.tab;
        el('pane-' + name).classList.add('active');
        state.activeTab = name;
        if (name === 'events' && state.detail) renderEvents(state.detail);
    });

    // ── filters ──────────────────────────────────────────────────────────────
    el('fSearch').addEventListener('input', e => { state.filters.search = e.target.value; renderBotTable(); });
    el('fTask').addEventListener('change', e => { state.filters.task = e.target.value; renderBotTable(); });
    el('fPlanner').addEventListener('change', e => { state.filters.planner = e.target.value; renderBotTable(); });
    el('fStatus').addEventListener('change', e => { state.filters.status = e.target.value; renderBotTable(); });
    el('fSort').addEventListener('change', e => { state.filters.sort = e.target.value; renderBotTable(); });

    // ── global event stream ─────────────────────────────────────────────────
    function appendStreamEvents(events) {
        if (state.streamPaused) return;
        const body = el('streamBody');
        const filterText = el('streamFilter').value.toLowerCase();
        const filterCat = el('streamCategory').value;
        const atBottom = body.scrollTop + body.clientHeight >= body.scrollHeight - 20;

        for (const e of events) {
            if (filterCat && e.category !== filterCat) continue;
            if (filterText && !(`${e.bot} ${e.message}`.toLowerCase().includes(filterText))) continue;
            const line = document.createElement('div');
            line.className = `stream-line cat-${e.category}`;
            line.innerHTML = `<span class="t">[t${e.tick}]</span> <span class="b">[${esc(e.bot)}]</span> ${esc(e.message)}`;
            body.appendChild(line);
            state.streamLines.push(line);
        }
        while (state.streamLines.length > state.streamMax) {
            const l = state.streamLines.shift();
            if (l.parentNode) l.parentNode.removeChild(l);
        }
        if (atBottom) body.scrollTop = body.scrollHeight;
    }

    el('streamPause').addEventListener('click', () => {
        state.streamPaused = !state.streamPaused;
        el('streamPause').textContent = state.streamPaused ? 'Resume' : 'Pause';
        el('streamPause').classList.toggle('active', state.streamPaused);
    });
    el('streamClear').addEventListener('click', () => {
        el('streamBody').innerHTML = '';
        state.streamLines = [];
    });

    // ── boot ─────────────────────────────────────────────────────────────────
    connectWS();
    startPollFallback();
})();
