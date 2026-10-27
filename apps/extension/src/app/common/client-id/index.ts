import * as Sentry from '@sentry/react';
import { v4 as uuidv4 } from 'uuid';

export const clientIdV1Key = 'client-id-v1';

function generateClientId() {
  return uuidv4();
}

function setClientId(id: string) {
  try {
    localStorage.setItem(clientIdV1Key, id);
  } catch (e) {
    Sentry.captureException(e, {
      level: 'warning',
      extra: {
        key: clientIdV1Key,
      },
    });
  }
}

// HACK -- Cat21 (audit C1): retained for upstream-Leather merge
// compatibility; consumed by Mixpanel telemetry init upstream, which
// is stripped to a no-op stub locally. The export stays so the merge
// surface remains diff-friendly per HARD RULE #3.
// ts-unused-exports:disable-next-line
export function getClientId() {
  let id: string | null = null;
  try {
    id = localStorage.getItem(clientIdV1Key);
  } catch (e) {
    Sentry.captureException(e, {
      level: 'warning',
      extra: {
        key: clientIdV1Key,
      },
    });
  }

  if (id) return id;

  id = generateClientId();
  setClientId(id);

  return id;
}
