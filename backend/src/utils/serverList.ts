import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import csv from 'csv-parse/sync'; // Make sure you're using the 'sync' version
//  // Adjust loging based on your project structure

interface ServerRecord {
  group: string;
  server_name: string;
  private_ip: string;
}

export const getServerList = async (): Promise<ServerRecord[]> => {
  try {
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const apiKey = process.env.GOOGLE_API_KEY;

    if (!sheetId || !apiKey) {
      throw new Error('GOOGLE_SHEET_ID or GOOGLE_API_KEY environment variables not set');
    }

    const sheets = google.sheets({ version: 'v4' });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'A:C', // Assuming the sheet has columns A, B, and C for group, server_name, and private_ip
      key: apiKey,
    });
    console.log('Successfully fetched server list from Google Sheets');

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      throw new Error('No data found in Google Sheet');
    }

    const records = rows.slice(1).map(row => ({
      group: row[0],
      server_name: row[1],
      private_ip: row[2]
    })) as ServerRecord[];

    return records;

  } catch (error) {
    console.error('Error fetching server list from Google Sheets, falling back to CSV:', error);

    // Fallback to reading local CSV
    const csvPath = process.env.SERVER_LIST_CSV || path.join(__dirname, '../../IP-Address-Allocation.csv');
    const fileContent = fs.readFileSync(csvPath, 'utf8');

    const records = csv.parse(fileContent, {
      columns: true,
      skip_empty_lines: true
    }) as ServerRecord[];

    console.log('Successfully loaded server list from local CSV fallback');

    return records;
  }
};
