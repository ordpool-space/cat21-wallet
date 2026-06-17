import { AvailableLanguageCode } from '@/i18n/languages';

export async function loadLanguageData(code: AvailableLanguageCode) {
  switch (code) {
    case 'en':
      return Promise.all([
        // HACK -- Cat21: ./locales/en/messages is Lingui codegen, generated
        // at runtime via `lingui:compile`. tsc can't resolve it; the dynamic
        // import is fine at bundle time. Inherited from upstream Leather.
        // @ts-expect-error TS2307: codegen module resolved at build time, not typecheck time.
        import('./locales/en/messages'),
        import('@formatjs/intl-numberformat/locale-data/en'),
        import('@formatjs/intl-pluralrules/locale-data/en'),
      ]);
    default:
      return Promise.all([
        // @ts-expect-error TS2307: see above; same Lingui codegen module.
        import('./locales/en/messages'),
        import('@formatjs/intl-numberformat/locale-data/en'),
        import('@formatjs/intl-pluralrules/locale-data/en'),
      ]);
  }
}
