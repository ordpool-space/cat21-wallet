import { injectable } from 'inversify';

import { NonFungibleCryptoAsset } from '@leather.io/models';

import { BnsService } from '../bns/bns.service';
import { AccountRequest } from '../types';
import { Cat21AssetService } from './cat21-asset.service';
import { Sip9sService } from './sip9s.service';

/* HACK -- Cat21: Cat21AssetService folded into the collectibles flow per
 * ADR-12. Sip9 + BNS code paths remain so cross-asset Stacks UI continues to
 * compile, but cats are the only collectibles surface the wallet actually
 * renders for end users. */
@injectable()
export class CollectiblesService {
  constructor(
    private readonly sip9sService: Sip9sService,
    private readonly bnsService: BnsService,
    private readonly cat21AssetService: Cat21AssetService
  ) {}

  public async getAccountCollectibles(
    request: AccountRequest,
    signal?: AbortSignal
  ): Promise<NonFungibleCryptoAsset[]> {
    const [stacksCollectibles, bnsNames, cats] = await Promise.all([
      this.sip9sService.getAccountSip9s(request, signal),
      this.bnsService.getAccountBnsNames(request, signal),
      this.cat21AssetService.getAccountCat21Assets(request, signal),
    ]);

    const bnsNameSet = new Set(bnsNames.map(n => n.fullName));
    const filteredStacks = stacksCollectibles.filter(sip9 => !bnsNameSet.has(sip9.name));
    return [...filteredStacks, ...cats];
  }
}
