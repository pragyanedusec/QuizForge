/**
 * File cleanup utilities for uploaded PDFs.
 *
 * Rules:
 *  - Delete ONLY after successful DB save (never before)
 *  - Use async unlink (non-blocking)
 *  - Keep file on parse failure ONLY if NODE_ENV=development (debugging)
 *  - Startup scan removes orphaned files older than MAX_FILE_AGE_MS
 */

const fs = require('fs');
const path = require('path');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const MAX_FILE_AGE_MS = 60 * 60 * 1000; // 1 hour — after this, orphan cleanup kicks in

/**
 * Async non-blocking file delete.
 * Logs warnings on failure but never throws.
 */
async function deleteFile(filePath, context = '') {
  try {
    await fs.promises.unlink(filePath);
    console.log(`[fileCleanup] Deleted: ${path.basename(filePath)} ${context}`);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      // ENOENT = already deleted, that's fine
      console.warn(`[fileCleanup] Could not delete ${path.basename(filePath)}: ${err.message} ${context}`);
    }
  }
}

/**
 * Delete file only after a successful operation.
 * On failure, keeps file in dev (for debugging), deletes in production.
 *
 * @param {string} filePath
 * @param {boolean} success - whether the upstream operation succeeded
 * @param {string} context  - label for logs
 */
async function cleanupAfterProcess(filePath, success, context = '') {
  if (success) {
    await deleteFile(filePath, `after success ${context}`);
  } else if (process.env.NODE_ENV === 'production') {
    // In production: always clean up to avoid disk fill
    await deleteFile(filePath, `after failure ${context} [prod]`);
  } else {
    // In development: keep file for debugging
    console.info(`[fileCleanup] Keeping file for debugging: ${path.basename(filePath)}`);
  }
}

/**
 * Startup orphan cleanup.
 * Removes any files in uploads/ older than MAX_FILE_AGE_MS.
 * Call once on server/worker startup to handle crash recovery.
 */
async function cleanupOrphanFiles() {
  try {
    const files = await fs.promises.readdir(UPLOADS_DIR);
    const now = Date.now();
    let cleaned = 0;

    for (const file of files) {
      // Skip .gitkeep or hidden files
      if (file.startsWith('.')) continue;

      const fullPath = path.join(UPLOADS_DIR, file);
      try {
        const stat = await fs.promises.stat(fullPath);
        const ageMs = now - stat.mtimeMs;
        if (ageMs > MAX_FILE_AGE_MS) {
          await fs.promises.unlink(fullPath);
          cleaned++;
          console.log(`[fileCleanup] Orphan removed: ${file} (age: ${Math.round(ageMs / 60000)}min)`);
        }
      } catch {
        // File may have been deleted concurrently — skip
      }
    }

    if (cleaned > 0) {
      console.log(`[fileCleanup] Startup cleanup: removed ${cleaned} orphaned file(s)`);
    }
  } catch (err) {
    // Uploads dir might not exist yet — not an error
    if (err.code !== 'ENOENT') {
      console.warn('[fileCleanup] Orphan cleanup failed:', err.message);
    }
  }
}

module.exports = { deleteFile, cleanupAfterProcess, cleanupOrphanFiles };
