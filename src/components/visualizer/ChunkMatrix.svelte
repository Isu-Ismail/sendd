<script lang="ts">
  import type { ChunkPacket } from '../../types/protocol';

  interface Props {
    chunks: ChunkPacket[];
    activeChunkIndex?: number;
    className?: string;
  }

  let { chunks, activeChunkIndex = -1, className = '' }: Props = $props();

  const stateColors = {
    pending: 'bg-neutral-100 text-neutral-600 border-neutral-300',
    transmitting: 'bg-[#FFE600] text-black border-black animate-pulse font-black shadow-[2px_2px_0px_#000]',
    acked: 'bg-[#00FF88] text-black border-black font-black',
    missing: 'bg-[#FF8400] text-black border-black font-black animate-bounce',
    failed: 'bg-[#FF6B8B] text-black border-black font-black',
  };
</script>

<div class="border-[2px] border-black bg-white p-2.5 {className}">
  <div class="flex items-center justify-between pb-2 mb-2 border-b border-black/10">
    <span class="font-mono text-[10px] font-black uppercase tracking-wider text-black">
      CHUNK RECEPTION MATRIX
    </span>
    <span class="font-mono text-[10px] font-bold text-neutral-600">
      {chunks.filter((c) => c.state === 'acked').length} / {chunks.length} ACK'D
    </span>
  </div>

  {#if chunks.length === 0}
    <div class="py-4 text-center font-mono text-xs text-neutral-400 italic">
      No chunks configured. Enter text or payload to initialize.
    </div>
  {:else}
    <div class="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-1.5 max-h-36 overflow-y-auto pr-1">
      {#each chunks as chunk (chunk.id)}
        <div
          class="flex flex-col items-center justify-center p-1 border-[1.5px] transition-all duration-100 {stateColors[chunk.state]} {activeChunkIndex === chunk.id ? 'ring-2 ring-black' : ''}"
          title="Chunk #{chunk.id}: '{chunk.payload}' (Status: {chunk.state})"
        >
          <span class="font-mono text-[10px] leading-none">#{chunk.id}</span>
          <span class="font-mono text-[9px] uppercase tracking-tighter truncate max-w-full mt-0.5">
            {chunk.state === 'acked' ? '✓' : chunk.state === 'transmitting' ? '⚡' : chunk.payload.slice(0, 2)}
          </span>
        </div>
      {/each}
    </div>
  {/if}
</div>
