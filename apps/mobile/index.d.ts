// For image imports
declare module '*.png';
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.webp';

// For SVGs
declare module '*.svg' {
  import React from 'react';
  import { SvgProps } from 'react-native-svg';
  const content: React.FC<SvgProps>;
  export default content;
}

// Lingui codegen is generated at runtime via `lingui:compile`. The module
// may or may not be on disk at typecheck time (CI generates it, local dev
// often doesn't). Declare both relative and absolute import forms so
// typecheck stays clean in both states.
declare module '*/locales/en/messages';
declare module './locales/en/messages';
declare module '@/i18n/locales/en/messages';
