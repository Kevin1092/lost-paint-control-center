const { execSync } = require('child_process');

console.log('[Build] Starting Lost Paint Studios build pipeline...');

// 1. Verify / rebuild SQLite if needed
require('./verify-sqlite.js');

// 2. Build server
console.log('\n[Build] Compiling backend server...');
execSync('npm run build -w server', { stdio: 'inherit' });

// 3. Build client
console.log('\n[Build] Bundling frontend client...');
execSync('npm run build -w client', { stdio: 'inherit' });

console.log('\n[Build] Production build completed successfully!');
