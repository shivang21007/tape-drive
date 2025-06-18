// src/sshCheck.ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import shellEscape from "shell-escape";
import { getPrivateIp } from "../services/getPrivateIP";
// Promisify once for clean async/await use
const execFileP = promisify(execFile);

export interface SSHCheckSuccess {
  success: true;
  code: number;
}

export interface SSHCheckFailure {
  success: false;
  code: number;           // remote exit‑status OR ssh error code
  stderr: string;
  errMsg: string;
}

export type SSHCheckResult = SSHCheckSuccess | SSHCheckFailure;

/**
 * Validate basic hostname / username rules to catch obvious abuse
 * Allows letters, digits, dot, dash, underscore only.
 */
function validateSimpleToken(token: string, label: string): void {
  if (!/^[A-Za-z0-9._-]+$/.test(token))
    throw new Error(`${label} contains illegal characters`);
}

/**
 * Does the remote 'username@host' have read permission on remotePath?
 *
 * Resolves true on success (code 0), otherwise returns detailed failure info.
 */
export async function checkSSHReadAccess(
  host: string,
  user: string,
  remotePath: string
): Promise<SSHCheckResult> {
  validateSimpleToken(host, "Host");
  validateSimpleToken(user, "Username");


  // Always quote the path for the REMOTE shell, not the local one.
  const escapedPath = shellEscape([remotePath]);
  const privateIp = await getPrivateIp(host);
  const serverName = process.env.SERVER_NAME || 'serv19.octro.net';
  const serverIp = process.env.SERVER_IP || '192.168.111.19';

  if (host === serverName || privateIp === serverIp) {
    const testArgs = ['-r', remotePath];
    try {
      const { stdout, stderr } = await execFileP('test', testArgs);
      return { success: true, code: 0 };
    }catch(err: any){
      return {
        success: false, code: 1, stderr: `Connected, but File Path permission denied or not accessible by user ${user}.`,
      errMsg: `Connected, but File Path permission denied or not accessible by user ${user}.`};
    }
  }

  // Build argv array – no chance for local shell injection
  const sshArgs = [
    "-o", "BatchMode=yes",          // fail fast if auth needs a prompt
    "-o", "ConnectTimeout=5",       // network timeout (seconds)
    `${user}@${privateIp}`,
    `test -r ${escapedPath}`
  ];

  try {
    const { stdout, stderr } = await execFileP("ssh", sshArgs);
    // If we get here without throw, exit‑code == 0
    return { success: true, code: 0 };
  } catch (err: any) {
    // execFile throws an Error object with these extra fields

    const code   = err.code as number; // 1, 255, etc.
    let stderr = err.stderr as string ?? "";

    if(code === 255){
      return { success: false, code: code, stderr: stderr, errMsg: "SSH connection/authentication failed. Please check host/credentials." };
    }else if(code === 1){
      stderr = `Connected, but File Path permission denied or not accessible by user ${user}.`
      return { success: false, code: code, stderr: stderr, errMsg: `Connected, but File Path permission denied or not accessible by user ${user}.`};
    }else{
      return { success: false, code: code, stderr: stderr, errMsg: "Unknown error (exit code ${code})." };
    }
  }
}
