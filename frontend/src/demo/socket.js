// Socket finto per la demo: si dichiara subito connesso e non riceve eventi (non c'è un server che li invii).
export function createDemoSocket() {
  const handlers = new Map();
  const socket = {
    connected: false,
    on(event, fn) {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event).add(fn);
      return socket;
    },
    off(event, fn) {
      handlers.get(event)?.delete(fn);
      return socket;
    },
    emit() {
      return socket;
    },
    close() {
      socket.connected = false;
      handlers.clear();
    },
  };
  setTimeout(() => {
    socket.connected = true;
    handlers.get('connect')?.forEach((fn) => fn());
  }, 0);
  return socket;
}
