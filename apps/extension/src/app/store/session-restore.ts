import { decryptMnemonic as decrypt } from '@stacks/encryption';
import z from 'zod';

import { logger } from '@shared/logger';

import { persistor, store } from '@app/store';
import { selectSoftwareKeys } from '@app/store/software-keys/software-key.selectors';

import { inMemoryKeyActions } from './in-memory-key/in-memory-key.actions';

export async function initalizeWalletSession(encryptionKey: string) {
  return chrome.storage.session.set({ encryptionKey });
}

export async function clearWalletSession() {
  return chrome.storage.session.remove('encryptionKey');
}

async function getWalletSessionKey() {
  const key = await chrome.storage.session.get(['encryptionKey']);
  return z.string().safeParse(key.encryptionKey);
}

/* HACK -- Cat21: the encrypted software keys reach the store only when
   redux-persist rehydrates from chrome.storage.local, while the session key
   comes from chrome.storage.session. Either read can finish first. Reading the
   keys before rehydration decrypts an empty list and the popup boots to the
   Unlock screen although the session key exists, so the restore waits for
   `bootstrapped`. */
function whenPersistedStateRehydrated() {
  return new Promise<void>(resolve => {
    if (persistor.getState().bootstrapped) return resolve();
    const unsubscribe = persistor.subscribe(() => {
      if (!persistor.getState().bootstrapped) return;
      unsubscribe();
      resolve();
    });
  });
}

export async function restoreWalletSession() {
  const keyResult = await getWalletSessionKey();

  if (!keyResult.success) return;

  /* HACK -- Cat21: see `whenPersistedStateRehydrated` */
  await whenPersistedStateRehydrated();

  try {
    const encryptedKeys = selectSoftwareKeys(store.getState());

    const decryptedKeys = await Promise.all(
      encryptedKeys.map(async softwareKey => ({
        fingerprint: softwareKey.id,
        secretKey: await decrypt(softwareKey.encryptedSecretKey, keyResult.data),
      }))
    );

    store.dispatch(inMemoryKeyActions.setWalletKeys(decryptedKeys));
  } catch {
    logger.error('Failed to decrypt secret key');
  }
}
