<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    variant?: 'yellow' | 'cyan' | 'pink' | 'mint' | 'orange' | 'white' | 'black';
    size?: 'sm' | 'md';
    className?: string;
    children?: Snippet;
  }

  let {
    variant = 'yellow',
    size = 'sm',
    className = '',
    children,
  }: Props = $props();

  const variantStyles = {
    yellow: 'bg-[#FFE600] text-black border-black',
    cyan: 'bg-[#00F0FF] text-black border-black',
    pink: 'bg-[#FF6B8B] text-black border-black',
    mint: 'bg-[#00FF88] text-black border-black',
    orange: 'bg-[#FF8400] text-black border-black',
    white: 'bg-white text-black border-black',
    black: 'bg-black text-white border-black',
  };

  const sizeStyles = {
    sm: 'px-1.5 py-0.5 text-[10px]',
    md: 'px-2 py-1 text-xs',
  };
</script>

<span
  class="inline-flex items-center gap-1.5 border-[1.5px] font-mono font-bold uppercase tracking-wider select-none {variantStyles[variant]} {sizeStyles[size]} {className}"
>
  {#if children}
    {@render children()}
  {/if}
</span>
