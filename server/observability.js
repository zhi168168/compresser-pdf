import { randomUUID } from 'node:crypto';

const allowedEvents = new Set(['auth_server_error', 'mail_delivery_failed', 'database_connection_failed', 'health_check_failed']);

// Deliberately accepts no error objects, request data, identities or URLs.
export function logOperationalEvent(event, { requestId } = {}, sink = console.error) {
  if (!allowedEvents.has(event)) return;
  const id = typeof requestId === 'string' && /^[a-f0-9]{12}$/.test(requestId)
    ? requestId : randomUUID().replaceAll('-', '').slice(0, 12);
  sink(JSON.stringify({ event, requestId: id, timestamp: new Date().toISOString() }));
}
