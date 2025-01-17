import zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export async function compressData(data: any): Promise<Buffer> {
  const jsonString = JSON.stringify(data);
  return await gzip(jsonString);
}

export async function decompressData(buffer: Buffer): Promise<any> {
  const decompressed = await gunzip(buffer);
  return JSON.parse(decompressed.toString());
}
