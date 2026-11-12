// Jaringan untuk Epoch Wars. Menyediakan "room" yang dipakai game untuk main berdua:
//  - Mode LAN : kalau halaman dibuka dari server.js (WiFi yang sama), pesan lewat server itu.
//  - Mode P2P : kalau dibuka dari hosting statis (mis. Vercel), dua browser tersambung
//               langsung lewat WebRTC (PeerJS); temanmu bergabung dengan kode 4 huruf.
(() => {
  if (!/^http/.test(location.protocol)) return;

  /* ---------------- Mode LAN (server.js) ---------------- */
  function lanRoom() {
    const id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    const chans = new Map(); // nama -> {on: Map<topic,Set<cb>>, pc: Set<cb>}
    let roster = [], presence = {}, q = [], busy = false, ready = false;
    function flush() {
      if (busy || !ready || !q.length) return;
      busy = true; const ops = q; q = [];
      fetch('/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ops }) })
        .catch(() => {}).then(() => { busy = false; flush(); });
    }
    function op(o) { q.push(o); flush(); return Promise.resolve(); }
    const es = new EventSource('/events?id=' + id);
    es.onmessage = ev => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.type === 'hello') { // (re)koneksi: daftarkan ulang status kita
        q = [{ t: 'presence', data: presence }, ...[...chans.keys()].map(ch => ({ t: 'join', ch })), ...q.filter(o => o.t === 'msg' && o.topic !== 'snap')];
        ready = true; flush();
      } else if (m.type === 'peers') roster = m.peers || [];
      else if (m.type === 'msg') {
        const c = chans.get(m.ch), set = c && c.on.get(m.topic);
        if (set) for (const cb of [...set]) try { cb({ isMe: false, peer: m.peer, data: m.data }); } catch (e) { console.error(e); }
      } else if (m.type === 'left') {
        const c = chans.get(m.ch);
        if (c) for (const cb of [...c.pc]) try { cb({ joined: [], left: [{ peer: m.peer }] }); } catch (e) { console.error(e); }
      }
    };
    es.onerror = () => { ready = false; };
    return {
      lan: true,
      join(name) {
        const c = { on: new Map(), pc: new Set() }; chans.set(name, c); op({ t: 'join', ch: name });
        return Promise.resolve({
          on(topic, cb) { let s = c.on.get(topic); if (!s) c.on.set(topic, s = new Set()); s.add(cb); return () => s.delete(cb); },
          onPeers(cb) { c.pc.add(cb); return () => c.pc.delete(cb); },
          emit(topic, data) { return op({ t: 'msg', ch: name, topic, data }); },
          leave() { if (chans.get(name) === c) chans.delete(name); return op({ t: 'leave', ch: name }); },
          peers() { return [{ peer: id, isMe: true, sameTab: true }]; }
        });
      },
      presence(p) { presence = p || {}; return op({ t: 'presence', data: presence }); },
      peers() { return roster.map(p => ({ peer: p.peer, isMe: p.peer === id, sameTab: p.peer === id, presence: p.presence || {} })); }
    };
  }

  /* ---------------- Mode P2P (WebRTC lewat PeerJS) ---------------- */
  function p2pRoom() {
    let lib = null;
    const loadLib = () => lib || (lib = new Promise((res, rej) => {
      if (window.Peer) return res();
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
      s.onload = () => res(); s.onerror = () => { lib = null; rej({ code: 'offline' }); };
      document.head.appendChild(s);
    }));
    const openPeer = id => new Promise((res, rej) => {
      const p = id ? new Peer(id) : new Peer();
      p.on('open', () => res(p));
      p.on('error', e => { if (e.type === 'unavailable-id') { p.destroy(); res(null); } else rej({ code: e.type || 'error' }); });
    });
    return {
      lan: false,
      presence() { return Promise.resolve(); },
      peers() { return []; },
      async join(name) {
        await loadLib();
        const hostId = 'epochwars-nf-' + name;
        const on = new Map(), pc = new Set(), conns = new Set();
        const wire = c => {
          c.on('data', d => {
            if (!d || typeof d.topic !== 'string') return;
            const set = on.get(d.topic);
            if (set) for (const cb of [...set]) try { cb({ isMe: false, peer: c.peer, data: d.data }); } catch (e) { console.error(e); }
          });
          const gone = () => { if (!conns.delete(c)) return; for (const cb of [...pc]) try { cb({ joined: [], left: [{ peer: c.peer }] }); } catch (e) { console.error(e); } };
          c.on('close', gone); c.on('error', gone);
        };
        // Yang pertama memakai kode ini jadi tuan rumah; berikutnya tersambung ke dia.
        let peer = await openPeer(hostId);
        if (peer) {
          peer.on('connection', c => { wire(c); c.on('open', () => conns.add(c)); });
        } else {
          peer = await openPeer(null);
          const c = peer.connect(hostId, { reliable: true, serialization: 'json' });
          wire(c);
          await new Promise((res, rej) => {
            const t = setTimeout(() => { peer.destroy(); rej({ code: 'timeout' }); }, 12000);
            c.on('open', () => { clearTimeout(t); conns.add(c); res(); });
          });
        }
        peer.on('disconnected', () => { try { if (!peer.destroyed) peer.reconnect(); } catch (e) {} });
        const bye = () => { try { peer.destroy(); } catch (e) {} };
        addEventListener('pagehide', bye);
        return {
          on(topic, cb) { let s = on.get(topic); if (!s) on.set(topic, s = new Set()); s.add(cb); return () => s.delete(cb); },
          onPeers(cb) { pc.add(cb); return () => pc.delete(cb); },
          emit(topic, data) { for (const c of conns) if (c.open) try { c.send({ topic, data }); } catch (e) {} return Promise.resolve(); },
          leave() { removeEventListener('pagehide', bye); conns.clear(); bye(); return Promise.resolve(); },
          peers() { return [{ peer: peer.id, isMe: true, sameTab: true }]; }
        };
      }
    };
  }

  let roomP = null;
  window.claude = {
    use: async n => {
      if (n !== 'room') return null;
      return roomP || (roomP = (async () => {
        try { const r = await fetch('lan', { cache: 'no-store' }); if (r.ok && (await r.json()).epochWarsLan) return lanRoom(); } catch (e) {}
        return p2pRoom();
      })());
    }
  };
})();
