import * as crypto from 'crypto';

export function computeChecksum(content: string): string {
  return crypto.createHash('md5').update(content).digest('hex');
}

