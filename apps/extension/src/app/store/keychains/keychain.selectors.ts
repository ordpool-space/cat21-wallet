import { useSelector } from 'react-redux';

import { createSelector } from '@reduxjs/toolkit';

import { keychainAdapter } from '@leather.io/state/keychains';

import { RootState } from '..';

function selectKeychainsSlice(state: RootState) {
  return state.keychains;
}

const keychainSelectors = keychainAdapter.getSelectors(selectKeychainsSlice);

const selectAllKeychains = keychainSelectors.selectAll;

export const selectBitcoinKeychains = createSelector([selectAllKeychains], keychains =>
  keychains.filter(keychain => keychain.chain === 'bitcoin')
);

const selectBitcoinKeychainDescriptors = createSelector([selectBitcoinKeychains], keychains =>
  keychains.map(keychain => keychain.descriptor)
);

export const selectStacksKeychains = createSelector([selectAllKeychains], keychains =>
  keychains.filter(keychain => keychain.chain === 'stacks')
);

const selectStacksKeychainDescriptors = createSelector([selectStacksKeychains], keychains =>
  keychains.map(keychain => keychain.descriptor)
);

/** @knipignore -- HACK Cat21: consumer wiring lands later; retain export. */
export function useBitcoinKeychainDescriptors() {
  return useSelector(selectBitcoinKeychainDescriptors);
}

/** @knipignore -- HACK Cat21: consumer file is knip-ignored, retain export for typecheck. */
export function useStacksKeychainDescriptors() {
  return useSelector(selectStacksKeychainDescriptors);
}
