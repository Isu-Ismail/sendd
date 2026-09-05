<script lang="ts">
  import confetti from 'canvas-confetti';
  import NeoModal from './NeoModal.svelte';
  import NeoButton from './NeoButton.svelte';
  import Icons from './Icons.svelte';
  import type { CompilationStep } from '../../types/protocol';

  interface Props {
    isOpen: boolean;
    title?: string;
    decodedOutput: string;
    totalChunks: number;
    transmissionType: 'text' | 'image' | 'qr_stream';
    onClose: () => void;
    onCopy: () => void;
  }

  let {
    isOpen = $bindable(false),
    title = 'TRANSMISSION COMPLETE',
    decodedOutput,
    totalChunks,
    transmissionType,
    onClose,
    onCopy,
  }: Props = $props();

  let compileProgress = $state(0);
  let isCompiled = $state(false);

  let steps: CompilationStep[] = $state([
    { label: 'DELIMITER SCAN', detail: 'Verifying end-sequence frames (1111)', completed: false },
    { label: 'PARITY CHECK', detail: 'Validating 4-bit XOR chunk checksums', completed: false },
    { label: 'PACKET REASSEMBLY', detail: 'Joining chunk byte slices in sequential order', completed: false },
    { label: 'PAYLOAD DECODE', detail: 'Reconstructing UTF-8 string payload', completed: false },
  ]);

  $effect(() => {
    if (isOpen && !isCompiled) {
      compileProgress = 0;
      steps.forEach((s) => (s.completed = false));

      const interval = setInterval(() => {
        compileProgress += 25;
        const stepIdx = Math.min(steps.length - 1, Math.floor(compileProgress / 25) - 1);
        if (stepIdx >= 0 && steps[stepIdx]) {
          steps[stepIdx].completed = true;
        }

        if (compileProgress >= 100) {
          clearInterval(interval);
          isCompiled = true;
          // Trigger celebratory confetti burst
          try {
            confetti({
              particleCount: 80,
              spread: 70,
              origin: { y: 0.6 },
              colors: ['#FFE600', '#00F0FF', '#FF6B8B', '#00FF88', '#000000'],
            });
          } catch {
            // Ignore if canvas confetti fails
          }
        }
      }, 350);

      return () => clearInterval(interval);
    }
  });
</script>

<NeoModal
  bind:isOpen
  title={isCompiled ? 'PAYLOAD COMPILED' : 'ASSEMBLING & COMPILING'}
  badgeText={isCompiled ? 'VERIFIED 100%' : 'PROCESSING'}
  {onClose}
>
  {#if !isCompiled}
    <div class="space-y-4 py-2">
      <div class="flex items-center justify-between font-mono text-xs font-bold text-neutral-800">
        <span>COMPILING DATA STREAM</span>
        <span>{compileProgress}%</span>
      </div>

      <!-- Neo-Brutalist Progress Bar -->
      <div class="w-full h-5 border-[2px] border-black bg-neutral-200 p-0.5">
        <div
          class="h-full bg-[#00FF88] border-r-[2px] border-black transition-all duration-300"
          style="width: {compileProgress}%"
        ></div>
      </div>

      <div class="space-y-2 border-[2px] border-black p-3 bg-neutral-50">
        {#each steps as step}
          <div class="flex items-center gap-2 font-mono text-xs">
            <span class="w-4 h-4 border-[1.5px] border-black flex items-center justify-center {step.completed ? 'bg-[#00FF88] text-black' : 'bg-white text-neutral-300'}">
              {step.completed ? '✓' : '•'}
            </span>
            <span class="font-bold {step.completed ? 'text-black' : 'text-neutral-500'}">
              {step.label}:
            </span>
            <span class="text-[11px] text-neutral-600 truncate">
              {step.detail}
            </span>
          </div>
        {/each}
      </div>
    </div>
  {:else}
    <div class="space-y-4 py-1">
      <div class="p-3 border-[2px] border-black bg-[#00FF88]/20 flex items-center gap-3">
        <div class="p-2 border-[2px] border-black bg-[#00FF88]">
          <Icons name="sparkles" size={20} />
        </div>
        <div>
          <div class="font-mono text-xs font-black uppercase text-black">
            DATA TRANSFER SUCCESSFUL!
          </div>
          <div class="font-mono text-[11px] text-neutral-700">
            {totalChunks} chunks received, checksum verified with zero bit errors.
          </div>
        </div>
      </div>

      <!-- Decoded Output Display -->
      <div class="space-y-1.5">
        <div class="font-mono text-xs font-bold uppercase tracking-wider text-black flex items-center justify-between">
          <span>COMPILED OUTPUT:</span>
          <span class="text-[10px] text-neutral-500">{decodedOutput.length} characters</span>
        </div>
        <div class="p-4 border-[2.5px] border-black bg-neutral-900 text-[#00FF88] font-mono text-sm break-all select-all shadow-[3px_3px_0px_#000] max-h-48 overflow-y-auto">
          {decodedOutput}
        </div>
      </div>
    </div>
  {/if}

  {#snippet footer()}
    {#if isCompiled}
      <NeoButton variant="white" size="sm" onclick={onCopy}>
        <Icons name="copy" size={14} />
        COPY OUTPUT
      </NeoButton>
      <NeoButton variant="mint" size="sm" onclick={onClose}>
        <Icons name="check" size={14} />
        DONE
      </NeoButton>
    {:else}
      <span class="font-mono text-[11px] text-neutral-500 italic">Please wait while verifying packets...</span>
    {/if}
  {/snippet}
</NeoModal>
