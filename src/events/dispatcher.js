"use strict";

class EventDispatcher {
  constructor({ maxSeen = 10_000, ttlMs = 10 * 60 * 1000, now = Date.now } = {}) {
    if (!Number.isInteger(maxSeen) || maxSeen < 1) throw new TypeError("maxSeen must be a positive integer");
    this.maxSeen = maxSeen;
    this.ttlMs = ttlMs;
    this.now = now;
    this.seen = new Map();
    this.queues = new Map();
  }

  #eventKey(event) {
    const id = event && (event.messageID || event.messageId || event.eventID || event.eventId);
    return typeof id === "string" && id ? id : null;
  }

  #remember(key) {
    const now = this.now();
    for (const [id, at] of this.seen) if (now - at > this.ttlMs) this.seen.delete(id);
    this.seen.delete(key);
    this.seen.set(key, now);
    while (this.seen.size > this.maxSeen) this.seen.delete(this.seen.keys().next().value);
  }

  dispatch(event, handler) {
    if (!event || typeof event !== "object" || typeof handler !== "function") {
      return Promise.reject(new TypeError("event and handler are required"));
    }
    const key = this.#eventKey(event);
    if (key && this.seen.has(key)) return Promise.resolve({ duplicate: true });
    if (key) this.#remember(key);
    const threadId = String(event.threadID || event.threadId || event.senderID || "global");
    const previous = this.queues.get(threadId) || Promise.resolve();
    const current = previous.catch(() => {}).then(() => handler(event));
    this.queues.set(threadId, current);
    return current.finally(() => {
      if (this.queues.get(threadId) === current) this.queues.delete(threadId);
    }).then(result => ({ duplicate: false, result }));
  }

  clear() {
    this.seen.clear();
    this.queues.clear();
  }
}

module.exports = { EventDispatcher };
