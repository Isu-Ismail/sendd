<script lang="ts">
  import { onMount } from 'svelte';
  import NeoCard from '../common/NeoCard.svelte';
  import NeoButton from '../common/NeoButton.svelte';
  import NeoBadge from '../common/NeoBadge.svelte';
  import Icons from '../common/Icons.svelte';
  import CompilationModal from '../common/CompilationModal.svelte';
  import type { ImagePixelData, ToastNotification, ChunkPacket } from '../../types/protocol';
  import { serializePixelData, deserializePixelData, encodeTextToPackets } from '../../core/protocol';

  interface Props {
    onNotify: (toast: Omit<ToastNotification, 'id' | 'timestamp'>) => void;
  }

  let { onNotify }: Props = $props();

  const GRID_SIZE = 12; // 12x12 = 144 pixels (lightweight for fast optical transmission)
  const PALETTE = ['#FFFFFF', '#000000', '#FFE600', '#FF6B8B'];

  let selectedColorIdx = $state(1); // Default black
  let pixels: number[] = $state(new Array(GRID_SIZE * GRID_SIZE).fill(0));
  let isDrawing = $state(false);

  // Receiving state
  let receiverPixels: number[] = $state(new Array(GRID_SIZE * GRID_SIZE).fill(0));
  let isTransferring = $state(false);
  let transferProgress = $state(0);
  let isCompilationModalOpen = $state(false);
  let compiledImageDataUrl = $state('');

  // Preset templates
  const PRESETS: Record<string, number[]> = {
    heart: [
      0,0,0,0,0,0,0,0,0,0,0,0,
      0,0,3,3,0,0,0,3,3,0,0,0,
      0,3,3,3,3,0,3,3,3,3,0,0,
      0,3,3,3,3,3,3,3,3,3,0,0,
      0,3,3,3,3,3,3,3,3,3,0,0,
      0,0,3,3,3,3,3,3,3,0,0,0,
      0,0,0,3,3,3,3,3,0,0,0,0,
      0,0,0,0,3,3,3,0,0,0,0,0,
      0,0,0,0,0,3,0,0,0,0,0,0,
      0,0,0,0,0,0,0,0,0,0,0,0,
      0,0,0,0,0,0,0,0,0,0,0,0,
      0,0,0,0,0,0,0,0,0,0,0,0,
    ],
    invader: [
      0,0,0,0,0,0,0,0,0,0,0,0,
      0,0,1,0,0,0,0,0,0,1,0,0,
      0,0,0,1,0,0,0,0,1,0,0,0,
      0,0,1,1,1,1,1,1,1,1,0,0,
      0,1,1,0,1,1,1,1,0,1,1,0,
      1,1,1,1,1,1,1,1,1,1,1,1,
      1,0,1,1,1,1,1,1,1,1,0,1,
      1,0,1,0,0,0,0,0,0,1,0,1,
      0,0,0,1,1,0,0,1,1,0,0,0,
      0,0,0,0,0,0,0,0,0,0,0,0,
      0,0,0,0,0,0,0,0,0,0,0,0,
      0,0,0,0,0,0,0,0,0,0,0,0,
    ],
    smile: [
      0,0,0,0,0,0,0,0,0,0,0,0,
      0,0,0,2,2,2,2,2,2,0,0,0,
      0,0,2,2,2,2,2,2,2,2,0,0,
      0,2,2,1,2,2,2,2,1,2,2,0,
      0,2,2,1,2,2,2,2,1,2,2,0,
      0,2,2,2,2,2,2,2,2,2,2,0,
      0,2,2,1,2,2,2,2,1,2,2,0,
      0,2,2,2,1,1,1,1,2,2,2,0,
      0,0,2,2,2,2,2,2,2,2,0,0,
      0,0,0,2,2,2,2,2,2,0,0,0,
      0,0,0,0,0,0,0,0,0,0,0,0,
      0,0,0,0,0,0,0,0,0,0,0,0,
    ],
  };

  function loadPreset(name: 'heart' | 'invader' | 'smile'): void {
    const preset = PRESETS[name];
    if (preset) {
      pixels = [...preset];
    }
  }

  function clearCanvas(): void {
    pixels = new Array(GRID_SIZE * GRID_SIZE).fill(0);
  }

  function paintPixel(idx: number): void {
    pixels[idx] = selectedColorIdx;
  }

  function handlePixelMouseDown(idx: number): void {
    isDrawing = true;
    paintPixel(idx);
  }

  function handlePixelMouseEnter(idx: number): void {
    if (isDrawing) {
      paintPixel(idx);
    }
  }

  function handleMouseUp(): void {
    isDrawing = false;
  }

  async function transmitImage(): Promise<void> {
    const imgData: ImagePixelData = {
      width: GRID_SIZE,
      height: GRID_SIZE,
      palette: PALETTE,
      pixels: [...pixels],
    };

    const serialized = serializePixelData(imgData);
    const packets = encodeTextToPackets(serialized, 4);

    isTransferring = true;
    transferProgress = 0;
    receiverPixels = new Array(GRID_SIZE * GRID_SIZE).fill(0);

    onNotify({
      title: 'TRANSMITTING PIXEL MAP',
      message: `Packaging ${GRID_SIZE}x${GRID_SIZE} art into ${packets.length} optical chunks.`,
      type: 'info',
    });

    // Simulate real-time progressive chunk arrival onto receiver
    const pixelsPerChunk = Math.ceil(imgData.pixels.length / packets.length);

    for (let i = 0; i < packets.length; i++) {
      await new Promise((r) => setTimeout(r, 280));
      transferProgress = Math.round(((i + 1) / packets.length) * 100);

      // Paint arriving pixels progressively
      const start = i * pixelsPerChunk;
      const end = Math.min(imgData.pixels.length, (i + 1) * pixelsPerChunk);
      for (let p = start; p < end; p++) {
        receiverPixels[p] = imgData.pixels[p];
      }
    }

    isTransferring = false;
    isCompilationModalOpen = true;

    // Generate canvas snapshot data URL
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 120;
    tempCanvas.height = 120;
    const ctx = tempCanvas.getContext('2d');
    if (ctx) {
      const pSize = 10;
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          const colorIdx = receiverPixels[r * GRID_SIZE + c] || 0;
          ctx.fillStyle = PALETTE[colorIdx];
          ctx.fillRect(c * pSize, r * pSize, pSize, pSize);
        }
      }
      compiledImageDataUrl = tempCanvas.toDataURL();
    }
  }
</script>

<svelte:window onmouseup={handleMouseUp} />

<div class="space-y-6">
  <!-- Top Banner -->
  <div class="border-[2.5px] border-black bg-[#FFE600] p-3 shadow-[4px_4px_0px_#000] flex flex-col sm:flex-row items-center justify-between gap-3">
    <div class="flex items-center gap-3">
      <div class="p-2 border-[2px] border-black bg-white">
        <Icons name="image" size={20} />
      </div>
      <div>
        <div class="font-mono text-xs font-black uppercase tracking-wider text-black">
          OPTICAL PIXEL ART TRANSMISSION
        </div>
        <div class="font-mono text-[11px] text-neutral-800">
          Draw or choose a 12x12 retro icon, serialize to binary chunks, and stream optically.
        </div>
      </div>
    </div>

    <!-- Presets -->
    <div class="flex items-center gap-2">
      <span class="font-mono text-xs font-bold uppercase">PRESETS:</span>
      <NeoButton variant="white" size="sm" onclick={() => loadPreset('heart')}>❤️ Heart</NeoButton>
      <NeoButton variant="white" size="sm" onclick={() => loadPreset('invader')}>👾 Invader</NeoButton>
      <NeoButton variant="white" size="sm" onclick={() => loadPreset('smile')}>😊 Smile</NeoButton>
    </div>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
    <!-- Left Column: Pixel Editor (Sender) -->
    <div class="lg:col-span-6 space-y-6">
      <NeoCard
        title="PIXEL CANVAS (SENDER)"
        badgeText="12x12 MATRIX"
        badgeColor="yellow"
      >
        <div class="space-y-4">
          <!-- Palette Selector -->
          <div class="flex items-center justify-between border-[1.5px] border-black p-2 bg-neutral-50">
            <span class="font-mono text-xs font-bold uppercase text-neutral-800">COLOR PALETTE:</span>
            <div class="flex items-center gap-2">
              {#each PALETTE as color, idx}
                <button
                  type="button"
                  aria-label="Select color {idx}"
                  onclick={() => (selectedColorIdx = idx)}
                  class="w-6 h-6 border-[2px] border-black transition-transform {selectedColorIdx === idx ? 'scale-110 ring-2 ring-black shadow-[2px_2px_0px_#000]' : ''}"
                  style="background-color: {color};"
                ></button>
              {/each}
            </div>
          </div>

          <!-- Drawing Grid -->
          <div class="flex justify-center p-3 border-[2px] border-black bg-neutral-100">
            <div
              class="grid gap-0.5 border-[2px] border-black bg-black select-none"
              style="grid-template-columns: repeat({GRID_SIZE}, minmax(0, 1fr)); width: 240px; height: 240px;"
            >
              {#each pixels as pixelColorIdx, i}
                <button
                  type="button"
                  aria-label="Pixel {i}"
                  onmousedown={() => handlePixelMouseDown(i)}
                  onmouseenter={() => handlePixelMouseEnter(i)}
                  class="w-full h-full cursor-pointer transition-colors duration-75 border border-black/10"
                  style="background-color: {PALETTE[pixelColorIdx]};"
                ></button>
              {/each}
            </div>
          </div>

          <!-- Controls -->
          <div class="flex items-center gap-2.5">
            <NeoButton variant="white" size="sm" onclick={clearCanvas}>
              CLEAR
            </NeoButton>
            <NeoButton
              variant="yellow"
              size="md"
              className="flex-1"
              disabled={isTransferring}
              onclick={transmitImage}
            >
              <Icons name="send" size={16} />
              {isTransferring ? `TRANSMITTING (${transferProgress}%)` : 'TRANSMIT PIXEL MAP'}
            </NeoButton>
          </div>
        </div>
      </NeoCard>
    </div>

    <!-- Right Column: Live Progressive Receiver -->
    <div class="lg:col-span-6 space-y-6">
      <NeoCard
        title="PROGRESSIVE IMAGE RECEIVER"
        badgeText={isTransferring ? 'STREAMING' : 'IDLE'}
        badgeColor={isTransferring ? 'mint' : 'cyan'}
      >
        <div class="space-y-4">
          <!-- Progress Bar -->
          <div class="space-y-1">
            <div class="flex items-center justify-between font-mono text-[10px] font-bold text-neutral-600 uppercase">
              <span>PROGRESSIVE DECODE:</span>
              <span>{transferProgress}%</span>
            </div>
            <div class="w-full h-4 border-[2px] border-black bg-neutral-200 p-0.5">
              <div
                class="h-full bg-[#00FF88] border-r-[2px] border-black transition-all duration-200"
                style="width: {transferProgress}%"
              ></div>
            </div>
          </div>

          <!-- Receiver Canvas Display -->
          <div class="flex justify-center p-3 border-[2px] border-black bg-neutral-900">
            <div
              class="grid gap-0.5 border-[2px] border-[#00FF88] bg-black select-none shadow-[0_0_10px_rgba(0,255,136,0.3)]"
              style="grid-template-columns: repeat({GRID_SIZE}, minmax(0, 1fr)); width: 240px; height: 240px;"
            >
              {#each receiverPixels as pixelColorIdx, i}
                <div
                  class="w-full h-full border border-black/20"
                  style="background-color: {PALETTE[pixelColorIdx]};"
                ></div>
              {/each}
            </div>
          </div>

          <div class="border-[1.5px] border-black p-2.5 bg-neutral-50 font-mono text-xs space-y-1.5">
            <div class="flex items-center justify-between">
              <span class="text-neutral-600 font-bold uppercase">TOTAL PIXELS:</span>
              <span class="font-black text-black">{GRID_SIZE * GRID_SIZE}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-neutral-600 font-bold uppercase">COLOR DEPTH:</span>
              <span class="font-black text-black">2-BIT (4 COLORS)</span>
            </div>
          </div>
        </div>
      </NeoCard>
    </div>
  </div>
</div>

<!-- Image Compilation Modal -->
<CompilationModal
  isOpen={isCompilationModalOpen}
  title="PIXEL MAP COMPILED"
  decodedOutput="[12x12 Pixel Bitmap Assembled Successfully]"
  totalChunks={Math.ceil((GRID_SIZE * GRID_SIZE) / 16)}
  transmissionType="image"
  onClose={() => (isCompilationModalOpen = false)}
  onCopy={() => {
    onNotify({ title: 'ART SAVED', message: 'Pixel map ready.', type: 'success' });
  }}
/>
