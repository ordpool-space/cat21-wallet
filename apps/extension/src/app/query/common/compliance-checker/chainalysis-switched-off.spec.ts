import { QueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as yup from 'yup';

import { makeComplianceQuery } from '@leather.io/query';

import { complianceValidator } from '@app/common/validation/forms/compliance-validators';

import { checkEntityAddressIsCompliant } from './compliance-checker.query';

/**
 * The Chainalysis address check is switched off: no address reaches
 * api.chainalysis.com on mainnet, on either path that reaches the check.
 *
 *   - Signing / send flows: `useBreakOnNonCompliantEntity` runs
 *     `makeComplianceQuery` (from `@leather.io/query`) for the signer and every
 *     recipient, enabled on mainnet. Its `queryFn` is the network seam.
 *   - Send forms: `complianceValidator` calls this package's own
 *     `checkEntityAddressIsCompliant` directly, without the query.
 *
 * axios is mocked at the IO boundary, so any request either path makes is
 * observed. With the upstream request code restored in either copy these fail:
 * axios is called, and its empty mocked response carries no `risk: 'None'`.
 */

// Automocked from the real module, so `@leather.io/query`'s import-time axios
// interceptor registration still finds `interceptors`.
vi.mock('axios');

const MAINNET_ADDRESS = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq';

beforeEach(() => {
  vi.mocked(axios.post).mockResolvedValue({ data: {} });
  vi.mocked(axios.get).mockResolvedValue({ data: {} });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('Chainalysis switched off', () => {
  it('signing path: the mainnet compliance query answers not-sanctioned without any request', async () => {
    const query = makeComplianceQuery({ address: MAINNET_ADDRESS, networkMode: 'mainnet' });
    // The query runs on mainnet; a real QueryClient executes its queryFn.
    expect(query.enabled).toBe(true);
    const report = await new QueryClient().fetchQuery(query);
    expect(report).toEqual({ risk: 'None', isOnSanctionsList: false });
    expect(axios.post).toHaveBeenCalledTimes(0);
    expect(axios.get).toHaveBeenCalledTimes(0);
  });

  it('form path: the mainnet compliance validator accepts the address without any request', async () => {
    const schema = complianceValidator(yup.string(), 'mainnet');
    await expect(schema.validate(MAINNET_ADDRESS)).resolves.toBe(MAINNET_ADDRESS);
    expect(axios.post).toHaveBeenCalledTimes(0);
    expect(axios.get).toHaveBeenCalledTimes(0);
  });

  it('the extension copy answers not-sanctioned without any request', async () => {
    await expect(checkEntityAddressIsCompliant(MAINNET_ADDRESS)).resolves.toEqual({
      risk: 'None',
      isOnSanctionsList: false,
    });
    expect(axios.post).toHaveBeenCalledTimes(0);
    expect(axios.get).toHaveBeenCalledTimes(0);
  });
});
