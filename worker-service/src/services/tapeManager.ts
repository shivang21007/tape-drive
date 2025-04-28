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
  private currentTape: string | null = null;
  public mountPoint: string;
  private tapeConfig: TapeConfig;
  private tapeDevice: string;

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

  public async getCurrentTape(): Promise<string | null> {
    try {
      const { stdout } = await execAsync(`mtx -f ${this.tapeDevice} status`);
      const currentTapeMatch = stdout.match(/Data Transfer Element 0:Full.*VolumeTag = (\d+)/);
      if (currentTapeMatch) {
        this.currentTape = currentTapeMatch[1];
        return this.currentTape;
      }
      this.currentTape = null;
      return null;
    } catch (error) {
      logger.error('Failed to get current tape:', error);
      throw error;
    }
  }

  private async waitForUnmount(): Promise<void> {
    let attempts = 0;
    const maxAttempts = 10;
    const delay = 5000; // 5 seconds

    while (attempts < maxAttempts) {
      try {
        await execAsync(`sudo umount ${this.mountPoint}`);
        logger.info('Successfully unmounted tape');
        return;
      } catch (error) {
        if (error instanceof Error && error.message.includes('target is busy')) {
          attempts++;
          if (attempts >= maxAttempts) {
            logger.error('Failed to unmount tape after multiple attempts');
            throw new Error('Tape is busy and could not be unmounted');
          }
          logger.warn(`Tape is busy, waiting ${delay/1000} seconds before retry (attempt ${attempts}/${maxAttempts})`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw error;
        }
      }
    }
  }

  public async unmountTape(): Promise<void> {
    try {
      // Check if tape is mounted
      if (!await this.isTapeMounted()) {
        logger.info('Tape is not mounted');
        return;
      }

      // Unmount the tape with retries for busy target
      logger.info('Unmounting tape...');
      await this.waitForUnmount();

      // Wait for LTFS process to terminate
      await this.waitForNoLtfsProcess();

      // check isTapeMounted
      if (await this.isTapeMounted()) {
        throw new Error('Tape is still mounted after unmounting .......');
      }
    
      logger.info('Tape unmounted successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to unmount tape: ${errorMessage}`);
      throw error;
    }
  }

  // private async executeTapeCommand(command: string, retryCount = 3): Promise<void> {
  //   let attempts = 0;
  //   const delay = 5000; // 5 seconds

  //   while (attempts < retryCount) {
  //     try {
  //       await execAsync(command);
  //       return;
  //     } catch (error) {
  //       attempts++;
  //       if (attempts >= retryCount) {
  //         logger.error(`Failed to execute tape command after ${retryCount} attempts: ${command}`);
  //         throw error;
  //       }
  //       logger.warn(`Tape command failed, retrying in ${delay/1000} seconds (attempt ${attempts}/${retryCount})`);
  //       await new Promise(resolve => setTimeout(resolve, delay));
  //     }
  //   }
  // }

  public async loadTape(tapeNumber: string): Promise<void> {
    try {
      // Verify tape is configured for a group
      const tapeGroup = await this.getTapeGroup(tapeNumber);
      if (!tapeGroup) {
        throw new Error(`Tape ${tapeNumber} is not configured for any group`);
      }

      // Find tape slot
      const tapeSlot = await this.findTapeSlot(tapeNumber);
      logger.info(`Loading tape ${tapeNumber} from slot ${tapeSlot}...`);
      
      // Load the tape
      await execAsync(`sudo mtx -f ${this.tapeDevice} load ${tapeSlot} 0`);
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for load
      
      // Verify tape is loaded
      const { stdout } = await execAsync(`mtx -f ${this.tapeDevice} status`);
      if (!stdout.includes(`Data Transfer Element 0:Full (Storage Element ${tapeSlot} Loaded):VolumeTag = ${tapeNumber}`)) {
        throw new Error(`Failed to verify tape ${tapeNumber} is loaded`);
      }
      
      this.currentTape = tapeNumber;
      logger.info(`Loaded tape ${tapeNumber} from slot ${tapeSlot}`);
    } catch (error) {
      logger.error(`Failed to load tape ${tapeNumber}:`, error);
      throw error;
    }
  }

  public async unloadTape(): Promise<void> {
    try {
      // Find empty slot
      const emptySlot = await this.findEmptySlot();
      logger.info(`Unloading tape to slot ${emptySlot}...`);
      
      // Unload the tape
      await execAsync(`sudo mtx -f ${this.tapeDevice} unload ${emptySlot} 0`);
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for unload
      
      logger.info(`Tape unloaded to slot ${emptySlot}`);
    } catch (error) {
      logger.error('Failed to unload tape:', error);
      throw error;
    }
  }

  public async mountTape(): Promise<void> {
    try {
      // Check if tape is already mounted
      if (await this.isTapeMounted()) {
        logger.info('Tape is already mounted');
        return;
      }

      // Check if mount point exists
      if (!fsSync.existsSync(this.mountPoint)) {
        await fs.mkdir(this.mountPoint, { recursive: true });
        logger.info(`Created mount point directory: ${this.mountPoint}`);
      }

      // Mount the tape
      logger.info('Mounting tape...');
      try {
        // Run LTFS mount command
        await execAsync(`sudo ltfs -o devname=/dev/sg1 -o eject ${this.mountPoint}`);
      } catch (error) {
        // LTFS command might return error even if mount is successful
        logger.warn('LTFS mount command returned error, checking if mount was successful...');
      }

      // Wait for mount to complete
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Verify mount was successful by checking mount point
      const { stdout } = await execAsync(`mount | grep ltfs`);
      if (!stdout.includes(this.mountPoint)) {
        throw new Error('Tape mount verification failed');
      }

      logger.info('Tape mounted successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to mount tape: ${errorMessage}`);
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
        if (!stdout.trim()) {
          logger.info('LTFS process terminated');
          return;
        }
        logger.info('Waiting for LTFS process to terminate...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      } catch (error) {
        // pidof returns non-zero when no process is found
        logger.info('LTFS process terminated');
        return;
      }
    }
  }

  public async isTapeMounted(): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`mount | grep ${this.mountPoint}`);
      return stdout.includes(this.mountPoint);
    } catch (error) {
      // If the command fails, it means the mount point is not mounted
      return false;
    }
  }

  public async ensureCorrectTape(groupName: string): Promise<string> {
    try {
      // Get current tape number
      const currentTape = await this.getCurrentTape();
      if (!currentTape) {
        throw new Error('Failed to get current tape number');
      }

      // Check if current tape matches group
      const tapeGroup = await this.getTapeGroup(currentTape);
      if (tapeGroup !== groupName) {
        logger.info(`Current tape (${currentTape}) does not match required group (${groupName})`);
        
        // Get the first configured tape for the group
        const groupTapes = this.tapeConfig[groupName];
        if (!groupTapes || groupTapes.length === 0) {
          throw new Error(`No tapes configured for group ${groupName}`);
        }
        
        // Follow exact tape switching workflow
        await this.unmountTape();
        await this.unloadTape();
        await this.loadTape(groupTapes[0]);
        await this.mountTape();
        
        // Verify new tape is loaded
        const newTape = await this.getCurrentTape();
        if (!newTape) {
          throw new Error('Failed to get new tape number after loading');
        }
        return newTape;
      }

      return currentTape;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to ensure correct tape: ${errorMessage}`);
      throw error;
    }
  }

  public async getTapeGroup(tapeNumber: string): Promise<string | null> {
    for (const [group, tapes] of Object.entries(this.tapeConfig)) {
      if (tapes.includes(tapeNumber)) {
        return group;
      }
    }
    return null;
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