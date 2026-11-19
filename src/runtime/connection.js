"use strict";

const { EventEmitter } = require("node:events");

const DEFAULTS = Object.freeze({ minDelayMs: 1000, maxDelayMs: 30000, factor: 2, jitter: 0.2 });

class ConnectionSupervisor extends EventEmitter {
  constructor({ connect, disconnect, options = {}, random = Math.random, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
    super();
    if (typeof connect !== "function") throw new TypeError("connect function is required");
    this.connectDriver = connect;
    this.disconnectDriver = typeof disconnect === "function" ? disconnect : async () => {};
    this.options = { ...DEFAULTS, ...options };
    this.random = random;
    this.sleep = sleep;
    this.state = "idle";
    this.driver = null;
    this.generation = 0;
    this.startPromise = null;
    this.stopRequested = false;
    this.listenerAttached = false;
  }

  snapshot() { return Object.freeze({ state: this.state, connected: Boolean(this.driver), generation: this.generation }); }

  async start() {
    if (this.startPromise) return this.startPromise;
    if (this.state === "connected") return this.driver;
    this.stopRequested = false;
    this.startPromise = this.#startLoop().finally(() => { this.startPromise = null; });
    return this.startPromise;
  }

  async #startLoop() {
    let attempt = 0;
    while (!this.stopRequested) {
      this.#setState(attempt ? "reconnecting" : "connecting");
      const generation = ++this.generation;
      try {
        const driver = await this.connectDriver({ attempt, generation });
        if (this.stopRequested || generation !== this.generation) {
          await this.disconnectDriver(driver);
          break;
        }
        if (!driver || typeof driver.listen !== "function") throw new Error("Transport driver must expose listen(callback)");
        this.driver = driver;
        this.listenerAttached = false;
        this.#setState("connected");
        this.emit("connected", this.snapshot());
        return driver;
      } catch (error) {
        this.#setState("disconnected");
        this.emit("connectionError", error);
        if (this.stopRequested) break;
        const base = Math.min(this.options.maxDelayMs, this.options.minDelayMs * Math.pow(this.options.factor, attempt++));
        const jitter = base * this.options.jitter * ((this.random() * 2) - 1);
        await this.sleep(Math.max(0, Math.round(base + jitter)));
      }
    }
    return null;
  }

  listen(callback) {
    if (typeof callback !== "function") throw new TypeError("listener callback is required");
    if (!this.driver) throw new Error("Connection is not ready");
    if (this.listenerAttached) throw new Error("A listener is already attached");
    this.listenerAttached = true;
    const generation = this.generation;
    const detach = this.driver.listen((error, event) => {
      if (generation !== this.generation || this.stopRequested) return;
      if (error) {
        this.emit("listenerError", error);
        return;
      }
      callback(event);
      this.emit("event", event);
    });
    let detached = false;
    return () => {
      if (detached) return;
      detached = true;
      if (generation === this.generation) this.listenerAttached = false;
      if (typeof detach === "function") detach();
    };
  }

  async stop() {
    this.stopRequested = true;
    ++this.generation;
    const driver = this.driver;
    this.driver = null;
    this.listenerAttached = false;
    if (driver) await this.disconnectDriver(driver);
    this.#setState("stopped");
    this.emit("stopped", this.snapshot());
  }

  #setState(next) {
    this.state = next;
    this.emit("state", this.snapshot());
  }
}

module.exports = { ConnectionSupervisor };
