import webpack from 'webpack';

import { config } from './webpack.config.base.js';

// HACK -- Cat21 (audit C1): the @sentry/webpack-plugin block has
// been removed. Cat21 Wallet ships zero telemetry per
// PRIVACY-POLICY.md; we do not upload source maps or attach a
// `release` identifier to any Sentry org. The SENTRY_AUTH_TOKEN
// env var is no longer read here.
config.mode = 'production';

config.optimization = {
  ...config.optimization,
  minimize: false,
  moduleIds: 'deterministic',
  splitChunks: {
    maxSize: process.env.TARGET_BROWSER === 'firefox' ? 3500000 : undefined,
    chunks(chunk) {
      return chunk.name === 'index';
    },
    hidePathInfo: false,
    minSize: 10000,
    maxAsyncRequests: Infinity,
    maxInitialRequests: Infinity,
  },
};

config.plugins = [
  ...config.plugins,
  new webpack.SourceMapDevToolPlugin({
    // These entry points are excuted in an app's context. If we generate source
    // maps for them, the browser attempts to load them from the inaccessible
    // `chrome-extension://` protocol, throwing console errors. To prevent
    // these, we do not generate source maps for these files. Otherwise, these
    // `SourceMapDevToolPlugin` options emulate the `devtool: source-map` config
    exclude: [/inpage/, /content\-script/, /browser\-polyfill/],
    filename: '[file].map',
  }),
  // HACK -- Cat21 (audit C1): the inherited sentryWebpackPlugin block
  // (`org: 'trust-machines', project: 'leather'`) is gone. We do not
  // upload source maps or release identifiers to any third party.
];

config.devtool = false;

export default config;
