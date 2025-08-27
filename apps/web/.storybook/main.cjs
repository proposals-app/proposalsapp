const path = require('path');

const config = {
  stories: ['../app/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@storybook/addon-docs',
    '@storybook/addon-onboarding',
    '@chromatic-com/storybook',
    path.resolve(__dirname, './dom-sizer-addon'),
  ],
  framework: {
    name: '@storybook/nextjs',
    options: {},
  },
  features: {
    experimentalRSC: true,
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
      child_process: false,
      // Mock jsdom and related dependencies completely
      jsdom: false,
      'agent-base': false,
      'http-proxy-agent': false,
      'https-proxy-agent': false,
      'socks-proxy-agent': false,
      'pac-proxy-agent': false,
      canvas: false,
      // Additional modules that jsdom tries to load
      abab: false,
      acorn: false,
      'acorn-globals': false,
      cssom: false,
      cssstyle: false,
      'data-urls': false,
      'decimal.js': false,
      domexception: false,
      escodegen: false,
      'form-data': false,
      'html-encoding-sniffer': false,
      'iconv-lite': false,
      'is-potential-custom-element-name': false,
      nwsapi: false,
      parse5: false,
      request: false,
      'request-promise-native': false,
      saxes: false,
      'symbol-tree': false,
      'tough-cookie': false,
      'w3c-hr-time': false,
      'w3c-xmlserializer': false,
      'webidl-conversions': false,
      'whatwg-encoding': false,
      'whatwg-mimetype': false,
      'whatwg-url': false,
      ws: false,
      'xml-name-validator': false,
    };

    // Add webpack DefinePlugin to provide process.env
    const webpack = require('webpack');
    config.plugins = config.plugins || [];
    config.plugins.push(
      new webpack.DefinePlugin({
        'process.env': JSON.stringify({
          // Mock environment variables to prevent database connections
          DATABASE_URL: 'mock://localhost/test',
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

    // Add webpack alias to mock dependencies
    config.resolve.alias = {
      ...config.resolve.alias,
      '@proposalsapp/db': path.resolve(__dirname, 'db_mock.js'),
      '@/lib/markdown-converter$': path.resolve(
        __dirname,
        'markdown-converter-mock.js'
      ),
      // Also handle the absolute path resolution
      [path.resolve(__dirname, '../lib/markdown-converter.ts')]: path.resolve(
        __dirname,
        'markdown-converter-mock.js'
      ),
      [path.resolve(__dirname, '../lib/markdown-converter')]: path.resolve(
        __dirname,
        'markdown-converter-mock.js'
      ),
      'next/server$': path.resolve(__dirname, 'mocks/next-server.js'),
      'server-only$': path.resolve(__dirname, 'mocks/empty-module.js'),
    };

    // Add a module replacement rule for mocked packages
    config.plugins.push({
      apply(compiler) {
        compiler.hooks.normalModuleFactory.tap('MockPlugin', (factory) => {
          factory.hooks.beforeResolve.tap('MockPlugin', (resolveData) => {
            if (resolveData.request === '@proposalsapp/db') {
              resolveData.request = path.resolve(__dirname, 'db_mock.js');
            }
            // Mock the markdown converter - handle all variations
            if (
              resolveData.request === '@/lib/markdown-converter' ||
              resolveData.request === '../lib/markdown-converter' ||
              resolveData.request === './lib/markdown-converter' ||
              resolveData.request?.endsWith('lib/markdown-converter') ||
              resolveData.request?.endsWith('lib/markdown-converter.ts') ||
              resolveData.request?.includes('markdown-converter')
            ) {
              console.log(
                `[MockPlugin] Intercepting markdown-converter import: ${resolveData.request}`
              );
              resolveData.request = path.resolve(
                __dirname,
                'markdown-converter-mock.js'
              );
            }
            // Block any direct imports to jsdom
            if (
              resolveData.request === 'jsdom' ||
              resolveData.request?.includes('jsdom')
            ) {
              resolveData.request = false;
            }
            // Mock the server actions for feed components
            if (
              resolveData.request &&
              resolveData.request.endsWith('/actions')
            ) {
              resolveData.request = path.resolve(
                __dirname,
                'mocks/feed-actions.js'
              );
            }
            // Also handle relative imports to actions
            if (resolveData.request === '../../actions') {
              resolveData.request = path.resolve(
                __dirname,
                'mocks/feed-actions.js'
              );
            }
          });
        });
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
