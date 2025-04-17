import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

interface EmailOptions {
  tapeLocation?: string;
  tapeNumber?: string;
  errorMessage?: string;
  requestedAt?: number;
}

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      }
    });
  }

  async sendFileProcessedEmail(
    to: string,
    fileName: string,
    status: 'success' | 'failed',
    options?: EmailOptions
  ): Promise<void> {
    try {
      const subject = status === 'success' 
        ? `File Successfully Archived to Tape - ${fileName}`
        : `File Archive Failed - ${fileName}`;

      const message = status === 'success'
        ? `Your file "${fileName}" has been successfully archived to tape.\n\n` +
          `Tape Location: ${options?.tapeLocation}\n` +
          `Tape Number: ${options?.tapeNumber}`
        : `Failed to archive your file "${fileName}" to tape.\n\n` +
          `Error: ${options?.errorMessage || 'Unknown error'}` +
          `\n\nPlease try again or contact admin if the problem persists.` +
          `Admin Email: ${process.env.ADMIN_EMAIL}`;

      await this.transporter.sendMail({
        from: process.env.SMTP_FROM,
        to,
        subject,
        text: message
      });

      logger.info(`Sent ${status} email notification to ${to}`);
    } catch (error) {
      logger.error('Failed to send email notification:', error);
      // Don't throw the error as email failure shouldn't stop the process
    }
  }
} 