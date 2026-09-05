import type { OpticalSample, CalibrationMetrics } from '../types/optical';

export class OpticalReceiverEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private videoElement: HTMLVideoElement | null = null;
  private animationFrameId: number | null = null;

  // Calibration and threshold tracking
  private minLuminance = 255;
  private maxLuminance = 0;
  private currentThreshold = 128;
  private recentSamples: number[] = [];
  private sampleHistory: OpticalSample[] = [];
  private maxHistoryLength = 80;

  // Pulse & Bit Demodulation
  private symbolDurationMs = 180; // duration per optical bit
  private currentBitState: 0 | 1 = 0;
  private bitHoldStartMs = 0;
  private rawBitBuffer = '';

  // Callbacks
  private onSampleCallback: ((sample: OpticalSample, metrics: CalibrationMetrics) => void) | null = null;
  private onBitCallback: ((bit: 0 | 1, currentStream: string) => void) | null = null;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 64;
    this.canvas.height = 64;
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      throw new Error('Could not create 2D canvas context for optical processing');
    }
    this.ctx = ctx;
  }

  public setSymbolDuration(ms: number): void {
    this.symbolDurationMs = Math.max(80, Math.min(600, ms));
  }

  public setCallbacks(
    onSample: (sample: OpticalSample, metrics: CalibrationMetrics) => void,
    onBit: (bit: 0 | 1, currentStream: string) => void
  ): void {
    this.onSampleCallback = onSample;
    this.onBitCallback = onBit;
  }

  public start(video: HTMLVideoElement): void {
    this.videoElement = video;
    this.rawBitBuffer = '';
    this.sampleHistory = [];
    this.minLuminance = 255;
    this.maxLuminance = 0;
    this.currentThreshold = 128;
    this.bitHoldStartMs = performance.now();

    const loop = (): void => {
      this.processCurrentFrame();
      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  public stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.videoElement = null;
  }

  public clearBuffer(): void {
    this.rawBitBuffer = '';
  }

  public getRawBuffer(): string {
    return this.rawBitBuffer;
  }

  private processCurrentFrame(): void {
    if (!this.videoElement || this.videoElement.readyState < 2) {
      return;
    }

    const now = performance.now();
    const vw = this.videoElement.videoWidth || 640;
    const vh = this.videoElement.videoHeight || 480;

    // Sample center 25% box (Region of Interest)
    const roiSize = Math.min(vw, vh) * 0.35;
    const sx = (vw - roiSize) / 2;
    const sy = (vh - roiSize) / 2;

    this.ctx.drawImage(
      this.videoElement,
      sx, sy, roiSize, roiSize,
      0, 0, this.canvas.width, this.canvas.height
    );

    const imgData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const data = imgData.data;

    let totalLuminance = 0;
    const pixelCount = data.length / 4;

    for (let i = 0; i < data.length; i += 4) {
      // Perceived luminance formula (ITU-R BT.601)
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      totalLuminance += lum;
    }

    const avgLuminance = totalLuminance / pixelCount;

    // Dynamic Calibration with exponential moving window
    this.recentSamples.push(avgLuminance);
    if (this.recentSamples.length > 90) {
      this.recentSamples.shift();
    }

    let min = 255;
    let max = 0;
    for (const s of this.recentSamples) {
      if (s < min) min = s;
      if (s > max) max = s;
    }

    this.minLuminance = min;
    this.maxLuminance = max;

    const dynamicRange = max - min;
    // Set threshold halfway with a minimum dynamic range threshold of 18
    if (dynamicRange > 18) {
      this.currentThreshold = min + dynamicRange * 0.52;
    }

    // Determine current bit with small hysteresis
    const hysteresis = Math.max(3, dynamicRange * 0.08);
    let sampleBit: 0 | 1 = this.currentBitState;

    if (avgLuminance > this.currentThreshold + hysteresis) {
      sampleBit = 1;
    } else if (avgLuminance < this.currentThreshold - hysteresis) {
      sampleBit = 0;
    }

    const sample: OpticalSample = {
      timestamp: now,
      luminance: Math.round(avgLuminance),
      threshold: Math.round(this.currentThreshold),
      bit: sampleBit,
    };

    this.sampleHistory.push(sample);
    if (this.sampleHistory.length > this.maxHistoryLength) {
      this.sampleHistory.shift();
    }

    const metrics: CalibrationMetrics = {
      minLuminance: Math.round(min),
      maxLuminance: Math.round(max),
      currentThreshold: Math.round(this.currentThreshold),
      noiseLevel: Math.round(dynamicRange),
      sampleCount: this.recentSamples.length,
    };

    if (this.onSampleCallback) {
      this.onSampleCallback(sample, metrics);
    }

    // Demodulation: Sample bit every symbolDurationMs
    if (now - this.bitHoldStartMs >= this.symbolDurationMs) {
      this.bitHoldStartMs = now;
      this.currentBitState = sampleBit;
      this.rawBitBuffer += sampleBit.toString();

      // Prevent runaway bit buffer size
      if (this.rawBitBuffer.length > 400) {
        this.rawBitBuffer = this.rawBitBuffer.slice(-200);
      }

      if (this.onBitCallback) {
        this.onBitCallback(sampleBit, this.rawBitBuffer);
      }
    }
  }
}
