import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { FileProcessingJob } from '../types/fileProcessing';
import { DatabaseService } from '../services/databaseService';
import dotenv from 'dotenv';

dotenv.config();

const execAsync = promisify(exec);
const databaseService = DatabaseService.getInstance();

export class TapeManager {
  private currentTape: string | null = null;
  public mountPoint: string;
  private tapeDevice: string;

  private readonly sizeMultipliers: { [key: string]: number } = {
    'TB': 1024 * 1024 * 1024 * 1024,
    'T': 1024 * 1024 * 1024 * 1024,
    'GB': 1024 * 1024 * 1024,
    'G': 1024 * 1024 * 1024,
    'MB': 1024 * 1024,
    'M': 1024 * 1024,
    'KB': 1024,
    'K': 1024,
    'B': 1
  };

  constructor() {
    this.tapeDevice = process.env.TAPE_DEVICE || '/dev/sg2';
    this.mountPoint = process.env.TAPE_MOUNT_POINT || '/home/octro/tapedata1';
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

  public async ensureCorrectTape(tapeNumber: string): Promise<string> {
    try {
      // Get current tape number
      const currentTape = await this.getCurrentTape();
      logger.info(`Current tape: ${currentTape}, Required tape: ${tapeNumber}`);

      // If no tape is loaded or current tape doesn't match required tape
      if (!currentTape || currentTape !== tapeNumber) {
        logger.info(`Switching to tape ${tapeNumber}`);
        
        // If a tape is currently loaded, unmount and unload it
        if (currentTape) {
          await this.unmountTape();
          await this.unloadTape();
        }

        // Load and mount the required tape
        await this.loadTape(tapeNumber);
        await this.mountTape();
        
        // Verify the tape is loaded and mounted
        const newTape = await this.getCurrentTape();
        if (newTape !== tapeNumber) {
          throw new Error(`Failed to load tape ${tapeNumber}`);
        }
        
        const isMounted = await this.isTapeMounted();
        if (!isMounted) {
          throw new Error(`Failed to mount tape ${tapeNumber}`);
        }
        
        logger.info(`Successfully switched to tape ${tapeNumber}`);
        return tapeNumber;
      }

      // If current tape matches required tape, just ensure it's mounted
      if (!await this.isTapeMounted()) {
        logger.info(`Tape ${tapeNumber} is not mounted, mounting it`);
        await this.mountTape();
      }

      return tapeNumber;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to ensure correct tape: ${errorMessage}`);
      throw error;
    }
  }

  public async getTapeGroup(tapeNumber: string): Promise<string | null> {
    try {
      const tapeInfo = await databaseService.getTapeInfo(tapeNumber);
      return tapeInfo ? tapeInfo.group_name : null;
    } catch (error) {
      logger.error(`Failed to get tape group for tape ${tapeNumber}:`, error);
      return null;
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

  private parseDfOutput(output: string) {
    const lines = output.trim().split('\n');
    if (lines.length < 2) return null;

    const data = lines[1].split(/\s+/);
    return {
      totalSize: data[1],
      usedSize: data[2],
      availableSize: data[3],
      usagePercentage: parseFloat(data[4].replace('%', ''))
    };
  }

  public async updateTapeInfo(tapeNumber: string, databaseService: DatabaseService): Promise<void> {
    try {
      // Execute df -h command
      const { stdout } = await execAsync(`df -h ${this.mountPoint}`);
      const tapeInfo = this.parseDfOutput(stdout);

      if (!tapeInfo) {
        throw new Error('Failed to parse df output');
      }

      // Update tape_info table
      await databaseService.updateTapeInfo(
        tapeNumber,
        tapeInfo.totalSize,
        tapeInfo.usedSize,
        tapeInfo.availableSize,
        tapeInfo.usagePercentage
      );

      logger.info(`Updated tape info for tape ${tapeNumber}:`, tapeInfo);
    } catch (error) {
      logger.error(`Failed to update tape info for tape ${tapeNumber}:`, error);
      // don't throw error here, just log it
    }
  }

  public async checkGroupTapeSpace(groupName: string, requiredSize: number): Promise<{ 
    hasSpace: boolean; 
    tapeNumber?: string; 
    errorMessage?: string;
    tapeDetails?: Array<{ tapeNumber: string; availableSize: string }>;
  }> {
    try {
      // Get tapes for the group from database, ordered by usage percentage
      const groupTapes = await databaseService.getGroupTapes(groupName);
      if (!groupTapes || groupTapes.length === 0) {
        return {
          hasSpace: false,
          errorMessage: `No tapes configured for group ${groupName}`,
          tapeDetails: []
        };
      }

      const tapeDetails: Array<{ tapeNumber: string; availableSize: string }> = [];
      let selectedTape: string | undefined;

      // Check each tape in the group
      for (const tapeNumber of groupTapes) {
        try {
          // Get tape info from database
          const tapeInfo = await databaseService.getTapeInfo(tapeNumber);
          if (!tapeInfo) {
            logger.warn(`Tape info not found for tape ${tapeNumber}`);
            continue;
          }

          // Parse available size (e.g., "11T" -> bytes)
          const availableSize = this.parseSizeToBytes(tapeInfo.available_size);
          
          // Store tape details for reporting
          tapeDetails.push({
            tapeNumber,
            availableSize: tapeInfo.available_size
          });

          // If this tape has enough space and we haven't selected a tape yet
          if (availableSize >= requiredSize && !selectedTape) {
            selectedTape = tapeNumber;
            logger.info(`Found tape ${tapeNumber} with sufficient space (${tapeInfo.available_size})`);
            break; // Stop after finding first tape with space
          }
        } catch (error) {
          logger.error(`Error checking tape ${tapeNumber}:`, error);
          continue;
        }
      }

      if (selectedTape) {
        return {
          hasSpace: true,
          tapeNumber: selectedTape,
          tapeDetails
        };
      }

      // If we get here, no tape had enough space
      return {
        hasSpace: false,
        errorMessage: `No tapes in group ${groupName} have enough space for file (${this.formatBytes(requiredSize)})`,
        tapeDetails
      };
    } catch (error) {
      logger.error(`Error checking group tape space:`, error);
      return {
        hasSpace: false,
        errorMessage: `Error checking tape space: ${error instanceof Error ? error.message : 'Unknown error'}`,
        tapeDetails: []
      };
    }
  }

  private parseSizeToBytes(sizeStr: string): number {
    const match = sizeStr.match(/^(\d+\.?\d*)\s*(B|KB|K|MB|M|GB|G|TB|T)$/i);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    
    return value * (this.sizeMultipliers[unit] || 0);
  }

  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
} 