/**
 * Hardware, camera stream, and optical signal metric types.
 * Strictly typed with ZERO `any`.
 */

export interface OpticalSample {
  timestamp: number;
  luminance: number; // 0 - 255
  threshold: number; // 0 - 255 adaptive baseline
  bit: 0 | 1;
}

export interface CalibrationMetrics {
  minLuminance: number;
  maxLuminance: number;
  currentThreshold: number;
  noiseLevel: number;
  sampleCount: number;
}

export interface TorchCapabilities {
  supported: boolean;
  active: boolean;
  method: 'hardware_torch' | 'screen_strobe' | 'none';
  errorDetails?: string;
}

export interface CameraDeviceOption {
  deviceId: string;
  label: string;
  facingMode: 'user' | 'environment' | 'unknown';
}
