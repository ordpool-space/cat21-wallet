/**
 * Cats carry arbitrary content bytes. When retrieving a cat, the content
 * is classified into one of the types below, indicating that the app can
 * handle it appropriately and securely. Cats of types not ready to be
 * handled by the app should be classified as "other".
 */
export const cat21MimeTypes = [
  'audio',
  'gltf',
  'html',
  'image',
  'svg',
  'text',
  'video',
  'other',
] as const;

export type Cat21MimeType = (typeof cat21MimeTypes)[number];
