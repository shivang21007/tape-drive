import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { FileProcessingJob } from '../types/fileProcessing';

const execAsync = promisify(exec);

interface TapeConfig {
  [group: string]: string[];
}

export class TapeManager {
  private tapeDevice: string;
  private mountPoint: string;
  private tapeConfig: TapeConfig;

  constructor() {
    this.tapeDevice = process.env.TAPE_DEVICE || '/dev/sg2';
    this.mountPoint = process.env.TAPE_MOUNT_POINT || '/home/octro/tapedata1';
    this.tapeConfig = this.loadTapeConfig();
  }

  private loadTapeConfig(): TapeConfig {
    try {
      const configPath = path.join(process.cwd(), 'config.json');
      const configData = fsSync.readFileSync(configPath, 'utf-8');
      return JSON.parse(configData);
    } catch (error) {
      logger.error('Failed to load tape configuration:', error);
      throw new Error('Tape configuration not found or invalid');
    }
  }

  private async getCurrentTape(): Promise<string | null> {
    try {
      const { stdout } = await execAsync(`mtx -f ${this.tapeDevice} status`);
      const match = stdout.match(/VolumeTag = (\d+)/);
      return match ? match[1] : null;
    } catch (error) {
      logger.error('Failed to get current tape:', error);
      throw error;
    }
  }

  private async findEmptySlot(): Promise<number> {
    try {
      const { stdout } = await execAsync(`mtx -f ${this.tapeDevice} status`);
      const emptySlotMatch = stdout.match(/Storage Element (\d+):Empty/);
      if (!emptySlotMatch) {
        throw new Error('No empty slots available');
      }
      return parseInt(emptySlotMatch[1]);
    } catch (error) {
      logger.error('Failed to find empty slot:', error);
      throw error;
    }
  }

  private async findTapeSlot(tapeId: string): Promise<number> {
    try {
      const { stdout } = await execAsync(`mtx -f ${this.tapeDevice} status`);
      const regex = new RegExp(`Storage Element (\\d+):Full :VolumeTag=${tapeId}`);
      const match = stdout.match(regex);
      if (!match) {
        throw new Error(`Tape ${tapeId} not found in any slot`);
      }
      return parseInt(match[1]);
    } catch (error) {
      logger.error(`Failed to find tape ${tapeId}:`, error);
      throw error;
    }
  }

  private async waitForNoLtfsProcess(): Promise<void> {
    while (true) {
      try {
        const { stdout } = await execAsync('pidof ltfs');
        if (!stdout.trim()) break;
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        // pidof returns non-zero when no process is found
        break;
      }
    }
  }

  async ensureCorrectTape(groupName: string): Promise<string> {
    try {
      const groupTapes = this.tapeConfig[groupName];
      if (!groupTapes || groupTapes.length === 0) {
        throw new Error(`No tapes configured for group: ${groupName}`);
      }

      const currentTape = await this.getCurrentTape();
      if (currentTape && groupTapes.includes(currentTape)) {
        logger.info(`Correct tape ${currentTape} already loaded for group ${groupName}`);
        return currentTape;
      }

      // Unmount current tape if mounted
      try {
        await execAsync(`sudo umount ${this.mountPoint}`);
        await this.waitForNoLtfsProcess();
      } catch (error) {
        logger.warn('Failed to unmount or no mount point:', error);
      }

      // Unload current tape if exists
      if (currentTape) {
        const emptySlot = await this.findEmptySlot();
        await execAsync(`sudo mtx -f ${this.tapeDevice} unload ${emptySlot} 0`);
      }

      // Load first available group tape
      for (const tapeId of groupTapes) {
        try {
          const tapeSlot = await this.findTapeSlot(tapeId);
          await execAsync(`sudo mtx -f ${this.tapeDevice} load ${tapeSlot} 0`);
          logger.info(`Loaded tape ${tapeId} for group ${groupName}`);
          
          // Mount the tape
          await execAsync(`sudo ltfs -o devname=/dev/sg1 -o eject ${this.mountPoint}`);
          logger.info('Tape mounted successfully');
          
          return tapeId;
        } catch (error) {
          logger.warn(`Failed to load tape ${tapeId}, trying next...`, error);
        }
      }

      throw new Error(`No available tapes for group ${groupName}`);
    } catch (error) {
      logger.error('Failed to ensure correct tape:', error);
      throw error;
    }
  }

  async createTapePath(job: FileProcessingJob): Promise<string> {
    const requestedDate = new Date(job.requestedAt);
    const year = requestedDate.getFullYear().toString();
    const month = (requestedDate.getMonth() + 1).toString().padStart(2, '0');
    const day = requestedDate.getDate().toString().padStart(2, '0');

    const tapePath = path.join(
      this.mountPoint,
      job.groupName,
      job.userName,
      year,
      month,
      day
    );

    await fs.mkdir(tapePath, { recursive: true });
    return path.join(tapePath, job.fileName);
  }
} 