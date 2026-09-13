/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testMatch: ['**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/jest.setup.ts'],
  // Suite roda sequencial (não em paralelo): todos os testes compartilham o
  // mesmo banco de teste, e resetDb() dentro de cada suite trunca as
  // tabelas — rodar em paralelo faria uma suite apagar os dados de outra no
  // meio da execução.
  maxWorkers: 1,
  testTimeout: 15000,
};
