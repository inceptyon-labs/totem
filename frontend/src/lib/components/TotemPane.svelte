<script lang="ts">
  import type { Totem } from '$lib/totems.svelte';
  import TotemDetail from './TotemDetail.svelte';

  interface Props {
    totem: Totem;
    onSelect?: (totem: Totem) => void;
    onEdit?: (totem: Totem) => void;
    onClose?: () => void;
  }

  let { totem, onSelect, onEdit, onClose }: Props = $props();
</script>

<div class="flex h-full flex-col bg-surface">
  <div class="pane-toolbar">
    <span>Totem</span>
    <div class="flex-1"></div>
    {#if onClose}
      <button onclick={onClose} class="btn-icon" title="Close"> &#x2715; </button>
    {/if}
  </div>

  <div class="min-h-0 flex-1">
    <TotemDetail {totem} {onSelect} {onEdit} />
  </div>
</div>
