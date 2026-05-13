<script lang="ts">
  import type { Totem } from '$lib/totems.svelte';
  import { totemsStore } from '$lib/totems.svelte';
  import { backlogDrag } from '$lib/backlogDrag.svelte';
  import { matchesFilter } from '$lib/filter';
  import TotemCard from './TotemCard.svelte';
  import TotemItem from './TotemItem.svelte';

  interface Props {
    totem: Totem;
    /** Parent ID of this totem's sibling group (null = top-level) */
    parentId?: string | null;
    index?: number;
    depth?: number;
    selectedId?: string | null;
    onSelect?: (totem: Totem) => void;
    filterText?: string;
    /** Status of the backlog section this totem is in (for cross-section drag) */
    sectionStatus?: string;
  }

  let {
    totem,
    parentId = null,
    index = 0,
    depth = 0,
    selectedId = null,
    onSelect,
    filterText = '',
    sectionStatus
  }: Props = $props();

  const children = $derived(totemsStore.children(totem.id));
  const filteredChildren = $derived(
    filterText ? children.filter((child) => matchesFilter(child, filterText)) : children
  );

  function handleClick(e: MouseEvent) {
    e.stopPropagation();
    onSelect?.(totem);
  }
</script>

<div class="totem-item my-1" data-totem-id={totem.id}>
  <!-- Drop indicator before this card -->
  <div
    class={[
      'mx-1 rounded-full transition-colors',
      backlogDrag.showIndicator(parentId, index, totem.id, sectionStatus) ? 'h-0.5 bg-accent' : 'h-0'
    ]}
  ></div>

  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class={[
      'rounded transition-all',
      backlogDrag.draggedTotemId === totem.id && 'opacity-40',
      backlogDrag.isReparentTarget(totem.id) && 'ring-2 ring-accent ring-offset-1'
    ]}
    draggable="true"
    ondragstart={(e) => backlogDrag.startDrag(e, totem)}
    ondragend={() => backlogDrag.endDrag()}
    ondragover={(e) => backlogDrag.hoverCard(e, parentId, index, totem.id, sectionStatus)}
    onclick={handleClick}
  >
    <TotemCard
      {totem}
      variant="list"
      selected={selectedId === totem.id}
      onclick={() => onSelect?.(totem)}
    />
  </div>

  {#if filteredChildren.length > 0}
    <div
      class="ml-6"
      ondragover={(e) => backlogDrag.hoverList(e, totem.id, filteredChildren.length)}
      ondragleave={(e) => backlogDrag.leaveList(e, e.currentTarget, totem.id)}
      ondrop={(e) => backlogDrag.drop(e, totem.id, filteredChildren)}
      role="list"
    >
      {#each filteredChildren as child, i (child.id)}
        <TotemItem
          totem={child}
          parentId={totem.id}
          index={i}
          depth={depth + 1}
          {selectedId}
          {onSelect}
          {filterText}
          {sectionStatus}
        />
      {/each}

      <!-- Drop indicator at end of children -->
      <div
        class={[
          'mx-1 rounded-full transition-colors',
          backlogDrag.showEndIndicator(totem.id, filteredChildren.length)
            ? 'h-0.5 bg-accent'
            : 'h-0'
        ]}
      ></div>
    </div>
  {/if}
</div>
