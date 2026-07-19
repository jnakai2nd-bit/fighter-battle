// Minimal WebSocket relay for Cursor Battle
const http = require('http');
const WebSocket = require('ws');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

const lobbies = new Map(); // code -> { host: ws, guest: ws }

function send(ws, obj){ if(ws && ws.readyState===WebSocket.OPEN) ws.send(JSON.stringify(obj)); }

wss.on('connection', ws => {
  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch(e){ return; }
    if (msg.type === 'host') {
      const code = msg.code || (Math.floor(1000 + Math.random()*9000).toString());
      lobbies.set(code, { host: ws, guest: null });
      ws.lobby = code;
      ws.role = 'host';
      send(ws, { type: 'host-ok', code });
    } else if (msg.type === 'join') {
      const code = msg.code;
      const lobby = lobbies.get(code);
      if (!lobby || lobby.guest) {
        send(ws, { type: 'join-fail' });
        return;
      }
      lobby.guest = ws;
      ws.lobby = code;
      ws.role = 'guest';
      // notify both clients
      send(lobby.host, { type: 'ready', playerId: 1 });
      send(lobby.guest, { type: 'ready', playerId: 2 });
    } else if (msg.type === 'state') {
      const code = ws.lobby;
      const lobby = lobbies.get(code);
      if (!lobby) return;
      const other = (ws === lobby.host) ? lobby.guest : lobby.host;
      if (other) send(other, { type: 'state', payload: msg.payload });
    } else if (msg.type === 'hit') {
      const code = ws.lobby;
      const lobby = lobbies.get(code);
      if (!lobby) return;
      const other = (ws === lobby.host) ? lobby.guest : lobby.host;
      if (other) send(other, { type: 'hit' });
    } else if (msg.type === 'leave') {
      const code = ws.lobby;
      const lobby = lobbies.get(code);
      if (lobby) {
        const other = (ws === lobby.host) ? lobby.guest : lobby.host;
        if (other) send(other, { type: 'leave' });
        lobbies.delete(code);
      }
    }
  });

  ws.on('close', () => {
    const code = ws.lobby;
    if (!code) return;
    const lobby = lobbies.get(code);
    if (!lobby) return;
    const other = (ws === lobby.host) ? lobby.guest : lobby.host;
    if (other) send(other, { type: 'leave' });
    lobbies.delete(code);
  });
});

const port = process.env.PORT || 3000;
server.listen(port, () => console.log('WS relay listening on', port));
