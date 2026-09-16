import { MSG } from "../lib/constants.js";

let nextId = 1;
const pending = new Map();

export function listenMain(onEvent) {
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== MSG.MAIN) return;
    if (data.id && pending.has(data.id)) {
      const { resolve, reject, timer } = pending.get(data.id);
      clearTimeout(timer);
      pending.delete(data.id);
      if (data.error) reject(new Error(data.error));
      else resolve(data.payload);
      return;
    }
    if (data.type) onEvent?.(data.type, data.payload);
  });
}

export function mainRpc(type, payload, timeoutMs = 25000) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Diet-Youtube timed out on ${type}`));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    window.postMessage({ source: MSG.ISOLATED, id, type, payload }, "*");
  });
}
