const fs = require('fs');
const path = require('path');

function cleanupOldFiles(directory, maxAgeMinutes) {
  try {
    const files = fs.readdirSync(directory);
    const now = Date.now();
    const maxAge = maxAgeMinutes * 60 * 1000;

    files.forEach(file => {
      const filePath = path.join(directory, file);
      try {
        const stats = fs.statSync(filePath);
        if (now - stats.mtimeMs > maxAge) {
          fs.unlinkSync(filePath);
          console.log(`Cleaned up: ${file}`);
        }
      } catch (err) {
        // Skip files that can't be accessed
      }
    });
  } catch (err) {
    console.error('Cleanup error:', err.message);
  }
}

module.exports = { cleanupOldFiles };
