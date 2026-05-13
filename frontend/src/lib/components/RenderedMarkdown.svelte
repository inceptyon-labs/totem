<script lang="ts">
  import { totemsStore } from '$lib/totems.svelte';
  import { ui } from '$lib/uiState.svelte';
  import { renderMarkdown } from '$lib/markdown';

  interface Props {
    content: string;
    class?: string;
  }

  let { content, class: className }: Props = $props();

  let renderedHtml = $state('');

  $effect(() => {
    if (content) {
      renderMarkdown(content).then((html) => {
        renderedHtml = html;
      });
    } else {
      renderedHtml = '';
    }
  });

  function handleTotemLinkClick(e: MouseEvent) {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-totem-id]');
    if (!target) return;
    e.preventDefault();
    const linkedTotem = totemsStore.get(target.dataset.totemId!);
    if (linkedTotem) ui.selectTotem(linkedTotem);
  }
</script>

{#if renderedHtml}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class={className} onclick={handleTotemLinkClick}>
    {@html renderedHtml}
  </div>
{/if}
