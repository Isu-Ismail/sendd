<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import jsQR from 'jsqr';
  import NeoCard from '../common/NeoCard.svelte';
  import NeoButton from '../common/NeoButton.svelte';
  import NeoBadge from '../common/NeoBadge.svelte';
  import Icons from '../common/Icons.svelte';
  import QrDisplay from '../visualizer/QrDisplay.svelte';
  import CompilationModal from '../common/CompilationModal.svelte';
  import type { ToastNotification } from '../../types/protocol';

  interface Props {
    onNotify: (toast: Omit<ToastNotification, 'id' | 'timestamp'>) => void;
  }

  let { onNotify }: Props = $props();

  let mode: 'send_qr' | 'receive_qr' = $state('send_qr');

  // Streaming Sender State
  let messageText = $state('PROJECT SENDD: AIR-GAPPED OPTICAL DATA TRANSFER PROTOCOL INITIALIZED.');
  let streamFps = $state(4);
  let isStreaming = $state(false);
  let currentStreamIndex = $state(0);
  let streamChunks: string[] = $state([]);
  let streamIntervalId: ReturnType<typeof setInterval> | null = null;

  // Scanner Receiver State
  let scannerVideoEl: HTMLVideoElement | null = $state(null);
  let scanCanvas: HTMLCanvasElement | null = null;
  let isScannerActive = $state(false);
  let scanAnimId: number | null = null;
  let scannedChunksMap: Record<number, string> = $state({});
  let totalExpectedChunks = $state(1);
  let isCompilationModalOpen = $state(false);
  let assembledResult = $state('');

  function prepareStreamChunks(): void {
    const raw = messageText.trim();
    if (!raw) {
      streamChunks = [];
      return;
    }

    const CHUNK_LEN = 16;
    const count = Math.ceil(raw.length / CHUNK_LEN);
    const result: string[] = [];

    for (let i = 0; i < count; i++) {
      const slice = raw.slice(i * CHUNK_LEN, (i + 1) * CHUNK_LEN);
      // Format: "SQ:index/total:payload"
      result.push(`SQ:${i}/${count}:${slice}`);
    }

    streamChunks = result;
    currentStreamIndex = 0;
  }

  onMount(() => {
    prepareStreamChunks();
    scanCanvas = document.createElement('canvas');
    scanCanvas.width = 400;
    scanCanvas.height = 300;
  });

  onDestroy(() => {
    stopStream();
    stopScanner();
  });

  function startStream(): void {
    prepareStreamChunks();
    if (streamChunks.length === 0) return;

    isStreaming = true;
    currentStreamIndex = 0;

    const intervalMs = Math.round(1000 / streamFps);
    streamIntervalId = setInterval(() => {
      currentStreamIndex = (currentStreamIndex + 1) % streamChunks.length;
    }, intervalMs);

    onNotify({
      title: 'QR STREAM ACTIVE',
      message: `Looping ${streamChunks.length} chunks at ${streamFps} FPS.`,
      type: 'info',
    });
  }

  function stopStream(): void {
    if (streamIntervalId !== null) {
      clearInterval(streamIntervalId);
      streamIntervalId = null;
    }
    isStreaming = false;
  }

  async function startScanner(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      if (scannerVideoEl) {
        scannerVideoEl.srcObject = stream;
        await scannerVideoEl.play();
        isScannerActive = true;
        scannedChunksMap = {};
        scanQrLoop();
        onNotify({
          title: 'QR SCANNER RUNNING',
          message: 'Point camera at the animated QR burst on the sender screen.',
          type: 'success',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Camera error';
      onNotify({
        title: 'SCANNER ERROR',
        message: `Failed to open camera: ${msg}`,
        type: 'error',
      });
    }
  }

  function stopScanner(): void {
    if (scanAnimId !== null) {
      cancelAnimationFrame(scanAnimId);
      scanAnimId = null;
    }
    if (scannerVideoEl && scannerVideoEl.srcObject instanceof MediaStream) {
      scannerVideoEl.srcObject.getTracks().forEach((t) => t.stop());
      scannerVideoEl.srcObject = null;
    }
    isScannerActive = false;
  }

  function scanQrLoop(): void {
    if (!scannerVideoEl || !scanCanvas || scannerVideoEl.readyState < 2) {
      scanAnimId = requestAnimationFrame(scanQrLoop);
      return;
    }

    const ctx = scanCanvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      ctx.drawImage(scannerVideoEl, 0, 0, scanCanvas.width, scanCanvas.height);
      const imgData = ctx.getImageData(0, 0, scanCanvas.width, scanCanvas.height);
      const code = jsQR(imgData.data, imgData.width, imgData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code && code.data) {
        handleScannedStreamCode(code.data.trim());
      }
    }

    scanAnimId = requestAnimationFrame(scanQrLoop);
  }

  function handleScannedStreamCode(raw: string): void {
    if (!raw.startsWith('SQ:')) return;
    const parts = raw.slice(3).split(':');
    if (parts.length < 2) return;

    const [header, ...payloadParts] = parts;
    const payload = payloadParts.join(':');
    const [idxStr, totalStr] = header.split('/');
    const idx = parseInt(idxStr, 10);
    const total = parseInt(totalStr, 10);

    if (isNaN(idx) || isNaN(total)) return;

    totalExpectedChunks = total;
    if (!scannedChunksMap[idx]) {
      scannedChunksMap[idx] = payload;
      onNotify({
        title: `CHUNK ${idx + 1}/${total} CAPTURED`,
        message: `Received: "${payload}"`,
        type: 'info',
      });
    }

    // Check if finished
    const count = Object.keys(scannedChunksMap).length;
    if (count >= total && !isCompilationModalOpen) {
      const full: string[] = [];
      for (let i = 0; i < total; i++) {
        full.push(scannedChunksMap[i] || '');
      }
      assembledResult = full.join('');
      stopScanner();
      isCompilationModalOpen = true;
    }
  }

  function copyAssembledText(): void {
    navigator.clipboard.writeText(assembledResult);
    onNotify({
      title: 'COPIED TO CLIPBOARD',
      message: 'Decoded QR message copied.',
      type: 'success',
    });
  }
</script>

<div class="space-y-6">
  <!-- Mode Selector -->
  <div class="border-[2.5px] border-black bg-white p-3 shadow-[4px_4px_0px_#000] flex flex-col sm:flex-row items-center justify-between gap-4">
    <div class="flex items-center gap-3 w-full sm:w-auto">
      <div class="p-2 border-[2px] border-black bg-[#00F0FF]">
        <Icons name="qr" size={20} />
      </div>
      <div>
        <div class="font-mono text-xs font-black uppercase tracking-wider text-black">
          ANIMATED QR BURST CHANNEL
        </div>
        <div class="font-mono text-[11px] text-neutral-600">
          Stream high-speed sequential QR frames or scan them with camera.
        </div>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-2 w-full sm:w-auto">
      <NeoButton
        variant={mode === 'send_qr' ? 'cyan' : 'white'}
        size="sm"
        onclick={() => {
          stopScanner();
          mode = 'send_qr';
        }}
      >
        📤 TRANSMIT QR STREAM
      </NeoButton>
      <NeoButton
        variant={mode === 'receive_qr' ? 'yellow' : 'white'}
        size="sm"
        onclick={() => {
          stopStream();
          mode = 'receive_qr';
        }}
      >
        📥 RECEIVE & SCAN
      </NeoButton>
    </div>
  </div>

  <!-- TRANSMITTER VIEW -->
  {#if mode === 'send_qr'}
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div class="lg:col-span-7 space-y-6">
        <NeoCard
          title="QR STREAM CONFIGURATION"
          badgeText="{streamChunks.length} PACKETS"
          badgeColor="cyan"
        >
          <div class="space-y-4">
            <div>
              <label for="qr-stream-text" class="block font-mono text-xs font-bold uppercase text-neutral-800 mb-1">
                Data Message to Stream:
              </label>
              <textarea
                id="qr-stream-text"
                bind:value={messageText}
                oninput={prepareStreamChunks}
                disabled={isStreaming}
                rows={3}
                class="w-full border-[2px] border-black p-2.5 font-mono text-sm bg-neutral-50 focus:bg-white focus:outline-none shadow-[2px_2px_0px_#000]"
                placeholder="Type large text or data to broadcast via QR stream..."
              ></textarea>
            </div>

            <!-- Speed Slider -->
            <div class="border-[1.5px] border-black p-2.5 bg-neutral-50">
              <div class="flex items-center justify-between font-mono text-xs font-bold uppercase mb-1">
                <span>STREAM FRAME RATE:</span>
                <span>{streamFps} FPS</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                bind:value={streamFps}
                disabled={isStreaming}
                class="w-full accent-black cursor-pointer"
              />
            </div>

            <div class="flex items-center gap-2.5">
              {#if !isStreaming}
                <NeoButton
                  variant="cyan"
                  size="md"
                  className="flex-1"
                  onclick={startStream}
                >
                  <Icons name="play" size={16} />
                  BROADCAST QR STREAM
                </NeoButton>
              {:else}
                <NeoButton
                  variant="pink"
                  size="md"
                  className="flex-1"
                  onclick={stopStream}
                >
                  <Icons name="pause" size={16} />
                  STOP BROADCAST
                </NeoButton>
              {/if}
            </div>
          </div>
        </NeoCard>
      </div>

      <div class="lg:col-span-5 space-y-6">
        <!-- Live Animated QR Canvas -->
        <QrDisplay
          data={streamChunks[currentStreamIndex] || ''}
          label="DYNAMIC STREAM FRAME"
          statusBadge={isStreaming ? `FRAME ${currentStreamIndex + 1}/${streamChunks.length}` : 'PAUSED'}
          badgeVariant={isStreaming ? 'mint' : 'yellow'}
          size={220}
        />
      </div>
    </div>

  <!-- RECEIVER / SCANNER VIEW -->
  {:else}
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div class="lg:col-span-7 space-y-6">
        <NeoCard
          title="HIGH-SPEED QR CAMERA SCANNER"
          badgeText={isScannerActive ? 'ACTIVE' : 'OFFLINE'}
          badgeColor={isScannerActive ? 'mint' : 'pink'}
        >
          <div class="space-y-4">
            <div class="relative border-[2.5px] border-black bg-black aspect-video overflow-hidden flex items-center justify-center">
              <video
                bind:this={scannerVideoEl}
                playsinline
                muted
                class="w-full h-full object-cover"
              ></video>

              {#if !isScannerActive}
                <div class="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-neutral-900 text-white font-mono text-xs">
                  <Icons name="camera" size={36} className="mb-2 text-[#00FF88]" />
                  <span class="font-bold text-sm mb-1">SCANNER CAMERA OFFLINE</span>
                  <span class="text-neutral-400">Click below to activate camera and scan dynamic QR stream.</span>
                </div>
              {:else}
                <!-- Target Reticle Box -->
                <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div class="w-44 h-44 border-2 border-[#00FF88] border-dashed shadow-[0_0_15px_rgba(0,255,136,0.6)]"></div>
                </div>
              {/if}
            </div>

            <div class="flex items-center gap-3">
              {#if !isScannerActive}
                <NeoButton
                  variant="mint"
                  size="md"
                  className="flex-1"
                  onclick={startScanner}
                >
                  <Icons name="play" size={16} />
                  START SCANNER CAMERA
                </NeoButton>
              {:else}
                <NeoButton
                  variant="pink"
                  size="md"
                  className="flex-1"
                  onclick={stopScanner}
                >
                  <Icons name="pause" size={16} />
                  STOP SCANNER
                </NeoButton>
              {/if}
            </div>
          </div>
        </NeoCard>
      </div>

      <div class="lg:col-span-5 space-y-6">
        <NeoCard
          title="CAPTURED CHUNK REASSEMBLY"
          badgeText="{Object.keys(scannedChunksMap).length}/{totalExpectedChunks} CHUNKS"
          badgeColor="cyan"
        >
          <div class="space-y-4">
            <!-- Progress Bar -->
            <div class="space-y-1">
              <div class="flex items-center justify-between font-mono text-[10px] font-bold text-neutral-600 uppercase">
                <span>RECONSTRUCTION PROGRESS:</span>
                <span>{Math.round((Object.keys(scannedChunksMap).length / totalExpectedChunks) * 100)}%</span>
              </div>
              <div class="w-full h-4 border-[2px] border-black bg-neutral-200 p-0.5">
                <div
                  class="h-full bg-[#00FF88] border-r-[2px] border-black transition-all duration-200"
                  style="width: {(Object.keys(scannedChunksMap).length / totalExpectedChunks) * 100}%"
                ></div>
              </div>
            </div>

            <!-- Live Decoded Text Box -->
            <div class="p-3 border-[2px] border-black bg-neutral-900 text-[#00FF88] font-mono text-sm min-h-[120px] break-all select-all shadow-[2px_2px_0px_#000]">
              {#if Object.keys(scannedChunksMap).length === 0}
                <span class="text-neutral-500 italic">No QR packets scanned yet...</span>
              {:else}
                {Object.values(scannedChunksMap).join('')}
              {/if}
            </div>
          </div>
        </NeoCard>
      </div>
    </div>
  {/if}
</div>

<!-- Compilation Modal -->
<CompilationModal
  isOpen={isCompilationModalOpen}
  decodedOutput={assembledResult}
  totalChunks={totalExpectedChunks}
  transmissionType="qr_stream"
  onClose={() => (isCompilationModalOpen = false)}
  onCopy={copyAssembledText}
/>
