import { ref } from 'vue';

/** A WebSocket to /ws that reconnects by itself. `onOpen` runs on every (re)connect. */
export function useSocket({ onMessage, onOpen }) {
  const connected = ref(false);
  let ws = null, retry = null;

  function connect() {
    clearTimeout(retry);
    ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
    ws.onopen = () => { connected.value = true; onOpen?.(); };
    ws.onmessage = (e) => { try { onMessage(JSON.parse(e.data)); } catch (err) { console.error(err); } };
    ws.onclose = () => { connected.value = false; retry = setTimeout(connect, 1500); };
  }
  const send = (msg) => ws?.readyState === 1 && ws.send(JSON.stringify(msg));

  // Phones pause background tabs; reconnect as soon as we're visible again.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && ws?.readyState !== 1) connect();
  });

  connect();
  return { connected, send };
}

/** Counts down from a server-sent `remainingMs`, re-anchored on every state update. */
export function useCountdown() {
  const ms = ref(0);
  let deadline = 0, timer = null;
  function set(remainingMs) {
    deadline = performance.now() + (remainingMs ?? 0);
    tick();
    clearInterval(timer);
    timer = setInterval(tick, 250);
  }
  function tick() {
    ms.value = Math.max(0, deadline - performance.now());
    if (!ms.value) clearInterval(timer);
  }
  return { ms, set };
}
