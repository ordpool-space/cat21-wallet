import { useQuery } from '@tanstack/react-query';
import { Flex, styled } from 'leather-styles/jsx';
import { resolveRuneEtchingTxid } from 'ordpool-sdk/core';

import { openInNewTab } from '@app/common/utils/open-in-new-tab';

import { type FundingAssetRow, type FundingNoticeModel } from './cat21-funding-notice.model';

/**
 * The funding-safety notice shown on a manual cat action, rendered straight from
 * the `FundingNoticeModel` the route derives from the SDK `simulate*` preview:
 *
 *   - `none`     — a clean coin covers it (or no preview is wired). Renders
 *     NOTHING, so the safe dialog is byte-identical to the common path.
 *   - `checking` — the preview is in flight; a brief line while the CTA is held.
 *   - `blocked`  — insufficient funds, or a coin couldn't be content-checked.
 *   - `assets`   — the only covering coin carries assets. Each is NAMED (not
 *     counted) and, where a transaction exists to point at, linked. cat21-wallet
 *     is a separate-payment-address wallet, so the CTA stays live: the person
 *     decides after seeing what the coin carries.
 */
interface Cat21FundingNoticeProps {
  model: FundingNoticeModel;
  /**
   * Explorer link for a txid, or `null` when there is no public explorer for the
   * active network (regtest) — the asset then renders named but unlinked, which
   * still delivers the safety property (the person sees WHAT the coin carries).
   */
  linkForTxid(txid: string): string | null;
  /** Base URL of an ord JSON instance, to resolve a rune's etching transaction. */
  ordBaseUrl: string;
}

/**
 * Resolve each rune name to its etching transaction, so a rune row can link to
 * the tx that created it. Returns a name→txid map; a name absent from the map
 * (reserved runes like UNCOMMON•GOODS, an unknown name, or a lookup that has not
 * resolved yet) renders as plain text. `resolveRuneEtchingTxid` returns `null`
 * for all three, which is exactly the reserved-rune guard: never link an
 * all-zero etching. `null` is deliberately NOT cached (a transient miss must not
 * freeze into a dead row).
 */
function useRuneEtchingTxids(
  runeNames: readonly string[],
  ordBaseUrl: string
): Record<string, string> {
  const query = useQuery({
    queryKey: ['cat21-rune-etchings', ordBaseUrl, [...runeNames].sort()],
    enabled: runeNames.length > 0,
    queryFn: async (): Promise<Record<string, string>> => {
      const entries = await Promise.all(
        runeNames.map(async name => {
          const txid = await resolveRuneEtchingTxid(name, { ordBaseUrl });
          return { name, txid };
        })
      );
      const map: Record<string, string> = {};
      for (const { name, txid } of entries) {
        if (txid != null) map[name] = txid;
      }
      return map;
    },
  });
  return query.data ?? {};
}

/** One named asset line: a label plus, when there is a tx to point at, a link. */
function AssetLine({ label, name, href }: { label: string; name: string; href: string | null }) {
  return (
    <Flex justifyContent="space-between" gap="space.04" alignItems="baseline">
      <styled.span textStyle="label.02" color="ink.text-subdued" flexShrink={0}>
        {label}
      </styled.span>
      {href ? (
        <styled.button
          type="button"
          onClick={() => openInNewTab(href)}
          textStyle="mono.02"
          fontFamily="monospace"
          textDecoration="underline"
          cursor="pointer"
          textAlign="right"
          data-testid="cat21-funding-notice-asset"
        >
          {name}
        </styled.button>
      ) : (
        <styled.span
          textStyle="mono.02"
          fontFamily="monospace"
          textAlign="right"
          data-testid="cat21-funding-notice-asset"
        >
          {name}
        </styled.span>
      )}
    </Flex>
  );
}

/** The synchronous txid link for a row, upgraded with the async rune etching. */
function hrefForRow(
  row: FundingAssetRow,
  runeTxids: Record<string, string>,
  linkForTxid: (txid: string) => string | null
): string | null {
  const txid = row.runeName ? runeTxids[row.runeName] : row.linkTxid;
  if (!txid) return null;
  return linkForTxid(txid);
}

export function Cat21FundingNotice({ model, linkForTxid, ordBaseUrl }: Cat21FundingNoticeProps) {
  const runeNames =
    model.kind === 'assets' ? model.rows.flatMap(row => (row.runeName ? [row.runeName] : [])) : [];
  const runeTxids = useRuneEtchingTxids(runeNames, ordBaseUrl);

  if (model.kind === 'none') return null;

  if (model.kind === 'checking') {
    return (
      <styled.p
        textStyle="body.02"
        color="ink.text-subdued"
        data-testid="cat21-funding-notice-checking"
      >
        Checking that this action won’t spend a coin carrying an asset…
      </styled.p>
    );
  }

  if (model.kind === 'blocked') {
    return (
      <Flex
        direction="column"
        gap="space.02"
        p="space.04"
        borderRadius="sm"
        backgroundColor="ink.background-secondary"
        data-testid="cat21-funding-notice-blocked"
      >
        <styled.span textStyle="label.01">Can’t fund this action</styled.span>
        <styled.p textStyle="body.02" color="ink.text-subdued">
          {model.reason}
        </styled.p>
      </Flex>
    );
  }

  return (
    <Flex
      direction="column"
      gap="space.03"
      p="space.04"
      borderRadius="sm"
      backgroundColor="ink.background-secondary"
      data-testid="cat21-funding-notice"
    >
      <styled.span textStyle="label.01">This funding coin carries assets</styled.span>
      <styled.p textStyle="body.02" color="ink.text-subdued">
        {model.intro}
      </styled.p>
      <Flex direction="column" gap="space.02">
        {model.rows.map(row => (
          <AssetLine
            key={row.key}
            label={row.label}
            name={row.name}
            href={hrefForRow(row, runeTxids, linkForTxid)}
          />
        ))}
      </Flex>
    </Flex>
  );
}
