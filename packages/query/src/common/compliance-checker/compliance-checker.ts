/* HACK -- Cat21: the Chainalysis address check is switched off, so nothing here
   sends an address to api.chainalysis.com; the axios import and the two request
   functions are kept commented out to keep the upstream Leather diff small.
import axios from 'axios';
*/
import { BitcoinAddress, BitcoinNetworkModes, ChainId } from '@leather.io/models';

import { ComplianceReport } from './compliance-checker.types';

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

// TODO - refactor further once branded type is implemented for StacksAddress
type Address = string | BitcoinAddress;

interface IsAddressCompliantProps {
  address: Address;
  chain: ChainId | BitcoinNetworkModes;
}

export async function isAddressCompliant({ address, chain }: IsAddressCompliantProps) {
  if (chain !== 'mainnet') return true;

  try {
    const resp = await checkEntityAddressIsCompliant({
      address,
    });
    return !resp.isOnSanctionsList;
  } catch {
    return false;
  }
}

interface CheckEntityAddressIsCompliantProps {
  address: Address;
}

// TODO LEA-2189 - refactor to use the hook in the extension
/* HACK -- Cat21: the Chainalysis address check is switched off. This answers
   "not on a sanctions list" without any request, which covers every consumer of
   this package: `makeComplianceQuery` (the extension's signing and send flows)
   and `isAddressCompliant` (apps/mobile's send flow). It resolves rather than
   throws on purpose: `isAddressCompliant` maps an error to "not compliant",
   which would block every send. */
export function checkEntityAddressIsCompliant(
  _props: CheckEntityAddressIsCompliantProps
): Promise<ComplianceReport> {
  return Promise.resolve({ risk: 'None', isOnSanctionsList: false });
}
/* HACK -- Cat21: the upstream body, kept for the quarterly upstream sync.
export async function checkEntityAddressIsCompliant({
  address,
}: CheckEntityAddressIsCompliantProps): Promise<ComplianceReport> {
  await registerEntityAddressComplianceCheck(address);
  const entityReport = await checkEntityAddressComplianceCheck(address);

  return { ...entityReport, isOnSanctionsList: entityReport.risk === 'Severe' };
}
*/
