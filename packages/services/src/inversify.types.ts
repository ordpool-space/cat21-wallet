export const Types = {
  CacheService: Symbol.for('CacheService'),
  SettingsService: Symbol.for('SettingsService'),
  Environment: Symbol.for('Environment'),
  AuthSessionService: Symbol.for('AuthSessionService'),
  /* HACK -- Cat21: Cat21OrdApiClient + Cat21AssetService DI symbols per
   * ADR-12. Symbols are reserved here for consumers that resolve by string. */
  Cat21OrdApiClient: Symbol.for('Cat21OrdApiClient'),
  Cat21AssetService: Symbol.for('Cat21AssetService'),
} as const;
