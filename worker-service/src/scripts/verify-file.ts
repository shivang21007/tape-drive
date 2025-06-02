const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const csvWriter = require('csv-write-stream');

const stat = promisify(fs.stat);
const readdir = promisify(fs.readdir);

const baseDir = '/home/octro/tapedata1';
const outputFile = './tapedata_inventory.csv';

// Helping Function to convert file size from bytes to KB, MB, GB, TB
export const formatFileSize = (bytes: number | string | undefined): string => {
    if (bytes === undefined || bytes === null) {
      return '0 B';
    }
    // Convert to number if it's a string
    const numBytes = typeof bytes === 'string' ? parseFloat(bytes) : bytes;
    if (isNaN(numBytes) || numBytes < 0) {
      return '0 B';
    }
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = numBytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  };

async function walkDir(currentPath: string, writer: any) {
  try {
    const entries = await readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        await walkDir(fullPath, writer);
      } else if (entry.isFile()) {
        const stats = await stat(fullPath);

        writer.write({
          filename: entry.name,
          filepath: fullPath,
          file_size: formatFileSize(stats.size)
        });
      }
    }
  } catch (err: any) {
    console.error(`Error reading ${currentPath}: ${err.message}`);
  }
}

async function main() {
  const writer = csvWriter({ headers: ['filename', 'file_size', 'filepath'] });
  writer.pipe(fs.createWriteStream(outputFile));

  console.log(`Scanning directory: ${baseDir}`);
  await walkDir(baseDir, writer);

  writer.end();
  console.log(`✅ File list written to: ${outputFile}`);
}

main();
