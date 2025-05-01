import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';
import { tapeLogger } from '../utils/tapeLogger';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export class AdminNotificationService {
  private transporter: nodemailer.Transporter;
  private adminEmail: string;

  constructor() {
    this.adminEmail = process.env.ADMIN_EMAIL || '';
    if (!this.adminEmail) {
      throw new Error('ADMIN_EMAIL environment variable is required');
    }

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

  async sendCriticalError(
    operation: string,
    error: Error,
    jobDetails?: any
  ): Promise<void> {
    try {
      const subject = `CRITICAL: Tape Operation Failed - ${operation}`;

      const message = `
Critical error in tape operation: ${operation}

Error Details:
${error.message}

Stack Trace:
${error.stack}

Job Details:
${JSON.stringify(jobDetails, null, 2)}

This is a critical error that requires immediate attention.
The worker service has been halted to prevent further issues.
      `;

      await this.transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: this.adminEmail,
        subject,
        text: message
      });

      logger.error(`Sent critical error notification to admin for operation: ${operation}`);
      tapeLogger.logError(operation, error);
    } catch (error) {
      logger.error('Failed to send admin notification:', error);
      // Still throw the error to ensure the worker stops
      throw error;
    }
  }

  async sendRepeatedFailureAlert(
    operation: string,
    failureCount: number,
    lastError: Error
  ): Promise<void> {
    try {
      const subject = `ALERT: Repeated Tape Operation Failures - ${operation}`;

      const message = `
Repeated failures detected in tape operation: ${operation}

Failure Count: ${failureCount}

Last Error:
${lastError.message}

Stack Trace:
${lastError.stack}

This operation has failed multiple times and requires investigation.
      `;

      await this.transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: this.adminEmail,
        subject,
        text: message
      });

      logger.warn(`Sent repeated failure alert to admin for operation: ${operation}`);
    } catch (error) {
      logger.error('Failed to send repeated failure alert:', error);
    }
  }

  async sendSecureCopyUploadCriticalError(
    operation: string,
    error: Error,
    details: {
      type: string;
      fileId: number;
      fileName: string;
      server: string;
      filePath: string;
      userName: string;
      userEmail: string;
      requestedAt: number;
    }
  ) {
    const subject = `[CRITICAL] Secure Copy Upload Failed - ${details.fileName}`;
    const content = `
      <h2>Secure Copy Upload Operation Failed</h2>
      <p><strong>Operation:</strong> ${operation}</p>
      <p><strong>Error:</strong> ${error.message}</p>
      <h3>Details:</h3>
      <ul>
        <li><strong>Type:</strong> ${details.type}</li>
        <li><strong>File ID:</strong> ${details.fileId}</li>
        <li><strong>File Name:</strong> ${details.fileName}</li>
        <li><strong>Server:</strong> ${details.server}</li>
        <li><strong>File Path:</strong> ${details.filePath}</li>
        <li><strong>User:</strong> ${details.userName} (${details.userEmail})</li>
        <li><strong>Requested At:</strong> ${new Date(details.requestedAt).toLocaleString()}</li>
      </ul>
      <p>Please investigate this issue immediately.</p>
    `;

    await this.sendEmail(subject, content);
  }

  async sendSecureCopyDownloadCriticalError(
    operation: string,
    error: Error,
    details: {
      type: string;
      downloadRequestId: number;
      fileName: string;
      server: string;
      filePath: string;
      userName: string;
      userEmail: string;
      requestedAt: number;
    }
  ) {
    const subject = `[CRITICAL] Secure Copy Download Failed - ${details.fileName}`;
    const content = `
      <h2>Secure Copy Download Operation Failed</h2>
      <p><strong>Operation:</strong> ${operation}</p>
      <p><strong>Error:</strong> ${error.message}</p>
      <h3>Details:</h3>
      <ul>
        <li><strong>Type:</strong> ${details.type}</li>
        <li><strong>Download Request ID:</strong> ${details.downloadRequestId}</li>
        <li><strong>File Name:</strong> ${details.fileName}</li>
        <li><strong>Server:</strong> ${details.server}</li>
        <li><strong>File Path:</strong> ${details.filePath}</li>
        <li><strong>User:</strong> ${details.userName} (${details.userEmail})</li>
        <li><strong>Requested At:</strong> ${new Date(details.requestedAt).toLocaleString()}</li>
      </ul>
      <p>Please investigate this issue immediately.</p>
    `;

    await this.sendEmail(subject, content);
  }

  private async sendEmail(subject: string, content: string) {
    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: this.adminEmail,
        subject,
        html: content
      });

      logger.info(`Sent admin notification for subject: ${subject}`);
    } catch (error) {
      logger.error('Failed to send admin notification:', error);
    }
  }
} 