import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contractDirectory = path.resolve(__dirname, '..', 'blind-bazaar-contract');
const RESULT_PREFIX = 'BLIND_BAZAAR_RESULT=';

function runVerifier(input, onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    const starting = { stage: 'starting', message: 'Starting Midnight verifier…' };
    console.log(`[Midnight] ${starting.message}`);
    onProgress(starting);
    const child = spawn(process.execPath, ['--import', 'tsx', 'src/verify-deal.ts', JSON.stringify(input)], {
      cwd: contractDirectory,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    let errors = '';
    let pendingLine = '';
    const readLine = (line) => {
      if (!line.startsWith('BLIND_BAZAAR_PROGRESS=')) return;
      try {
        const progress = JSON.parse(line.slice('BLIND_BAZAAR_PROGRESS='.length));
        console.log(`[Midnight] ${progress.message}`);
        onProgress(progress);
      } catch {
        // Progress output is non-critical; the final verifier result remains authoritative.
      }
    };
    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      output += text;
      const lines = `${pendingLine}${text}`.split(/\r?\n/);
      pendingLine = lines.pop();
      lines.forEach(readLine);
    });
    child.stderr.on('data', (chunk) => { errors += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (pendingLine) readLine(pendingLine);
      const resultLine = output.split(/\r?\n/).find((line) => line.startsWith(RESULT_PREFIX));
      if (code === 0 && resultLine) {
        try {
          resolve(JSON.parse(resultLine.slice(RESULT_PREFIX.length)));
        } catch (error) {
          reject(new Error(`Midnight verifier returned invalid JSON: ${error.message}`));
        }
        return;
      }
      reject(new Error(`Midnight verification failed (exit ${code}): ${errors || output}`));
    });
  });
}

export function getCredentialProof(agentId) {
  // The contract's credential circuit remains the explicitly requested
  // non-empty-placeholder check. This is an opaque stable 32-byte value.
  return createHash('sha256').update(`blind-bazaar-credential:${agentId}`).digest('hex');
}

export async function submitDealForVerification(input, onProgress) {
  return runVerifier(input, onProgress);
}
