<script lang="ts">
  import type { ToastNotification } from '../../types/protocol';
  import Icons from './Icons.svelte';

  interface Props {
    toasts: ToastNotification[];
    onDismiss: (id: string) => void;
  }

  let { toasts, onDismiss }: Props = $props();

  const typeConfig = {
    info: { bg: 'bg-[#00F0FF]', text: 'text-black', icon: 'terminal' as const },
    success: { bg: 'bg-[#00FF88]', text: 'text-black', icon: 'check' as const },
    warning: { bg: 'bg-[#FFE600]', text: 'text-black', icon: 'alert' as const },
    error: { bg: 'bg-[#FF6B8B]', text: 'text-black', icon: 'alert' as const },
  };
</script>

<div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-3">
  {#each toasts as toast (toast.id)}
    <div
      class="pointer-events-auto border-[2.5px] border-black shadow-[4px_4px_0px_#000] p-3 flex items-start justify-between gap-3 bg-white animate-slide-up"
    >
      <div class="flex items-start gap-2.5">
        <div class="p-1 border-[1.5px] border-black {typeConfig[toast.type].bg}">
          <Icons name={typeConfig[toast.type].icon} size={14} />
        </div>
        <div class="space-y-0.5">
          <div class="font-mono text-xs font-black uppercase tracking-wider text-black">
            {toast.title}
          </div>
          <div class="font-mono text-[11px] text-neutral-700 leading-tight">
            {toast.message}
          </div>
        </div>
      </div>

      <button
        onclick={() => onDismiss(toast.id)}
        aria-label="Dismiss toast"
        class="text-neutral-500 hover:text-black hover:bg-neutral-100 p-0.5"
      >
        <Icons name="x" size={14} />
      </button>
    </div>
  {/each}
</div>
