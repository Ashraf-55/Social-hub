import { EventEmitter } from "events";

/**
 * Minimal in-process event bus used to push real-time events to connected
 * SSE clients (see src/app/api/realtime/route.ts). This works within a
 * single Node.js process/instance. For a multi-instance production
 * deployment (more than one app replica), back this with a shared pub/sub
 * (e.g. Postgres LISTEN/NOTIFY, or Redis) so an event ingested by instance A
 * still reaches a browser connected to instance B — the emit/subscribe
 * call sites below would not need to change, only this file's internals.
 */
class RealtimeBus extends EventEmitter {
  publish(organizationId: string, event: { type: string; payload: unknown }) {
    this.emit(`org:${organizationId}`, event);
  }
}

export const realtimeBus = new RealtimeBus();
realtimeBus.setMaxListeners(0);
