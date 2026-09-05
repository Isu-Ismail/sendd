<script lang="ts">
  import QRCode from 'qrcode';
  import NeoBadge from '../common/NeoBadge.svelte';

  interface Props {
    data: string;
    label?: string;
    statusBadge?: string;
    badgeVariant?: 'yellow' | 'cyan' | 'pink' | 'mint' | 'orange' | 'white' | 'black';
    size?: number;
    className?: string;
  }

  let {
    data,
    label = 'QR FEEDBACK CHANNEL',
    statusBadge,
    badgeVariant = 'yellow',
    size = 200,
    className = '',
  }: Props = $props();

  let canvasEl: HTMLCanvasElement | null = $state(null);
  let renderError: string | null = $state(null);

  $effect(() => {
    if (!canvasEl || !data) return;

    QRCode.toCanvas(
      canvasEl,
      data,
      {
        width: size,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'M',
      },
      (err: Error | null | undefined) => {
        if (err) {
          renderError = err.message;
        } else {
          renderError = null;
        }
      }
    );
  });
</script>

<div class="border-[2.5px] border-black bg-white shadow-[4px_4px_0px_#000] p-3 flex flex-col items-center {className}">
  <div class="w-full flex items-center justify-between pb-2 mb-2 border-b border-black/10">
    <span class="font-mono text-[10px] font-black uppercase tracking-wider text-black">
      {label}
    </span>
    {#if statusBadge}
      <NeoBadge variant={badgeVariant} size="sm">
        {statusBadge}
      </NeoBadge>
    {/if}
  </div>

  <div class="p-2 border-[2px] border-black bg-neutral-50 flex items-center justify-center min-h-[160px]">
    {#if data}
      <canvas bind:this={canvasEl} class="block max-w-full"></canvas>
    {:else}
      <div class="font-mono text-xs text-neutral-400 italic text-center p-4">
        QR Channel Inactive
      </div>
    {/if}
  </div>

  {#if renderError}
    <div class="text-[10px] font-mono text-red-600 font-bold mt-1">
      {renderError}
    </div>
  {/if}

  <div class="w-full mt-2 font-mono text-[11px] text-neutral-700 bg-neutral-100 px-2 py-1 border border-black/20 text-center truncate select-all">
    RAW: {data || 'EMPTY'}
  </div>
</div>
