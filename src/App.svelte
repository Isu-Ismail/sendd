<script lang="ts">
  import { onMount } from 'svelte';
  import TextScreen from './components/screens/TextScreen.svelte';
  import ImageScreen from './components/screens/ImageScreen.svelte';
  import QrStreamScreen from './components/screens/QrStreamScreen.svelte';
  import NeoButton from './components/common/NeoButton.svelte';
  import NeoBadge from './components/common/NeoBadge.svelte';
  import NeoModal from './components/common/NeoModal.svelte';
  import NeoToast from './components/common/NeoToast.svelte';
  import Icons from './components/common/Icons.svelte';

  import type { TransmissionMode, ToastNotification } from './types/protocol';

  // Active Screen Tab: 'text' | 'image' | 'qr_stream'
  let activeTab: TransmissionMode = $state('text');

  // Custom Notifications / Popups (Zero browser alert())
  let toasts: ToastNotification[] = $state([]);
  let isHelpModalOpen = $state(false);

  function addToast(toast: Omit<ToastNotification, 'id' | 'timestamp'>): void {
    const newToast: ToastNotification = {
      ...toast,
      id: Math.random().toString(36).slice(2, 9),
      timestamp: Date.now(),
    };
    toasts = [...toasts, newToast];

    setTimeout(() => {
      dismissToast(newToast.id);
    }, 4500);
  }

  function dismissToast(id: string): void {
    toasts = toasts.filter((t) => t.id !== id);
  }

  onMount(() => {
    addToast({
      title: 'PROJECT SENDD INITIALIZED',
      message: 'Air-gapped optical communication protocol ready.',
      type: 'info',
    });
  });
</script>

<main class="min-h-screen pb-16">
  <!-- Top Navigation / Brand Header Bar -->
  <header class="border-b-[3px] border-black bg-white sticky top-0 z-40 shadow-[0_4px_0px_#000]">
    <div class="max-w-7xl mx-auto px-4 py-2.5 flex flex-col md:flex-row items-center justify-between gap-3">
      <!-- Logo & Title -->
      <div class="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 border-[2.5px] border-black bg-[#FFE600] flex items-center justify-center shadow-[2px_2px_0px_#000]">
            <Icons name="flashlight" size={20} />
          </div>
          <div>
            <div class="flex items-center gap-1.5">
              <span class="font-mono text-xl font-black tracking-tight text-black">sendd</span>
              <span class="px-1.5 py-0.2 border-[1.5px] border-black bg-[#00FF88] text-[10px] font-mono font-black">
                v1.0
              </span>
            </div>
            <div class="font-mono text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
              Air-Gapped Optical Data Transfer
            </div>
          </div>
        </div>

        <button
          onclick={() => (isHelpModalOpen = true)}
          aria-label="Open Protocol Guide"
          class="md:hidden p-1.5 border-[2px] border-black bg-[#00F0FF] shadow-[2px_2px_0px_#000]"
        >
          <Icons name="terminal" size={16} />
        </button>
      </div>

      <!-- Protocol Status Badges -->
      <div class="hidden sm:flex items-center gap-2">
        <NeoBadge variant="yellow" size="sm">
          OOK BINARY
        </NeoBadge>
        <NeoBadge variant="cyan" size="sm">
          ARQ QR LOOP
        </NeoBadge>
        <NeoBadge variant="mint" size="sm">
          ZERO WI-FI / BLE
        </NeoBadge>
      </div>

      <!-- Action Button -->
      <div class="hidden md:flex items-center gap-2">
        <NeoButton variant="cyan" size="sm" onclick={() => (isHelpModalOpen = true)}>
          <Icons name="terminal" size={14} />
          PROTOCOL GUIDE
        </NeoButton>
      </div>
    </div>
  </header>

  <!-- Main Container -->
  <div class="max-w-7xl mx-auto px-4 pt-6 space-y-6">
    <!-- Screen Tabs Switcher (One Page Architecture) -->
    <div class="grid grid-cols-3 gap-2 sm:gap-3 p-1.5 border-[2.5px] border-black bg-white shadow-[4px_4px_0px_#000]">
      <button
        onclick={() => (activeTab = 'text')}
        class="py-2.5 px-2 border-[2px] border-black font-mono text-xs sm:text-sm font-black uppercase tracking-wider flex items-center justify-center gap-1.5 sm:gap-2 transition-all duration-75 {activeTab === 'text' ? 'bg-[#FFE600] shadow-[3px_3px_0px_#000] translate-x-[-1px] translate-y-[-1px]' : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-700'}"
      >
        <Icons name="text" size={16} />
        <span class="truncate">OPTICAL TEXT</span>
      </button>

      <button
        onclick={() => (activeTab = 'image')}
        class="py-2.5 px-2 border-[2px] border-black font-mono text-xs sm:text-sm font-black uppercase tracking-wider flex items-center justify-center gap-1.5 sm:gap-2 transition-all duration-75 {activeTab === 'image' ? 'bg-[#FF6B8B] text-black shadow-[3px_3px_0px_#000] translate-x-[-1px] translate-y-[-1px]' : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-700'}"
      >
        <Icons name="image" size={16} />
        <span class="truncate">PIXEL ART</span>
      </button>

      <button
        onclick={() => (activeTab = 'qr_stream')}
        class="py-2.5 px-2 border-[2px] border-black font-mono text-xs sm:text-sm font-black uppercase tracking-wider flex items-center justify-center gap-1.5 sm:gap-2 transition-all duration-75 {activeTab === 'qr_stream' ? 'bg-[#00F0FF] text-black shadow-[3px_3px_0px_#000] translate-x-[-1px] translate-y-[-1px]' : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-700'}"
      >
        <Icons name="qr" size={16} />
        <span class="truncate">SEND QR STREAM</span>
      </button>
    </div>

    <!-- Active Screen Rendering -->
    {#if activeTab === 'text'}
      <TextScreen onNotify={addToast} />
    {:else if activeTab === 'image'}
      <ImageScreen onNotify={addToast} />
    {:else if activeTab === 'qr_stream'}
      <QrStreamScreen onNotify={addToast} />
    {/if}
  </div>

  <!-- Custom Floating Popups / Toasts Container (Replaces browser alert()) -->
  <NeoToast {toasts} onDismiss={dismissToast} />

  <!-- Protocol Guide & Help Modal -->
  <NeoModal
    bind:isOpen={isHelpModalOpen}
    title="SENDD PROTOCOL ARCHITECTURE"
    badgeText="AIR-GAP SPEC"
    onClose={() => (isHelpModalOpen = false)}
  >
    <div class="space-y-4">
      <div class="p-3 border-[2px] border-black bg-[#FFE600]/20 text-black">
        <span class="font-black">HOW THE OPTICAL LOOP WORKS:</span>
        <p class="mt-1 text-neutral-700 leading-relaxed">
          <strong>sendd</strong> transmits data across completely isolated devices using light pulses and camera feedback — zero internet, Bluetooth, or local network pairing required!
        </p>
      </div>

      <div class="border-[2px] border-black p-3 bg-neutral-900 text-white font-mono text-[11px] space-y-2">
        <div class="text-[#00FF88] font-bold">PHYSICAL GEOMETRY:</div>
        <div>1. 📱 <strong>Phone Back Flashlight</strong> points at 💻 <strong>Laptop Webcam</strong>.</div>
        <div>2. 📱 <strong>Phone Front (Selfie) Camera</strong> looks at 💻 <strong>Laptop Screen</strong>.</div>
        <div>3. Phone turns flashlight ON/OFF to send binary packets (1 = Light ON, 0 = Light OFF).</div>
        <div>4. Laptop webcam measures brightness, validates checksum, and renders a live QR: <code class="text-[#FFE600]">ACK:CHUNK_X</code>.</div>
        <div>5. Phone selfie camera instantly reads the QR code and advances to the next chunk!</div>
      </div>

      <div class="border-[1.5px] border-black p-2.5 bg-neutral-50 space-y-1">
        <span class="font-bold uppercase text-black">PACKET INTEGRITY & ARQ:</span>
        <p class="text-neutral-600 text-[11px]">
          Every chunk includes a 6-bit preamble (<code class="bg-neutral-200 px-1">101010</code>), chunk index, byte payload, 4-bit XOR parity checksum, and a 4-bit delimiter end sequence (<code class="bg-neutral-200 px-1">1111</code>). If corrupted, the laptop flags it as missing and the phone automatically retransmits.
        </p>
      </div>
    </div>

    {#snippet footer()}
      <NeoButton variant="yellow" size="sm" onclick={() => (isHelpModalOpen = false)}>
        UNDERSTOOD
      </NeoButton>
    {/snippet}
  </NeoModal>
</main>
