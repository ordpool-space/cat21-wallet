import { useQuery } from '@tanstack/react-query';
import { Flex, styled } from 'leather-styles/jsx';
import { type MintStatus, type UtxoAssetDetail, resolveRuneEtchingTxid } from 'ordpool-sdk/core';

import { openInNewTab } from '@app/common/utils/open-in-new-tab';

import { type FundingAssetRow, describeFundingNotice } from './cat21-funding-notice.model';

/**
 * The funding-safety notice shown on a manual cat action BEFORE the user
 * approves. It renders ONLY when the SDK's `simulate*` could not fund the action
 * from a clean coin (see `describeFundingNotice` for the status→shape mapping):
 *
 *   - `asset-notice` — the only coin that covers the spend carries assets. The
 *     action MAY proceed (cat21-wallet is a separate-payment-address wallet, so
 *     the core downgrades the block to a notice), but the person must be told
 *     WHAT sits on the coin they are about to pay to the miners. Each asset is
 *     NAMED (not counted) and, where a transaction exists to point at, linked.
 *   - `insufficient` / `expert-required` — nothing spendable covers the action,
 *     or a coin couldn't be content-checked. Blocked; the CTA is disabled and
 *     this explains why.
 *   - `ready` — a clean coin covers it. Renders NOTHING, so the safe dialog is
 *     byte-identical to the common path. This is the invariant the capture specs
 *     pin.
 */
interface Cat21FundingNoticeProps {
  status: MintStatus;
  /** Named assets on the coin the flow would spend; set only on `asset-notice`. */
  assets: UtxoAssetDetail | null;
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
          return [name, txid] as const;
        })
      );
      const map: Record<string, string> = {};
      for (const [name, txid] of entries) {
        if (txid != null) map[name] = txid;
      }
      return map;
    },
  });
  return query.data ?? {};
}

/** One named asset line: a label plus, when there is a tx to point at, a link. */
function AssetLine(props: { label: string; name: string; href: string | null }) {
  const { label, name, href } = props;
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

export function Cat21FundingNotice(props: Cat21FundingNoticeProps) {
  const { status, assets, linkForTxid, ordBaseUrl } = props;
  const runeTxids = useRuneEtchingTxids(assets?.runeNames ?? [], ordBaseUrl);
  const model = describeFundingNotice(status, assets);

  if (model.kind === 'none') return null;

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
