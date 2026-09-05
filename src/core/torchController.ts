import type { TorchCapabilities } from '../types/optical';

export class TorchTransmitterController {
  private mediaStream: MediaStream | null = null;
  private videoTrack: MediaStreamTrack | null = null;
  private capabilities: TorchCapabilities = {
    supported: false,
    active: false,
    method: 'none',
  };

  // Fallback screen strobe callback
  private onScreenStrobeChange: ((isOn: boolean) => void) | null = null;

  public setScreenStrobeCallback(cb: (isOn: boolean) => void): void {
    this.onScreenStrobeChange = cb;
  }

  /**
   * Initializes hardware camera torch access.
   */
  public async initializeTorch(): Promise<TorchCapabilities> {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera MediaDevices API unavailable');
      }

      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Rear camera for flashlight
        },
      });

      this.videoTrack = this.mediaStream.getVideoTracks()[0] ?? null;

      if (!this.videoTrack) {
        throw new Error('No video track found');
      }

      // Check for torch capability
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const capabilities = (this.videoTrack.getCapabilities ? this.videoTrack.getCapabilities() : {}) as Record<string, unknown>;

      if ('torch' in capabilities && Boolean(capabilities['torch'])) {
        this.capabilities = {
          supported: true,
          active: false,
          method: 'hardware_torch',
        };
      } else {
        // Fallback to screen strobe
        this.capabilities = {
          supported: true,
          active: false,
          method: 'screen_strobe',
          errorDetails: 'Hardware torch constraint not exposed by browser. Using high-intensity Screen Strobe mode.',
        };
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown torch init error';
      this.capabilities = {
        supported: true,
        active: false,
        method: 'screen_strobe',
        errorDetails: `Camera access failed (${errorMsg}). Using Screen Strobe mode.`,
      };
    }

    return this.capabilities;
  }

  /**
   * Sets the optical state (Light ON / Light OFF)
   */
  public async setLightState(state: boolean): Promise<void> {
    this.capabilities.active = state;

    if (this.capabilities.method === 'hardware_torch' && this.videoTrack) {
      try {
        await this.videoTrack.applyConstraints({
          advanced: [{ torch: state } as unknown as MediaTrackConstraintSet],
        });
      } catch {
        // If hardware torch fails midway, fallback to screen strobe
        if (this.onScreenStrobeChange) {
          this.onScreenStrobeChange(state);
        }
      }
    } else {
      if (this.onScreenStrobeChange) {
        this.onScreenStrobeChange(state);
      }
    }
  }

  /**
   * Transmits an entire binary string bit-by-bit.
   */
  public async transmitBitStream(
    bits: string,
    symbolDurationMs: number,
    onProgress: (bit: string, index: number) => void,
    shouldAbort: () => boolean
  ): Promise<boolean> {
    for (let i = 0; i < bits.length; i++) {
      if (shouldAbort()) {
        await this.setLightState(false);
        return false;
      }

      const bit = bits[i];
      const isHigh = bit === '1';

      await this.setLightState(isHigh);
      onProgress(bit, i);

      await new Promise<void>((resolve) => setTimeout(resolve, symbolDurationMs));
    }

    // Always turn off at the end of the packet
    await this.setLightState(false);
    return true;
  }

  public release(): void {
    void this.setLightState(false);
    if (this.videoTrack) {
      this.videoTrack.stop();
      this.videoTrack = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    this.capabilities.active = false;
  }
}
