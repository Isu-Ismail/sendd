/**
 * Core protocol data structures for optical and QR transmission.
 * Strictly typed with ZERO `any`.
 */

export type TransmissionMode = 'text' | 'image' | 'qr_stream';
export type DeviceRole = 'sender' | 'receiver';

export type PacketState = 'pending' | 'transmitting' | 'acked' | 'missing' | 'failed';

export interface ChunkPacket {
  id: number;
  totalChunks: number;
  payload: string; // ASCII or hex-encoded slice
  payloadBytes: number[];
  checksum: number; // 4-bit XOR checksum
  endSequence: string; // "1111"
  bitStream: string; // Preamble + Id + Len + Payload + Checksum + EndSequence
  state: PacketState;
  retryCount: number;
}

export type AckStatus = 'ACK' | 'NACK' | 'MISSING' | 'DONE' | 'IDLE';

export interface AckMessage {
  status: AckStatus;
  chunkId: number;
  timestamp: number;
  raw: string;
}

export type SenderPhase = 
  | 'idle'
  | 'transmitting_chunk'
  | 'awaiting_ack'
  | 'chunk_acked'
  | 'compiling'
  | 'completed'
  | 'error';

export type ReceiverPhase = 
  | 'idle'
  | 'listening'
  | 'receiving_bits'
  | 'chunk_verified'
  | 'compiling'
  | 'completed';

export interface CompilationStep {
  label: string;
  detail: string;
  completed: boolean;
}

export interface ToastNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: number;
}

export interface ImagePixelData {
  width: number;
  height: number;
  palette: string[]; // 4 colors for 2-bit pixel packing
  pixels: number[]; // palette indices
}
