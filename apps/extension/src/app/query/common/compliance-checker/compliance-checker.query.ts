import { useQueries } from '@tanstack/react-query';

/* HACK -- Cat21: the Chainalysis address check is switched off, so nothing here
   sends an address to api.chainalysis.com; the axios import and the two request
   functions are kept commented out to keep the upstream Leather diff small.
import axios from 'axios';
*/
import { makeComplianceQuery } from '@leather.io/query';
import { ensureArray, isEmptyString, uniqueArray } from '@leather.io/utils';

import { analytics } from '@shared/utils/analytics';

import { useCurrentAccountNativeSegwitIndexZeroPayerNullable } from '@app/store/accounts/blockchain/bitcoin/native-segwit-account.hooks';
import { useCurrentNetwork } from '@app/store/networks/networks.selectors';

/* HACK -- Cat21: Chainalysis switched off (see the import above).
const checkApi = 'https://api.chainalysis.com/api/risk/v2/entities';

const headers = {
  // Known public key, do not open a vulnerability report for this
  Token: '51d3c7529eb08a8c62d41d70d006bdcd4248150fbd6826d5828ac908e7c12073',
};

async function registerEntityAddressComplianceCheck(address: string) {
  const resp = await axios.post(checkApi, { address }, { headers });
  return resp.data;
}

async function checkEntityAddressComplianceCheck(address: string) {
  const resp = await axios.get(checkApi + '/' + address, { headers });
  return resp.data;
}
*/

type ComplianceReportSeverity = 'None' | 'Low' | 'Moderate' | 'Severe';

interface ComplianceReport {
  risk: ComplianceReportSeverity;
  isOnSanctionsList: boolean;
}

/* HACK -- Cat21: the Chainalysis address check is switched off. This answers
   "not on a sanctions list" without any request, so the form validators and
   every caller keep their flow. It resolves rather than throws on purpose: a
   caller that maps an error to "not compliant" would otherwise block every send. */
export function checkEntityAddressIsCompliant(_address: string): Promise<ComplianceReport> {
  return Promise.resolve({ risk: 'None', isOnSanctionsList: false });
}
/* HACK -- Cat21: the upstream body, kept for the quarterly upstream sync.
export async function checkEntityAddressIsCompliant(address: string): Promise<ComplianceReport> {
  await registerEntityAddressComplianceCheck(address);
  const entityReport = await checkEntityAddressComplianceCheck(address);

  const isOnSanctionsList = entityReport.risk === 'Severe';

  if (isOnSanctionsList) analytics.track('non_compliant_entity_detected', { address });

  return { ...entityReport, isOnSanctionsList };
}
*/

function useCheckAddressComplianceQueries(addresses: string[]) {
  const network = useCurrentNetwork();
  const filteredAddresses = addresses.filter(address => !isEmptyString(address));
  const uniqueAddresses = uniqueArray(filteredAddresses);
  return useQueries({
    queries: uniqueAddresses.map(address =>
      makeComplianceQuery({ address, networkMode: network.chain.bitcoin.mode })
    ),
  });
}

export const compliantErrorBody = 'Unable to handle request, errorCode: 1398';

export function useBreakOnNonCompliantEntity(address: string | string[] = '') {
  const nativeSegwitSigner = useCurrentAccountNativeSegwitIndexZeroPayerNullable();

  const complianceReports = useCheckAddressComplianceQueries([
    nativeSegwitSigner?.address ?? '',
    ...ensureArray(address),
  ]);

  if (complianceReports.some(report => report.data?.isOnSanctionsList)) {
    analytics.track('non_compliant_entity_detected', { address });
    throw new Error(compliantErrorBody);
  }
}
