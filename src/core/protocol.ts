import type { ChunkPacket, ImagePixelData } from '../types/protocol';

export const PREAMBLE = '101010'; // 6-bit clock sync and threshold alignment
export const END_SEQUENCE = '1111'; // 4-bit terminator delimiter

/**
 * Calculates a 4-bit XOR checksum across an array of byte values.
 */
export function calculateChecksum(bytes: number[]): number {
  let xor = 0;
  for (const b of bytes) {
    xor ^= b;
  }
  return (xor ^ (xor >> 4)) & 0x0f;
}

/**
 * Converts a number to a fixed-width binary string.
 */
export function toBin(value: number, width: number): string {
  const s = (value >>> 0).toString(2);
  if (s.length >= width) {
    return s.slice(-width);
  }
  return '0'.repeat(width - s.length) + s;
}

/**
 * Parses a binary string into an integer.
 */
export function fromBin(bin: string): number {
  return parseInt(bin, 2) || 0;
}

/**
 * Encodes a text string into an array of ChunkPacket objects.
 */
export function encodeTextToPackets(text: string, chunkSize = 2): ChunkPacket[] {
  const encoder = new TextEncoder();
  const rawBytes = Array.from(encoder.encode(text));
  const packets: ChunkPacket[] = [];
  
  const totalChunks = Math.max(1, Math.ceil(rawBytes.length / chunkSize));

  for (let i = 0; i < totalChunks; i++) {
    const chunkBytes = rawBytes.slice(i * chunkSize, (i + 1) * chunkSize);
    const chunkText = new TextDecoder().decode(new Uint8Array(chunkBytes));
    const checksum = calculateChecksum(chunkBytes);

    // Frame: PREAMBLE(6) + ID(6) + TOTAL(6) + LEN(4) + DATA(LEN*8) + CHECKSUM(4) + END_SEQ(4)
    let bitStream = PREAMBLE;
    bitStream += toBin(i, 6);
    bitStream += toBin(totalChunks, 6);
    bitStream += toBin(chunkBytes.length, 4);

    for (const b of chunkBytes) {
      bitStream += toBin(b, 8);
    }

    bitStream += toBin(checksum, 4);
    bitStream += END_SEQUENCE;

    packets.push({
      id: i,
      totalChunks,
      payload: chunkText,
      payloadBytes: chunkBytes,
      checksum,
      endSequence: END_SEQUENCE,
      bitStream,
      state: 'pending',
      retryCount: 0,
    });
  }

  return packets;
}

export interface DecodedPacketResult {
  chunkId: number;
  totalChunks: number;
  payload: string;
  payloadBytes: number[];
  valid: boolean;
  error?: string;
}

/**
 * Attempts to parse and validate a packet from a binary string buffer.
 */
export function parseBitStreamPacket(bitStream: string): DecodedPacketResult | null {
  const preambleIdx = bitStream.indexOf(PREAMBLE);
  if (preambleIdx === -1) {
    return null;
  }

  const slice = bitStream.slice(preambleIdx + PREAMBLE.length);
  // Minimum required length: ID(6) + TOTAL(6) + LEN(4) + at least 1 byte(8) + CHK(4) + END(4) = 32 bits
  if (slice.length < 32) {
    return null;
  }

  let offset = 0;
  const chunkId = fromBin(slice.slice(offset, offset + 6));
  offset += 6;

  const totalChunks = fromBin(slice.slice(offset, offset + 6));
  offset += 6;

  const byteLength = fromBin(slice.slice(offset, offset + 4));
  offset += 4;

  const requiredDataBits = byteLength * 8;
  if (slice.length < offset + requiredDataBits + 8) {
    return null; // Not enough bits yet
  }

  const payloadBytes: number[] = [];
  for (let b = 0; b < byteLength; b++) {
    const byteBits = slice.slice(offset, offset + 8);
    payloadBytes.push(fromBin(byteBits));
    offset += 8;
  }

  const checksumReceived = fromBin(slice.slice(offset, offset + 4));
  offset += 4;

  const endSeqReceived = slice.slice(offset, offset + 4);
  offset += 4;

  // Check end sequence delimiter
  if (endSeqReceived !== END_SEQUENCE) {
    return {
      chunkId,
      totalChunks,
      payload: '',
      payloadBytes,
      valid: false,
      error: `End sequence mismatch (expected ${END_SEQUENCE}, got ${endSeqReceived})`,
    };
  }

  // Verify checksum
  const expectedChecksum = calculateChecksum(payloadBytes);
  if (checksumReceived !== expectedChecksum) {
    return {
      chunkId,
      totalChunks,
      payload: '',
      payloadBytes,
      valid: false,
      error: `Checksum failure (expected ${expectedChecksum}, got ${checksumReceived})`,
    };
  }

  const payload = new TextDecoder().decode(new Uint8Array(payloadBytes));

  return {
    chunkId,
    totalChunks,
    payload,
    payloadBytes,
    valid: true,
  };
}

/**
 * Encodes mini pixel data into a string format for optical transmission.
 */
export function serializePixelData(data: ImagePixelData): string {
  // Format: "IMG:W,H:P0,P1,P2,P3:PIXEL_HEX_STREAM"
  const header = `IMG:${data.width},${data.height}:${data.palette.join(',')}:`;
  // Pack 4 pixels (each 2 bits) per byte
  const packedBytes: number[] = [];
  for (let i = 0; i < data.pixels.length; i += 4) {
    const p0 = (data.pixels[i] ?? 0) & 0x03;
    const p1 = (data.pixels[i + 1] ?? 0) & 0x03;
    const p2 = (data.pixels[i + 2] ?? 0) & 0x03;
    const p3 = (data.pixels[i + 3] ?? 0) & 0x03;
    packedBytes.push((p0 << 6) | (p1 << 4) | (p2 << 2) | p3);
  }
  const hex = packedBytes.map((b) => b.toString(16).padStart(2, '0')).join('');
  return header + hex;
}

/**
 * Deserializes an image string back into ImagePixelData.
 */
export function deserializePixelData(encoded: string): ImagePixelData | null {
  if (!encoded.startsWith('IMG:')) return null;
  const parts = encoded.slice(4).split(':');
  if (parts.length < 3) return null;

  const [dimPart, palettePart, hexData] = parts;
  const [wStr, hStr] = dimPart.split(',');
  const width = parseInt(wStr, 10);
  const height = parseInt(hStr, 10);
  const palette = palettePart.split(',');

  if (isNaN(width) || isNaN(height) || palette.length === 0) return null;

  const pixels: number[] = [];
  const totalPixels = width * height;

  for (let i = 0; i < hexData.length; i += 2) {
    const byte = parseInt(hexData.slice(i, i + 2), 16);
    if (isNaN(byte)) continue;
    pixels.push((byte >> 6) & 0x03);
    if (pixels.length >= totalPixels) break;
    pixels.push((byte >> 4) & 0x03);
    if (pixels.length >= totalPixels) break;
    pixels.push((byte >> 2) & 0x03);
    if (pixels.length >= totalPixels) break;
    pixels.push(byte & 0x03);
    if (pixels.length >= totalPixels) break;
  }

  return { width, height, palette, pixels };
}
