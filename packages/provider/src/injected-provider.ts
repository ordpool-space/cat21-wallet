// placeholder for creating injected-provider.d.ts for mobile
// HACK -- Cat21: shared ESLint rule now honors `_` arg prefix natively;
// the previous inline `eslint-disable-next-line` directive triggered
// `reportUnusedDisableDirectives`. The underscore alone is enough.
export default (_: { branch: string; commitSha: string; version: string }) => '';
