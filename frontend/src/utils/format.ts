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

// function to convert file size (string) to bytes
export const convertFileSizeToBytes = (fileSize: string): number => {
  const unitsmap = {
    'B': 1,
    'KB': 1024,
    'MB': 1024 * 1024,
    'GB': 1024 * 1024 * 1024,
    'TB': 1024 * 1024 * 1024 * 1024
  }
  const unit = fileSize.match(/[A-Z]+$/)?.[0];
  const size = parseFloat(fileSize);
  return size * unitsmap[unit as keyof typeof unitsmap];
};