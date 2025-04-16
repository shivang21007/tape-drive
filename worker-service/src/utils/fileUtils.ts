import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { logger } from './logger';

export async function calculateFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('error', (err) => {
      logger.error(`Error reading file for hash calculation: ${filePath}`, err);
      reject(err);
    });

    stream.on('data', (chunk) => {
      hash.update(chunk);
    });

    stream.on('end', () => {
      resolve(hash.digest('hex'));
    });
  });
}

export async function verifyFileCopy(sourcePath: string, destinationPath: string): Promise<boolean> {
  try {
    const sourceHash = await calculateFileHash(sourcePath);
    const destinationHash = await calculateFileHash(destinationPath);

    if (sourceHash !== destinationHash) {
      logger.error(`Hash mismatch for file: ${path.basename(sourcePath)}`);
      logger.error(`Source hash: ${sourceHash}`);
      logger.error(`Destination hash: ${destinationHash}`);
      return false;
    }

    logger.info(`File verification successful for: ${path.basename(sourcePath)}`);
    return true;
  } catch (error) {
    logger.error(`Error verifying file copy: ${path.basename(sourcePath)}`, error);
    throw error;
  }
} 