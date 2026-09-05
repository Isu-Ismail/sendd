<script lang="ts">
  import { onMount } from 'svelte';
  import type { OpticalSample } from '../../types/optical';

  interface Props {
    samples: OpticalSample[];
    currentBit: 0 | 1;
    threshold: number;
    className?: string;
  }

  let { samples, currentBit, threshold, className = '' }: Props = $props();

  let canvasEl: HTMLCanvasElement | null = $state(null);

  $effect(() => {
    if (!canvasEl) return;
    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;

    const width = canvasEl.width;
    const height = canvasEl.height;

    // Clear background
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 0, width, height);

    // Draw retro grid lines
    ctx.strokeStyle = '#222222';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 15) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    if (samples.length < 2) return;

    // Draw adaptive threshold line (yellow dotted)
    const normThresholdY = height - (threshold / 255) * height;
    ctx.strokeStyle = '#FFE600';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, normThresholdY);
    ctx.lineTo(width, normThresholdY);
    ctx.stroke();
    ctx.setLineDash([]); // reset

    // Draw optical luminance waveform (neon cyan)
    ctx.strokeStyle = '#00F0FF';
    ctx.lineWidth = 2.5;
    ctx.beginPath();

    const stepX = width / Math.max(1, samples.length - 1);
    samples.forEach((s, idx) => {
      const x = idx * stepX;
      const y = height - (s.luminance / 255) * height;
      if (idx === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
  });
</script>

<div class="relative border-[2.5px] border-black bg-black p-1 {className}">
  <canvas
    bind:this={canvasEl}
    width={280}
    height={90}
    class="w-full h-[90px] block"
  ></canvas>

  <div class="absolute top-2 left-2 flex items-center gap-1.5 pointer-events-none">
    <span class="w-2 h-2 border border-black {currentBit === 1 ? 'bg-[#00FF88] shadow-[0_0_8px_#00FF88]' : 'bg-neutral-600'}"></span>
    <span class="font-mono text-[9px] font-black tracking-widest text-[#00F0FF]">
      OPTICAL WAVEFORM
    </span>
  </div>

  <div class="absolute top-2 right-2 font-mono text-[9px] text-[#FFE600] font-black pointer-events-none">
    THRES: {threshold}
  </div>
</div>
