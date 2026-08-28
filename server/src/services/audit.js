import crypto from 'node:crypto';
import AuditLog from '../models/AuditLog.js';

/*
 * JSON key order matters when calculating a hash. This helper creates a
 * deterministic representation so the same event always produces the same hash.
 */
function canonical(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(',')}]`;
  }

  return `{${Object.keys(value)
    .sort()
    .map(key => `${JSON.stringify(key)}:${canonical(value[key])}`)
    .join(',')}}`;
}

function hashEvent(event) {
  const content = canonical({
    eventType: event.eventType,
    patientId: event.patientId ?? null,
    actorId: event.actorId ?? 'SYSTEM',
    timestamp: new Date(event.timestamp).toISOString(),
    payload: event.payload ?? {},
    previousHash: event.previousHash ?? 'GENESIS'
  });

  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Append one event to the audit chain.
 *
 * The latest event becomes the previous link, making the sequence tamper-evident.
 * This is a prototype audit mechanism, not a replacement for a production-grade
 * immutable event store or compliance archive.
 */
export async function appendAudit({
  eventType,
  patientId = null,
  actorId = 'SYSTEM',
  actorRole = 'SYSTEM',
  payload = {}
}) {
  const latest = await AuditLog.findOne()
    .sort({ timestamp: -1, _id: -1 })
    .lean();

  const event = {
    eventId: crypto.randomUUID(),
    eventType,
    patientId,
    actorId,
    actorRole,
    timestamp: new Date(),
    payload,
    previousHash: latest?.hash || 'GENESIS'
  };

  return AuditLog.create({
    ...event,
    hash: hashEvent(event)
  });
}

/**
 * Rebuild the chain from the beginning and stop at the first mismatch.
 * Returning the event index makes a broken chain easier to diagnose in the UI.
 */
export async function verifyAuditChain() {
  const events = await AuditLog.find()
    .sort({ timestamp: 1, _id: 1 })
    .lean();

  let previousHash = 'GENESIS';

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    const expectedHash = hashEvent({
      ...event,
      previousHash
    });

    if (
      event.previousHash !== previousHash ||
      event.hash !== expectedHash
    ) {
      return {
        valid: false,
        firstBrokenEvent: index,
        eventId: event.eventId,
        reason: 'Hash or previousHash mismatch'
      };
    }

    previousHash = event.hash;
  }

  return {
    valid: true,
    events: events.length,
    firstBrokenEvent: null
  };
}
