import type { Cat21Transport } from '@background/cat21/mode-resolver';
import type { Cat21Intent } from '@background/cat21/types';

/**
 * Whether a stashed request may be confirmed without a human click: only one
 * that arrived over the NMH bridge AND explicitly declares `mode: 'autonomous'`.
 *
 * A request with `mode` omitted or `'manual'` resolves to manual signing, which
 * `resolveSigningMode` returns without the autonomous silent-sign gate
 * (`agentMode.enabled`). Auto-confirming it would let an NMH agent move cats or
 * funds silently, even with agent mode off, by simply omitting `mode`. Such a
 * request falls through to the human confirm dialog instead (the per-account
 * caps still bind it). A popup-transport request always waits for a click.
 */
export function mayAutoConfirm(request: {
  transport: Cat21Transport;
  intent: Pick<Cat21Intent, 'mode'>;
}): boolean {
  return request.transport === 'mcp-nmh' && request.intent.mode === 'autonomous';
}
