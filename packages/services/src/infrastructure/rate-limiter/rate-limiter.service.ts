import { inject, injectable } from 'inversify';
import PQueue from 'p-queue';

import { bitcoinNetworkModeToCoreNetworkMode } from '@leather.io/bitcoin';
import { NetworkModes } from '@leather.io/models';

import { Types } from '../../inversify.types';
import type { SettingsService } from '../settings/settings.service';
/* HACK -- Cat21: cat21-ord limiter wired into the rate-limiter registry per
 * ADR-12. Mainnet only (ADR-7); testnet slot deliberately reuses the same queue
 * so a stray testnet caller would still queue rather than crash. */
import { cat21OrdMainnetApiLimiter } from './cat21-ord-limiter';
import { hiroStacksMainnetApiLimiter, hiroStacksTestnetApiLimiter } from './hiro-rate-limiter';
import { leatherApiLimiter } from './leather-rate-limiter';

// AbortController polyfill for React Native
if (!AbortSignal.prototype.throwIfAborted) {
  AbortSignal.prototype.throwIfAborted = function throwIfAborted() {
    if (this.aborted) {
      throwAbortError();
    }
  };
}

function throwAbortError() {
  const abortError = new Error('AbortError');
  abortError.name = 'AbortError';
  throw abortError;
}

export enum RateLimiterType {
  HiroStacks,
  Leather,
  /* HACK -- Cat21: Cat21Ord limiter type per ADR-12. */
  Cat21Ord,
}

export interface RateLimiterQueueOptions {
  interval: number;
  intervalCap: number;
  timeout: number;
}

interface RateLimiterCallOptions {
  priority?: number;
  throwOnTimeout?: boolean;
  signal?: AbortSignal;
}

@injectable()
export class RateLimiterService {
  private readonly limiters: Map<string, PQueue> = new Map([
    [this.getLimiterKey(RateLimiterType.HiroStacks, 'mainnet'), hiroStacksMainnetApiLimiter],
    [this.getLimiterKey(RateLimiterType.HiroStacks, 'testnet'), hiroStacksTestnetApiLimiter],
    [this.getLimiterKey(RateLimiterType.Leather, 'mainnet'), leatherApiLimiter],
    [this.getLimiterKey(RateLimiterType.Leather, 'testnet'), leatherApiLimiter],
    /* HACK -- Cat21: cat21-ord registered for both modes; testnet shares the
     * mainnet queue because no testnet cat21-ord exists per ADR-7. */
    [this.getLimiterKey(RateLimiterType.Cat21Ord, 'mainnet'), cat21OrdMainnetApiLimiter],
    [this.getLimiterKey(RateLimiterType.Cat21Ord, 'testnet'), cat21OrdMainnetApiLimiter],
  ]);

  constructor(@inject(Types.SettingsService) private readonly settingsService: SettingsService) {}

  public getLimiterKey(type: RateLimiterType, network: NetworkModes) {
    return `${type}_${network}`;
  }

  public getLimiter(type: RateLimiterType, mode: NetworkModes): PQueue {
    const key = this.getLimiterKey(type, mode);
    return this.limiters.get(key)!;
  }

  public async add<T>(
    type: RateLimiterType,
    fn: () => Promise<T>,
    options?: RateLimiterCallOptions
  ): Promise<T> {
    const limiter = this.getLimiter(
      type,
      bitcoinNetworkModeToCoreNetworkMode(
        this.settingsService.getSettings().network.chain.bitcoin.mode
      )
    );
    let result = undefined;
    try {
      result = await limiter.add(fn, options);
    } catch (error) {
      if (!error && options?.signal?.aborted) {
        throwAbortError();
      }
      throw error;
    }
    if (result === undefined) {
      if (options?.signal?.aborted) {
        throwAbortError();
      } else {
        throw new Error('Rate limited call undefined');
      }
    }
    return result as T;
  }
}
