<script lang="ts">
  import type { Bean } from '$lib/beans.svelte';
  import BeanDetail from './BeanDetail.svelte';

  interface Props {
    bean: Bean;
    onSelect?: (bean: Bean) => void;
    onEdit?: (bean: Bean) => void;
    onClose?: () => void;
  }

  let { bean, onSelect, onEdit, onClose }: Props = $props();
</script>

<div class="flex h-full flex-col bg-surface">
  <div class="pane-toolbar">
    <span>Bean</span>
    <div class="flex-1"></div>
    {#if onClose}
      <button onclick={onClose} class="btn-icon" title="Close"> &#x2715; </button>
    {/if}
  </div>

  <div class="min-h-0 flex-1">
    <BeanDetail {bean} {onSelect} {onEdit} />
  </div>
</div>
