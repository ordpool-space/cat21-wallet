import { AvailableLanguageCode } from '@/i18n/languages';

export async function loadLanguageData(code: AvailableLanguageCode) {
  switch (code) {
    case 'en':
      return Promise.all([
        // The `*/locales/*/messages` ambient module in apps/mobile/index.d.ts
        // makes this resolvable at typecheck time whether or not the Lingui
        // `lingui:compile` step has run on the current machine.
        import('./locales/en/messages'),
        import('@formatjs/intl-numberformat/locale-data/en'),
        import('@formatjs/intl-pluralrules/locale-data/en'),
      ]);
    default:
      return Promise.all([
        import('./locales/en/messages'),
        import('@formatjs/intl-numberformat/locale-data/en'),
        import('@formatjs/intl-pluralrules/locale-data/en'),
      ]);
  }
}
