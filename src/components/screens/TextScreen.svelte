<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import jsQR from 'jsqr';
  import NeoCard from '../common/NeoCard.svelte';
  import NeoButton from '../common/NeoButton.svelte';
  import NeoBadge from '../common/NeoBadge.svelte';
  import Icons from '../common/Icons.svelte';
  import Oscilloscope from '../visualizer/Oscilloscope.svelte';
  import ChunkMatrix from '../visualizer/ChunkMatrix.svelte';
  import QrDisplay from '../visualizer/QrDisplay.svelte';
  import CompilationModal from '../common/CompilationModal.svelte';

  import type { ChunkPacket, DeviceRole, SenderPhase, ReceiverPhase, ToastNotification } from '../../types/protocol';
  import type { OpticalSample, CalibrationMetrics, TorchCapabilities } from '../../types/optical';
  import { encodeTextToPackets, parseBitStreamPacket } from '../../core/protocol';
  import { OpticalReceiverEngine } from '../../core/opticalReceiver';
  import { TorchTransmitterController } from '../../core/torchController';

  interface Props {
    onNotify: (toast: Omit<ToastNotification, 'id' | 'timestamp'>) => void;
  }

  let { onNotify }: Props = $props();

  // Role: 'sender' (Phone) or 'receiver' (Laptop)
  let role: DeviceRole = $state('sender');

  // Common Text Input & Chunks
  let inputText = $state('HELLO SENDD');
  let chunkSize = $state(2);
  let symbolDurationMs = $state(180);
  let chunks: ChunkPacket[] = $state([]);
  let activeChunkIndex = $state(-1);

  // Sender State
  let senderPhase: SenderPhase = $state('idle');
  let torchController: TorchTransmitterController | null = null;
  let torchStatus: TorchCapabilities = $state({ supported: false, active: false, method: 'none' });
  let isScreenStrobeOn = $state(false);
  let currentTransmittingBit = $state('');
  let currentBitProgress = $state(0);
  let abortTransmission = false;

  // Sender Front Camera QR Scanner (To read laptop screen feedback)
  let frontVideoEl: HTMLVideoElement | null = $state(null);
  let qrScanCanvas: HTMLCanvasElement | null = null;
  let qrScanAnimId: number | null = null;
  let lastScannedAck = $state('');
  let isFrontCameraRunning = $state(false);

  // Receiver State
  let receiverPhase: ReceiverPhase = $state('idle');
  let receiverVideoEl: HTMLVideoElement | null = $state(null);
  let receiverEngine: OpticalReceiverEngine | null = null;
  let opticalSamples: OpticalSample[] = $state([]);
  let currentBit: 0 | 1 = $state(0);
  let currentThreshold = $state(128);
  let calibrationMetrics: CalibrationMetrics = $state({
    minLuminance: 0,
    maxLuminance: 255,
    currentThreshold: 128,
    noiseLevel: 20,
    sampleCount: 0,
  });
  let rawBitBuffer = $state('');
  let receivedChunksMap: Record<number, string> = $state({});
  let expectedTotalChunks = $state(1);
  let currentAckQrData = $state('IDLE');

  // Compilation Modal
  let isCompilationModalOpen = $state(false);
  let compiledOutputText = $state('');

  // Initialize chunks when input changes
  function updateChunks(): void {
    if (!inputText.trim()) {
      chunks = [];
      return;
    }
    chunks = encodeTextToPackets(inputText.trim(), chunkSize);
    activeChunkIndex = -1;
  }

  onMount(() => {
    updateChunks();
    qrScanCanvas = document.createElement('canvas');
    qrScanCanvas.width = 320;
    qrScanCanvas.height = 240;
    receiverEngine = new OpticalReceiverEngine();

    receiverEngine.setCallbacks((sample, metrics) => {
      currentBit = sample.bit;
      currentThreshold = sample.threshold;
      calibrationMetrics = metrics;

      opticalSamples.push(sample);
      if (opticalSamples.length > 50) {
        opticalSamples.shift();
      }
    }, (bit, stream) => {
      rawBitBuffer = stream;
      handleReceiverBitStream(stream);
    });
  });

  onDestroy(() => {
    stopSenderTransmission();
    stopReceiver();
    stopFrontCameraScanner();
  });

  /* ========================================================================= */
  /* SENDER FUNCTIONS                                                          */
  /* ========================================================================= */

  async function initSenderTorch(): Promise<void> {
    torchController = new TorchTransmitterController();
    torchController.setScreenStrobeCallback((isOn) => {
      isScreenStrobeOn = isOn;
    });

    torchStatus = await torchController.initializeTorch();
    if (torchStatus.method === 'hardware_torch') {
      onNotify({
        title: 'HARDWARE TORCH READY',
        message: 'Rear flashlight activated for optical transmission.',
        type: 'success',
      });
    } else {
      onNotify({
        title: 'SCREEN STROBE ACTIVE',
        message: 'Torch API restricted. Using high-contrast screen strobe.',
        type: 'info',
      });
    }
  }

  async function startFrontCameraScanner(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
      });
      if (frontVideoEl) {
        frontVideoEl.srcObject = stream;
        await frontVideoEl.play();
        isFrontCameraRunning = true;
        scanQrLoop();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Camera error';
      onNotify({
        title: 'FRONT CAMERA ERROR',
        message: `Could not start selfie camera for QR reading: ${msg}`,
        type: 'warning',
      });
    }
  }

  function stopFrontCameraScanner(): void {
    if (qrScanAnimId !== null) {
      cancelAnimationFrame(qrScanAnimId);
      qrScanAnimId = null;
    }
    if (frontVideoEl && frontVideoEl.srcObject instanceof MediaStream) {
      frontVideoEl.srcObject.getTracks().forEach((t) => t.stop());
      frontVideoEl.srcObject = null;
    }
    isFrontCameraRunning = false;
  }

  function scanQrLoop(): void {
    if (!frontVideoEl || !qrScanCanvas || frontVideoEl.readyState < 2) {
      qrScanAnimId = requestAnimationFrame(scanQrLoop);
      return;
    }

    const ctx = qrScanCanvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      ctx.drawImage(frontVideoEl, 0, 0, qrScanCanvas.width, qrScanCanvas.height);
      const imgData = ctx.getImageData(0, 0, qrScanCanvas.width, qrScanCanvas.height);
      const code = jsQR(imgData.data, imgData.width, imgData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code && code.data) {
        handleScannedQrAck(code.data.trim());
      }
    }

    qrScanAnimId = requestAnimationFrame(scanQrLoop);
  }

  function handleScannedQrAck(ackStr: string): void {
    lastScannedAck = ackStr;

    // Check for "ACK:chunkId"
    if (ackStr.startsWith('ACK:')) {
      const ackChunkId = parseInt(ackStr.split(':')[1], 10);
      if (!isNaN(ackChunkId) && activeChunkIndex === ackChunkId) {
        if (chunks[ackChunkId]) {
          chunks[ackChunkId].state = 'acked';
        }
        senderPhase = 'chunk_acked';
      }
    } else if (ackStr === 'DONE' && senderPhase !== 'completed') {
      senderPhase = 'completed';
      onNotify({
        title: 'TRANSMISSION COMPLETE',
        message: 'All chunks successfully confirmed by receiver!',
        type: 'success',
      });
    }
  }

  async function startSenderTransmission(): Promise<void> {
    if (chunks.length === 0) {
      updateChunks();
    }
    if (chunks.length === 0) {
      onNotify({ title: 'NO DATA', message: 'Please enter text to transmit.', type: 'warning' });
      return;
    }

    abortTransmission = false;
    await initSenderTorch();
    await startFrontCameraScanner();

    // Reset chunks state
    chunks.forEach((c) => (c.state = 'pending'));

    for (let i = 0; i < chunks.length; i++) {
      if (abortTransmission) break;

      const currentChunk = chunks[i];
      activeChunkIndex = i;
      currentChunk.state = 'transmitting';
      senderPhase = 'transmitting_chunk';

      // Transmit the binary packet through light pulses
      const finished = await torchController!.transmitBitStream(
        currentChunk.bitStream,
        symbolDurationMs,
        (bit, idx) => {
          currentTransmittingBit = bit;
          currentBitProgress = idx;
        },
        () => abortTransmission
      );

      if (!finished || abortTransmission) break;

      // Await ACK from Laptop Screen QR via Front Camera
      senderPhase = 'awaiting_ack';
      const ackReceived = await waitForChunkAck(i, 4500);

      if (ackReceived) {
        currentChunk.state = 'acked';
      } else {
        // Retry logic
        currentChunk.retryCount++;
        currentChunk.state = 'missing';
        onNotify({
          title: `RETRYING CHUNK #${i}`,
          message: 'No ACK detected from QR code. Retransmitting chunk.',
          type: 'warning',
        });
        i--; // decrement to re-attempt this chunk
        await new Promise((r) => setTimeout(r, 600));
      }
    }

    if (!abortTransmission) {
      senderPhase = 'completed';
      onNotify({
        title: 'PAYLOAD TRANSMITTED',
        message: 'All packets dispatched and verified.',
        type: 'success',
      });
    }
  }

  function waitForChunkAck(chunkId: number, timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      const startTime = performance.now();
      const checkInterval = setInterval(() => {
        if (abortTransmission) {
          clearInterval(checkInterval);
          resolve(false);
          return;
        }

        if (chunks[chunkId]?.state === 'acked' || lastScannedAck === `ACK:${chunkId}` || lastScannedAck === 'DONE') {
          clearInterval(checkInterval);
          resolve(true);
          return;
        }

        if (performance.now() - startTime >= timeoutMs) {
          clearInterval(checkInterval);
          resolve(false);
        }
      }, 100);
    });
  }

  function stopSenderTransmission(): void {
    abortTransmission = true;
    senderPhase = 'idle';
    activeChunkIndex = -1;
    if (torchController) {
      torchController.release();
      torchController = null;
    }
    isScreenStrobeOn = false;
    stopFrontCameraScanner();
  }

  /* ========================================================================= */
  /* RECEIVER FUNCTIONS (Laptop with Webcam)                                   */
  /* ========================================================================= */

  async function startReceiver(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
      });

      if (receiverVideoEl) {
        receiverVideoEl.srcObject = stream;
        await receiverVideoEl.play();
        receiverEngine?.start(receiverVideoEl);
        receiverPhase = 'listening';
        currentAckQrData = 'READY';
        receivedChunksMap = {};
        rawBitBuffer = '';

        onNotify({
          title: 'RECEIVER ONLINE',
          message: 'Webcam calibrated. Aim phone flashlight directly at camera lens.',
          type: 'success',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Camera permission denied';
      onNotify({
        title: 'RECEIVER ERROR',
        message: `Failed to access webcam: ${msg}`,
        type: 'error',
      });
    }
  }

  function stopReceiver(): void {
    if (receiverEngine) {
      receiverEngine.stop();
    }
    if (receiverVideoEl && receiverVideoEl.srcObject instanceof MediaStream) {
      receiverVideoEl.srcObject.getTracks().forEach((t) => t.stop());
      receiverVideoEl.srcObject = null;
    }
    receiverPhase = 'idle';
    currentAckQrData = 'IDLE';
  }

  function handleReceiverBitStream(stream: string): void {
    // Attempt packet decode
    const packet = parseBitStreamPacket(stream);
    if (!packet) return;

    if (packet.valid) {
      expectedTotalChunks = packet.totalChunks;
      receivedChunksMap[packet.chunkId] = packet.payload;
      currentAckQrData = `ACK:${packet.chunkId}`;

      // Clear engine buffer once valid packet consumed
      receiverEngine?.clearBuffer();

      onNotify({
        title: `CHUNK #${packet.chunkId} VERIFIED`,
        message: `Received '${packet.payload}' with valid checksum & end sequence.`,
        type: 'info',
      });

      // Check if all chunks received
      const receivedCount = Object.keys(receivedChunksMap).length;
      if (receivedCount >= expectedTotalChunks) {
        currentAckQrData = 'DONE';
        completeReceiverAssembly();
      }
    } else {
      // Delimiter or checksum failure
      currentAckQrData = `MISSING:${packet.chunkId}`;
    }
  }

  function completeReceiverAssembly(): void {
    // Sort and concatenate
    const orderedParts: string[] = [];
    for (let i = 0; i < expectedTotalChunks; i++) {
      orderedParts.push(receivedChunksMap[i] || '');
    }
    compiledOutputText = orderedParts.join('');
    receiverPhase = 'completed';
    isCompilationModalOpen = true;
  }

  function copyCompiledText(): void {
    navigator.clipboard.writeText(compiledOutputText);
    onNotify({
      title: 'COPIED TO CLIPBOARD',
      message: 'Compiled payload copied.',
      type: 'success',
    });
  }
</script>

<!-- Screen Strobe Overlay for Mobile Fallback -->
{#if isScreenStrobeOn}
  <div class="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center p-6 text-black select-none">
    <div class="font-mono text-3xl font-black uppercase text-center tracking-widest bg-black text-white px-6 py-3 border-[3px] border-white shadow-[6px_6px_0px_#000]">
      OPTICAL FLASH HIGH
    </div>
    <div class="mt-4 font-mono text-sm font-bold uppercase bg-yellow-300 border-2 border-black px-4 py-2">
      Point this screen directly at the laptop webcam!
    </div>
  </div>
{/if}

<div class="space-y-6">
  <!-- Role Selector Switcher -->
  <div class="flex flex-col sm:flex-row items-center justify-between gap-4 border-[2.5px] border-black bg-white p-3 shadow-[4px_4px_0px_#000]">
    <div class="flex items-center gap-3 w-full sm:w-auto">
      <div class="p-2 border-[2px] border-black bg-[#FFE600]">
        <Icons name="flashlight" size={20} />
      </div>
      <div>
        <div class="font-mono text-xs font-black uppercase tracking-wider text-black">
          DEVICE OPERATIONAL ROLE
        </div>
        <div class="font-mono text-[11px] text-neutral-600">
          Choose whether this device transmits optical pulses or receives them.
        </div>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-2 w-full sm:w-auto">
      <NeoButton
        variant={role === 'sender' ? 'yellow' : 'white'}
        size="sm"
        onclick={() => {
          stopReceiver();
          role = 'sender';
        }}
      >
        📱 PHONE (SENDER)
      </NeoButton>

      <NeoButton
        variant={role === 'receiver' ? 'cyan' : 'white'}
        size="sm"
        onclick={() => {
          stopSenderTransmission();
          role = 'receiver';
        }}
      >
        💻 LAPTOP (RECEIVER)
      </NeoButton>
    </div>
  </div>

  <!-- SENDER MODE VIEW (Mobile Phone) -->
  {#if role === 'sender'}
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <!-- Left Column: Text Input & Transmission Control -->
      <div class="lg:col-span-7 space-y-6">
        <NeoCard
          title="TRANSMIT PAYLOAD (OPTICAL SENDER)"
          badgeText="OOK BINARY"
          badgeColor="yellow"
        >
          <div class="space-y-4">
            <div>
              <label for="text-payload" class="block font-mono text-xs font-bold uppercase text-neutral-800 mb-1">
                Enter Text Message:
              </label>
              <textarea
                id="text-payload"
                bind:value={inputText}
                oninput={updateChunks}
                disabled={senderPhase === 'transmitting_chunk' || senderPhase === 'awaiting_ack'}
                rows={3}
                class="w-full border-[2px] border-black p-2.5 font-mono text-sm bg-neutral-50 focus:bg-white focus:outline-none shadow-[2px_2px_0px_#000]"
                placeholder="Type text to transmit..."
              ></textarea>
            </div>

            <!-- Parameters Grid -->
            <div class="grid grid-cols-2 gap-3">
              <div class="border-[1.5px] border-black p-2 bg-neutral-50">
                <span class="block font-mono text-[10px] font-bold text-neutral-600 uppercase">
                  Chunk Size:
                </span>
                <div class="flex items-center gap-2 mt-1">
                  <input
                    type="range"
                    min="1"
                    max="4"
                    bind:value={chunkSize}
                    onchange={updateChunks}
                    disabled={senderPhase !== 'idle'}
                    class="w-full accent-black cursor-pointer"
                  />
                  <span class="font-mono text-xs font-black">{chunkSize}b</span>
                </div>
              </div>

              <div class="border-[1.5px] border-black p-2 bg-neutral-50">
                <span class="block font-mono text-[10px] font-bold text-neutral-600 uppercase">
                  Symbol Duration:
                </span>
                <div class="flex items-center gap-2 mt-1">
                  <input
                    type="range"
                    min="100"
                    max="400"
                    step="20"
                    bind:value={symbolDurationMs}
                    disabled={senderPhase !== 'idle'}
                    class="w-full accent-black cursor-pointer"
                  />
                  <span class="font-mono text-xs font-black">{symbolDurationMs}ms</span>
                </div>
              </div>
            </div>

            <!-- Transmission Actions -->
            <div class="flex flex-wrap items-center gap-2.5 pt-2">
              {#if senderPhase === 'idle' || senderPhase === 'completed'}
                <NeoButton
                  variant="yellow"
                  size="md"
                  className="flex-1"
                  onclick={startSenderTransmission}
                >
                  <Icons name="play" size={16} />
                  START FLASH TRANSMISSION
                </NeoButton>
              {:else}
                <NeoButton
                  variant="pink"
                  size="md"
                  className="flex-1"
                  onclick={stopSenderTransmission}
                >
                  <Icons name="x" size={16} />
                  ABORT TRANSMISSION
                </NeoButton>
              {/if}
            </div>
          </div>
        </NeoCard>

        <!-- Chunk Matrix Visualizer -->
        <ChunkMatrix {chunks} {activeChunkIndex} />
      </div>

      <!-- Right Column: Front Camera QR Feedback Reader & Status -->
      <div class="lg:col-span-5 space-y-6">
        <NeoCard
          title="FRONT CAMERA QR FEEDBACK"
          badgeText={isFrontCameraRunning ? 'SCANNING' : 'OFFLINE'}
          badgeColor={isFrontCameraRunning ? 'mint' : 'pink'}
        >
          <div class="space-y-3">
            <div class="relative border-[2px] border-black bg-neutral-900 aspect-video overflow-hidden flex items-center justify-center">
              <video
                bind:this={frontVideoEl}
                playsinline
                muted
                class="w-full h-full object-cover mirror"
              ></video>

              {#if !isFrontCameraRunning}
                <div class="absolute inset-0 flex flex-col items-center justify-center text-center p-4 bg-neutral-900 text-white font-mono text-xs">
                  <Icons name="camera" size={28} className="mb-2 text-[#FFE600]" />
                  <span>Selfie Camera will activate when transmission starts.</span>
                </div>
              {:else}
                <!-- Target Reticle Box -->
                <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div class="w-36 h-36 border-2 border-[#00FF88] border-dashed shadow-[0_0_12px_rgba(0,255,136,0.5)]"></div>
                </div>
              {/if}
            </div>

            <!-- Feedback Telemetry -->
            <div class="border-[1.5px] border-black p-2.5 bg-neutral-50 space-y-2 font-mono text-xs">
              <div class="flex items-center justify-between">
                <span class="text-neutral-600 font-bold uppercase">LAST SCANNED QR:</span>
                <NeoBadge variant={lastScannedAck.startsWith('ACK:') ? 'mint' : lastScannedAck === 'DONE' ? 'cyan' : 'yellow'}>
                  {lastScannedAck || 'NONE'}
                </NeoBadge>
              </div>

              <div class="flex items-center justify-between">
                <span class="text-neutral-600 font-bold uppercase">TORCH HARDWARE:</span>
                <span class="font-bold text-black uppercase">{torchStatus.method}</span>
              </div>

              {#if senderPhase === 'transmitting_chunk'}
                <div class="p-2 border border-black bg-[#FFE600] flex items-center justify-between">
                  <span class="font-black">SENDING BIT #{currentBitProgress}:</span>
                  <span class="font-black text-sm px-2 py-0.5 bg-black text-white">
                    {currentTransmittingBit}
                  </span>
                </div>
              {/if}
            </div>
          </div>
        </NeoCard>
      </div>
    </div>

  <!-- RECEIVER MODE VIEW (Laptop with Webcam) -->
  {:else}
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <!-- Left Column: Webcam Receiver & Oscilloscope -->
      <div class="lg:col-span-7 space-y-6">
        <NeoCard
          title="OPTICAL RECEIVER (LAPTOP WEBCAM)"
          badgeText={receiverPhase !== 'idle' ? 'ACTIVE' : 'STANDBY'}
          badgeColor={receiverPhase !== 'idle' ? 'mint' : 'yellow'}
        >
          <div class="space-y-4">
            <div class="relative border-[2.5px] border-black bg-black aspect-video overflow-hidden flex items-center justify-center">
              <video
                bind:this={receiverVideoEl}
                playsinline
                muted
                class="w-full h-full object-cover"
              ></video>

              {#if receiverPhase === 'idle'}
                <div class="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-neutral-900 text-white font-mono text-xs">
                  <Icons name="camera" size={36} className="mb-2 text-[#00F0FF]" />
                  <span class="font-bold text-sm mb-1">WEBCAM RECEIVER OFFLINE</span>
                  <span class="text-neutral-400">Click below to activate optical luminance detection.</span>
                </div>
              {:else}
                <!-- Center Region of Interest (ROI) Reticle -->
                <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div class="w-32 h-32 border-2 border-[#00F0FF] shadow-[0_0_15px_#00F0FF] flex items-center justify-center">
                    <span class="text-[9px] font-mono text-[#00F0FF] font-black bg-black/70 px-1">
                      ROI 35%
                    </span>
                  </div>
                </div>
              {/if}
            </div>

            <!-- Receiver Activation Controls -->
            <div class="flex items-center gap-3">
              {#if receiverPhase === 'idle'}
                <NeoButton
                  variant="cyan"
                  size="md"
                  className="flex-1"
                  onclick={startReceiver}
                >
                  <Icons name="play" size={16} />
                  ACTIVATE WEBCAM RECEIVER
                </NeoButton>
              {:else}
                <NeoButton
                  variant="pink"
                  size="md"
                  className="flex-1"
                  onclick={stopReceiver}
                >
                  <Icons name="pause" size={16} />
                  STOP RECEIVER
                </NeoButton>
              {/if}
            </div>

            <!-- Oscilloscope Real-Time Waveform -->
            <Oscilloscope
              samples={opticalSamples}
              {currentBit}
              threshold={currentThreshold}
            />
          </div>
        </NeoCard>
      </div>

      <!-- Right Column: Dynamic Feedback QR Code & Reconstruction -->
      <div class="lg:col-span-5 space-y-6">
        <!-- Dynamic On-Screen QR Code for Phone to Read -->
        <QrDisplay
          data={currentAckQrData}
          label="DYNAMIC FEEDBACK QR"
          statusBadge={currentAckQrData.startsWith('ACK:') ? 'ACK SENT' : currentAckQrData}
          badgeVariant={currentAckQrData.startsWith('ACK:') ? 'mint' : 'cyan'}
          size={210}
        />

        <!-- Reconstructed Output Card -->
        <NeoCard
          title="LIVE RECONSTRUCTED TEXT"
          badgeText="{Object.keys(receivedChunksMap).length} CHUNKS"
          badgeColor="mint"
        >
          <div class="space-y-3">
            <div class="p-3 border-[2px] border-black bg-neutral-900 text-[#00FF88] font-mono text-sm min-h-[90px] break-all select-all shadow-[2px_2px_0px_#000]">
              {#if Object.keys(receivedChunksMap).length === 0}
                <span class="text-neutral-500 italic">Awaiting first optical packet...</span>
              {:else}
                {Object.values(receivedChunksMap).join('')}
              {/if}
            </div>

            <div class="flex items-center justify-between font-mono text-xs text-neutral-700">
              <span>RAW BITS:</span>
              <span class="font-bold text-[10px] text-neutral-500 max-w-[180px] truncate">{rawBitBuffer || 'EMPTY'}</span>
            </div>
          </div>
        </NeoCard>
      </div>
    </div>
  {/if}
</div>

<!-- Compilation & Output Modal -->
<CompilationModal
  isOpen={isCompilationModalOpen}
  decodedOutput={compiledOutputText}
  totalChunks={expectedTotalChunks}
  transmissionType="text"
  onClose={() => (isCompilationModalOpen = false)}
  onCopy={copyCompiledText}
/>

<style>
  .mirror {
    transform: scaleX(-1);
  }
</style>
