<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icons from './Icons.svelte';

  interface Props {
    isOpen: boolean;
    title: string;
    badgeText?: string;
    onClose: () => void;
    children?: Snippet;
    footer?: Snippet;
  }

  let {
    isOpen = $bindable(false),
    title,
    badgeText,
    onClose,
    children,
    footer,
  }: Props = $props();

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && isOpen) {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
  <!-- Backdrop -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px] animate-fade-in"
    role="dialog"
    aria-modal="true"
  >
    <!-- Modal Window -->
    <div
      class="w-full max-w-lg bg-white border-[3px] border-black shadow-[8px_8px_0px_#000] flex flex-col overflow-hidden animate-scale-up"
    >
      <!-- Title Bar -->
      <div class="border-b-[3px] border-black bg-[#FFE600] px-4 py-3 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <span class="font-mono text-sm font-black uppercase tracking-wider text-black">{title}</span>
          {#if badgeText}
            <span class="px-2 py-0.5 border-[1.5px] border-black bg-black text-white text-[10px] font-mono font-black">
              {badgeText}
            </span>
          {/if}
        </div>
        <button
          onclick={onClose}
          aria-label="Close modal"
          class="p-1 border-[2px] border-black bg-white hover:bg-black hover:text-white transition-colors duration-75 shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5"
        >
          <Icons name="x" size={16} />
        </button>
      </div>

      <!-- Body Content -->
      <div class="p-5 max-h-[80vh] overflow-y-auto font-mono text-xs text-neutral-800 space-y-4">
        {#if children}
          {@render children()}
        {/if}
      </div>

      <!-- Footer Actions -->
      {#if footer}
        <div class="border-t-[2.5px] border-black bg-neutral-100 px-4 py-3 flex items-center justify-end gap-2.5">
          {@render footer()}
        </div>
      {/if}
    </div>
  </div>
{/if}
