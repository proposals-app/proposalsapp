const path = require('path');

const config = {
  stories: ['../app/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@storybook/addon-docs',
    '@storybook/addon-onboarding',
    '@chromatic-com/storybook',
  ],
  framework: {
    name: '@storybook/nextjs',
    options: {},
  },
  staticDirs: ['../public'],
  webpackFinal: async (config) => {
    // Add custom plugin to handle cloudflare: scheme
    config.plugins = config.plugins || [];
    config.plugins.push({
      apply(compiler) {
        compiler.hooks.normalModuleFactory.tap(
          'CloudflareSchemePlugin',
          (factory) => {
            factory.hooks.beforeResolve.tap(
              'CloudflareSchemePlugin',
              (resolveData) => {
                if (resolveData.request?.startsWith('cloudflare:')) {
                  resolveData.request = false;
                }
              }
            );
          }
        );
      },
    });

    // Prevent Node.js modules from being included in browser bundle
    config.resolve = config.resolve || {};
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      dns: false,
      net: false,
      tls: false,
      crypto: false,
      stream: false,
      http: false,
      https: false,
      zlib: false,
      path: 'path-browserify',
      os: false,
      process: 'process/browser',
      buffer: 'buffer',
      pg: false,
      'pg-native': false,
    };

    // Add webpack DefinePlugin to provide process.env
    const webpack = require('webpack');
    config.plugins = config.plugins || [];
    config.plugins.push(
      new webpack.DefinePlugin({
        'process.env': JSON.stringify({
          // Mock environment variables to prevent database connections
          DATABASE_URL: 'mock://localhost/test',
          ARBITRUM_DATABASE_URL: 'mock://localhost/test',
          UNISWAP_DATABASE_URL: 'mock://localhost/test',
          NODE_ENV: 'test',
        }),
        'process.cwd': 'function() { return "/"; }',
        global: 'globalThis',
      })
    );

    // Add ProvidePlugin to make process and Buffer available globally
    config.plugins.push(
      new webpack.ProvidePlugin({
        process: 'process/browser',
        Buffer: ['buffer', 'Buffer'],
      })
    );

    // Ignore database-related modules in Storybook
    config.externals = config.externals || [];
    if (Array.isArray(config.externals)) {
      config.externals.push('pg', 'pg-native');
    }

    // Add webpack alias to mock @proposalsapp/db
    config.resolve.alias = {
      ...config.resolve.alias,
      '@proposalsapp/db': path.resolve(__dirname, '../storybook-mocks/db.js'),
    };

    // Add a module replacement rule for the database package
    config.plugins.push({
      apply(compiler) {
        compiler.hooks.normalModuleFactory.tap(
          'DatabaseMockPlugin',
          (factory) => {
            factory.hooks.beforeResolve.tap(
              'DatabaseMockPlugin',
              (resolveData) => {
                if (resolveData.request === '@proposalsapp/db') {
                  resolveData.request = path.resolve(__dirname, '../storybook-mocks/db.js');
                }
              }
            );
          }
        );
      },
    });

    if (config.module?.rules) {
      // Find the existing rule that handles SVG files
      const imageRule = config.module.rules.find((rule) => {
        if (rule && typeof rule === 'object' && 'test' in rule && rule.test) {
          return rule.test.toString().includes('svg');
        }
        return false;
      });

      // Exclude SVG files from the default image rule
      if (imageRule && typeof imageRule === 'object') {
        imageRule.exclude = /\.svg$/;
      }

      // Add SVGR loader for SVG files
      config.module.rules.push({
        test: /\.svg$/,
        issuer: /\.[jt]sx?$/,
        use: ['@svgr/webpack'],
      });
    }

    return config;
  },
};

module.exports = config;