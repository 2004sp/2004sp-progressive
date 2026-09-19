// Runs the WebSocket on a Worker thread.
// Key fix: the server must echo back Sec-WebSocket-Protocol: binary in its 101 response.
// Safari enforces RFC 6455 §4.1 strictly — if the client requests a sub-protocol and the
// server doesn't echo one, Safari keeps readyState=0 forever. Chrome is lenient.
self.onmessage = function (e) {
    if (e.data.type !== 'connect') return;

    var port = e.ports[0];
    var url = e.data.url;
    var protocols = e.data.protocols;

    function dbg(msg) {
        port.postMessage({ type: 'dbg', dbg: msg });
    }

    dbg('worker received connect, url=' + url + ' protocols=' + JSON.stringify(protocols));

    setTimeout(function () {
        dbg('creating WebSocket (with sub-protocol negotiation fix)');
        var ws;
        try {
            ws = protocols ? new WebSocket(url, protocols) : new WebSocket(url);
        } catch (err) {
            dbg('WebSocket constructor threw: ' + err);
            port.postMessage({ type: 'error' });
            return;
        }
        ws.binaryType = 'arraybuffer';
        dbg('WebSocket created, readyState=' + ws.readyState + ' protocol=' + ws.protocol);

        ws.onopen    = function ()   {
            dbg('ws.onopen fired, protocol=' + ws.protocol);
            port.postMessage({ type: 'open' });
        };
        ws.onerror   = function ()   {
            dbg('ws.onerror fired');
            port.postMessage({ type: 'error' });
        };
        ws.onclose   = function (ev) {
            dbg('ws.onclose fired code=' + ev.code + ' reason=' + ev.reason);
            port.postMessage({ type: 'close', code: ev.code, reason: ev.reason });
        };
        ws.onmessage = function (ev) {
            var buf = ev.data;
            port.postMessage({ type: 'message', data: buf }, [buf]);
        };

        port.onmessage = function (e2) {
            var cmd = e2.data;
            if (cmd.type === 'send' && ws.readyState === 1) {
                ws.send(cmd.data);
            } else if (cmd.type === 'close') {
                ws.close();
            }
        };

        var hb = setInterval(function () {
            dbg('heartbeat readyState=' + ws.readyState);
            if (ws.readyState === 1 || ws.readyState === 3) clearInterval(hb);
        }, 2000);
    }, 200);
};
