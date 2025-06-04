import { exec } from 'child_process';
import util from 'util';
const csvWriter = require('csv-writer').createObjectCsvWriter;

const execAsync = util.promisify(exec);

export interface TapeInfo {
  tape_no: string;
  total_size: string;
  used_size: string;
  available_size: string;
  usage_percentage: number;
  status: string;
}

export const generateTapeInfoCSV = async (tapeNo: string, mountPoint: string = '/home/octro/tapedata1') => {
  const { stdout } = await execAsync(`df -h ${mountPoint}`);
  const lines = stdout.trim().split('\n');
  // Find the line where the last column matches the mountPoint
  const dataLine = lines.find((line: string) => line.trim().endsWith(mountPoint));
  if (!dataLine) {
    throw new Error(`Mount point ${mountPoint} not found in df output`);
  }
  const data = dataLine.split(/\s+/);

  const filesystem = data[0];
  const totalSize = data[1];
  const usedSize = data[2];
  const availableSize = data[3];
  const usePercent = data[4];
  const usagePercentage = parseFloat(usePercent.replace('%', ''));

  const records: TapeInfo[] = [];

  records.push({
    tape_no: tapeNo,
    total_size: totalSize,
    used_size: usedSize,
    available_size: availableSize,
    usage_percentage: usagePercentage,
    status: 'active',
  });

  const outputCsvPath = `tape_info_${tapeNo}.csv`;
  const csv = csvWriter({
    path: outputCsvPath,
    header: [
      { id: 'tape_no', title: 'tape_no' },
      { id: 'total_size', title: 'total_size' },
      { id: 'used_size', title: 'used_size' },
      { id: 'available_size', title: 'available_size' },
      { id: 'usage_percentage', title: 'usage_percentage' },
      { id: 'status', title: 'status' },
    ],
  });

  await csv.writeRecords(records);
  console.log(`✅ CSV file Generated for ${tapeNo} tape info`);
}
