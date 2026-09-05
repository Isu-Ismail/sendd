<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title?: string;
    subtitle?: string;
    badgeText?: string;
    badgeColor?: 'yellow' | 'cyan' | 'pink' | 'mint' | 'orange';
    className?: string;
    headerClass?: string;
    children?: Snippet;
    headerAction?: Snippet;
  }

  let {
    title,
    subtitle,
    badgeText,
    badgeColor = 'yellow',
    className = '',
    headerClass = '',
    children,
    headerAction,
  }: Props = $props();

  const badgeStyles = {
    yellow: 'bg-[#FFE600] text-black',
    cyan: 'bg-[#00F0FF] text-black',
    pink: 'bg-[#FF6B8B] text-black',
    mint: 'bg-[#00FF88] text-black',
    orange: 'bg-[#FF8400] text-black',
  };
</script>

<div class="bg-white border-[2.5px] border-black shadow-[4px_4px_0px_#000] flex flex-col {className}">
  {#if title}
    <div class="border-b-[2.5px] border-black px-3.5 py-2.5 flex items-center justify-between bg-neutral-50 {headerClass}">
      <div class="flex items-center gap-2">
        <span class="font-mono text-xs font-black uppercase tracking-wider text-neutral-900">{title}</span>
        {#if badgeText}
          <span class="px-1.5 py-0.5 border-[1.5px] border-black text-[10px] font-mono font-black uppercase tracking-wider {badgeStyles[badgeColor]}">
            {badgeText}
          </span>
        {/if}
      </div>

      {#if headerAction}
        <div>
          {@render headerAction()}
        </div>
      {/if}
    </div>
  {/if}

  {#if subtitle}
    <div class="px-3.5 py-1.5 border-b border-black/10 bg-neutral-100/60 font-mono text-[11px] text-neutral-600">
      {subtitle}
    </div>
  {/if}

  <div class="p-3.5 flex-1">
    {#if children}
      {@render children()}
    {/if}
  </div>
</div>
