// This script is used to generate a CSV file that contains the details of the files on the tape.
// THis is goes into folders and fetch end file path, name and size.


const fs = require('fs');
const path = require('path');
const csvWriter = require('csv-writer').createObjectCsvWriter;

/**
 * Derives group name from tape number and file path using business logic.
 */
function getGroupName(tapeNumber: string, filePath: string) {
  const tapeGroupMap: Record<string, string[]> = {
    '000009': ['dgn_lts'],
    '000010': ['nfsdata'],
    '000011': ['dgn_lts', 'teenpatti', 'dgn_ovs', 'install_track'],
    '000004': ['dgn_ovs'],
    '000006': ['dgn_lts'],
    '000007': ['dgn_lts'],
  };

  const specialCases = (group: string) => {
    if (group === 'dgn') return 'dgn_lts';
    if (group === 'install_track') return 'install_track';
    if (group === 'dgn_apr_may_jun') return 'dgn_lts';
    if (group === 'dgn_lts') return 'dgn_lts';
    if (group === 'dgn_ovs') return 'dgn_ovs';
    if (group.startsWith('nfsdata')) return 'nfsdata';
    if (group.startsWith('teenpatti')) return 'teenpatti';
    return null;
  };

  const possibleGroups = tapeGroupMap[tapeNumber as keyof typeof tapeGroupMap] || [];

  for (let group of possibleGroups) {
    if (filePath.includes(group)) {
      const finalGroup = specialCases(group);
      if (finalGroup) return finalGroup;
      return group;
    }
  }

  // Try deeper matching if above fails (e.g., path contains dgn_apr_may_jun)
  const knownPatterns = [
    { keyword: 'dgn_apr_may_jun', mapped: 'dgn_lts' },
    { keyword: 'install_track', mapped: 'install_track' },
    { keyword: 'dgn', mapped: 'dgn_lts' },
    { keyword: 'nfsdata', mapped: 'nfsdata' },
    { keyword: 'teenpatti', mapped: 'teenpatti' },
  ];

  for (let { keyword, mapped } of knownPatterns) {
    if (filePath.includes(keyword)) return mapped;
  }

  return null; // Fallback if no match
}


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
/**
 * Recursively scans a directory and returns absolute file paths.
 */
function walkDir(dir: string, fileList: string[] = []) {
  const files = fs.readdirSync(dir);
  files.forEach((file: string) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walkDir(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  });
  return fileList;
}

/**
 * Generates upload_details-compatible CSV from a directory tree.
 * @param {string} tapeNumber - The tape number (e.g., "000011")
 * @param {string} basePath - Root directory to scan
 * @param {string} outputCsvPath - Path where CSV should be written
 */
export const generateFilesDetailsCSV = async (tapeNumber: string, basePath: string, outputCsvPath = 'upload_details.csv') => {
  if (!fs.existsSync(basePath)) {
    console.error(`Directory not found: ${basePath}`);
    return;
  }

  const files = walkDir(basePath);
  const records = [];

  for (let fullPath of files) {
    const fileName = path.basename(fullPath);
    const fileSize = fs.statSync(fullPath).size.toString();
    const groupName = getGroupName(tapeNumber, fullPath);

    records.push({
      user_name: 'ShivangGupta',
      group_name: groupName,
      file_name: fileName,
      file_size: formatFileSize(fileSize),
      status: 'completed',
      method: 'self',
      local_file_location: 'unknown', // or null
      tape_location: fullPath,
      tape_number: tapeNumber,
      iscached: false,
    });
  }

  const csv = csvWriter({
    path: outputCsvPath,
    header: [
      { id: 'user_name', title: 'user_name' },
      { id: 'group_name', title: 'group_name' },
      { id: 'file_name', title: 'file_name' },
      { id: 'file_size', title: 'file_size' },
      { id: 'status', title: 'status' },
      { id: 'method', title: 'method' },
      { id: 'local_file_location', title: 'local_file_location' },
      { id: 'tape_location', title: 'tape_location' },
      { id: 'tape_number', title: 'tape_number' },
      { id: 'iscached', title: 'iscached' },
    ],
  });

  await csv.writeRecords(records);
  console.log(`✅ CSV file written to ${outputCsvPath} with ${records.length} entries.`);
}


