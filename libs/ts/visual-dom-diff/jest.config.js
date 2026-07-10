const { createDefaultEsmPreset } = require('ts-jest')

const esmPreset = createDefaultEsmPreset({
    tsconfig: {
        esModuleInterop: true,
        module: 'ES2022',
        moduleResolution: 'Bundler',
        target: 'ES2022',
    },
})

module.exports = {
    ...esmPreset,
    setupFiles: ['<rootDir>/scripts/jestSetUp'],
    testMatch: [`<rootDir>/src/**/*.test.ts`],
    testEnvironment: 'node',
    collectCoverage: true,
    collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.test.{ts,tsx}'],
    coverageThreshold: {
        global: {
            branches: 100,
            functions: 100,
            lines: 100,
            statements: 100,
        },
    },
}
