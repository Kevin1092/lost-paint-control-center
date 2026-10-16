const path = require('path');
const { execSync } = require('child_process');

console.log(`[SQLite Check] Verifying better-sqlite3 for Node ${process.version} (${process.platform}-${process.arch})...`);

try {
  const Database = require(path.resolve(__dirname, '../server/node_modules/better-sqlite3'));
  const testDb = new Database(':memory:');
  const res = testDb.prepare('SELECT 1 as ok').get();
  testDb.close();
  if (res && res.ok === 1) {
    console.log('[SQLite Check] better-sqlite3 binary verified successfully.');
  }
} catch (err) {
  console.warn('[SQLite Check] better-sqlite3 failed to load:', err.message);
  console.log('[SQLite Check] Rebuilding better-sqlite3 for current runtime...');
  try {
    execSync('npm rebuild better-sqlite3 -w server', { stdio: 'inherit' });
    console.log('[SQLite Check] better-sqlite3 rebuild completed successfully.');
  } catch (rebuildErr) {
    console.error('[SQLite Check] Failed to rebuild better-sqlite3:', rebuildErr.message);
  }
}
