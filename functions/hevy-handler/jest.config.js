module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Ignore build/dist folders
  testPathIgnorePatterns: ['/node_modules/', '/build/'],
  // Shared modules might need mapping if we used paths in tsconfig, but we used relative imports.
};
