import fs from 'fs';
import path from 'path';

const LOG_PATH = path.join(process.cwd(), 'data', 'generation-log.jsonl');

export function logGeneration(entry) {
  try {
    fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
    const line = JSON.stringify({ ...entry, timestamp: new Date().toISOString() });
    fs.appendFileSync(LOG_PATH, line + '\n');
  } catch (e) {
    // Logging failure should never break the actual request.
    console.error('Failed to write generation log:', e.message);
  }
}
