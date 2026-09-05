<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    variant?: 'yellow' | 'cyan' | 'pink' | 'mint' | 'orange' | 'white' | 'black';
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
    type?: 'button' | 'submit' | 'reset';
    className?: string;
    onclick?: (e: MouseEvent) => void;
    children?: Snippet;
  }

  let {
    variant = 'yellow',
    size = 'md',
    disabled = false,
    type = 'button',
    className = '',
    onclick,
    children,
  }: Props = $props();

  const variantStyles = {
    yellow: 'bg-[#FFE600] text-black hover:bg-[#ffe81a]',
    cyan: 'bg-[#00F0FF] text-black hover:bg-[#33f3ff]',
    pink: 'bg-[#FF6B8B] text-black hover:bg-[#ff859f]',
    mint: 'bg-[#00FF88] text-black hover:bg-[#33ff9f]',
    orange: 'bg-[#FF8400] text-black hover:bg-[#ff9526]',
    white: 'bg-white text-black hover:bg-neutral-100',
    black: 'bg-black text-white hover:bg-neutral-800',
  };

  const sizeStyles = {
    sm: 'px-2.5 py-1 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };
</script>

<button
  {type}
  {disabled}
  {onclick}
  class="neo-btn inline-flex items-center justify-center gap-2 border-[2.5px] border-black font-mono font-bold uppercase tracking-wider transition-all duration-75 {variantStyles[variant]} {sizeStyles[size]} {className}"
>
  {#if children}
    {@render children()}
  {/if}
</button>
