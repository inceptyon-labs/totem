<script lang="ts">
  import type { Totem } from '$lib/totems.svelte';
  import { totemsStore, sortTotems } from '$lib/totems.svelte';
  import { applyDrop } from '$lib/dragOrder';
  import { matchesFilter } from '$lib/filter';
  import { client } from '$lib/graphqlClient';
  import { ui } from '$lib/uiState.svelte';
  import { typeBorders } from '$lib/styles';
  import { fade } from 'svelte/transition';
  import { ArchiveTotemDocument } from '$lib/graphql/generated';
  import TotemCard from './TotemCard.svelte';
  import ConfirmModal from './ConfirmModal.svelte';

  interface Props {
    onSelect?: (totem: Totem) => void;
    selectedId?: string | null;
  }

  let { onSelect, selectedId = null }: Props = $props();

  let confirmingArchiveAll = $state(false);
  let archivingAll = $state(false);

  async function archiveAll() {
    archivingAll = true;
    const completedTotems = totemsForStatus('completed');
    for (const totem of completedTotems) {
      await client.mutation(ArchiveTotemDocument, { id: totem.id }).toPromise();
    }
    archivingAll = false;
    confirmingArchiveAll = false;
  }

  const columns = [
    { status: 'todo', label: 'Todo', color: 'bg-status-todo-bg text-status-todo-text' },
    {
      status: 'in-progress',
      label: 'In Progress',
      color: 'bg-status-in-progress-bg text-status-in-progress-text'
    },
    {
      status: 'completed',
      label: 'Completed',
      color: 'bg-status-completed-bg text-status-completed-text'
    }
  ];

  function totemsForStatus(status: string): Totem[] {
    // sortTotems already handles order → priority → type → title sorting
    return sortTotems(
      totemsStore.all.filter(
        (b) => b.status === status && b.status !== 'scrapped' && matchesFilter(b, ui.filterText)
      )
    );
  }

  // Drag and drop
  let draggedTotemId = $state<string | null>(null);
  let dropTargetStatus = $state<string | null>(null);
  let dropIndex = $state<number | null>(null);

  function onDragStart(e: DragEvent, totem: Totem) {
    draggedTotemId = totem.id;
    e.dataTransfer!.effectAllowed = 'move';
    e.dataTransfer!.setData('text/plain', totem.id);
  }

  function onDragEnd() {
    draggedTotemId = null;
    dropTargetStatus = null;
    dropIndex = null;
  }

  function onCardDragOver(e: DragEvent, status: string, index: number) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer!.dropEffect = 'move';
    dropTargetStatus = status;

    // Determine if we're in the top or bottom half of the card
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    dropIndex = e.clientY < midY ? index : index + 1;
  }

  function onColumnDragOver(e: DragEvent, status: string, totemCount: number) {
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';
    dropTargetStatus = status;
    // If dragging over empty space at the bottom, drop at end
    if (dropIndex === null || dropTargetStatus !== status) {
      dropIndex = totemCount;
    }
  }

  function onDragLeave(e: DragEvent, columnEl: HTMLElement) {
    if (!columnEl.contains(e.relatedTarget as Node)) {
      dropTargetStatus = null;
      dropIndex = null;
    }
  }

  function onDrop(e: DragEvent, targetStatus: string, totems: Totem[]) {
    e.preventDefault();
    const targetIdx = dropIndex;
    dropTargetStatus = null;
    dropIndex = null;

    const totemId = draggedTotemId;
    draggedTotemId = null;

    if (!totemId) return;

    applyDrop(totems, totemId, targetIdx ?? totems.length, { newStatus: targetStatus });
  }
</script>

<div class="min-h-0 flex-1 overflow-auto bg-surface-alt px-4 pt-4">
  <div class="flex w-full max-w-4xl min-w-0 items-start">
  {#each columns as col (col.status)}
    {@const totems = totemsForStatus(col.status)}
    <div class="min-w-50 flex-1" data-status={col.status}>
      <!-- Column header -->
      <div class="sticky top-0 z-10 mb-3 flex items-center gap-2 bg-surface-alt px-1 pb-1">
        <span class={['badge', col.color]}
          >{col.label}</span
        >
        <span class="text-xs text-text-faint">{totems.length}</span>
        {#if col.status === 'completed' && totems.length > 0}
          <button
            class="cursor-pointer text-text-faint transition-colors hover:text-text-muted"
            title="Archive all completed totems"
            onclick={() => (confirmingArchiveAll = true)}
            disabled={archivingAll}
          >
            <span class="icon-[uil--archive] size-3.5"></span>
          </button>
        {/if}
      </div>

      <!-- Cards (drop zone) -->
      <div
        class={[
          'rounded-xl p-2 transition-colors',
          dropTargetStatus === col.status && draggedTotemId && 'bg-accent/10 ring-2 ring-accent/30'
        ]}
        role="list"
        ondragover={(e) => onColumnDragOver(e, col.status, totems.length)}
        ondragleave={(e) => onDragLeave(e, e.currentTarget)}
        ondrop={(e) => onDrop(e, col.status, totems)}
      >
        {#each totems as totem, index (totem.id)}
          <!-- Drop indicator (always present, transparent unless active) -->
          <div
            class={[
              'mx-1 my-1 h-0.5 rounded-full transition-colors',
              dropTargetStatus === col.status &&
              draggedTotemId &&
              draggedTotemId !== totem.id &&
              dropIndex === index
                ? 'bg-accent'
                : 'bg-transparent'
            ]}
          ></div>

          <div
            class={[
              'overflow-hidden rounded border border-l-5 border-border bg-surface shadow transition-all',
              typeBorders[totem.type] ?? 'border-l-type-task-border',
              draggedTotemId === totem.id ? 'opacity-40' : 'hover:shadow-md',
              selectedId === totem.id && 'bg-accent/5 ring-1 ring-accent'
            ]}
            draggable="true"
            ondragstart={(e) => onDragStart(e, totem)}
            ondragend={onDragEnd}
            ondragover={(e) => onCardDragOver(e, col.status, index)}
            role="listitem"
            transition:fade={{ duration: 150 }}
          >
            <TotemCard {totem} variant="board" onclick={() => onSelect?.(totem)} />
          </div>
        {:else}
          <div class="text-center text-text-faint text-sm py-8">No totems</div>
        {/each}

        <!-- Drop indicator at end (always present) -->
        <div
          class={[
            'mx-1 my-1 h-0.5 rounded-full transition-colors',
            dropTargetStatus === col.status && draggedTotemId && dropIndex === totems.length
              ? 'bg-accent'
              : 'bg-transparent'
          ]}
        ></div>
      </div>
    </div>
  {/each}
  </div>
</div>

{#if confirmingArchiveAll}
  {@const completedCount = totemsForStatus('completed').length}
  <ConfirmModal
    title="Archive All Completed"
    message="Are you sure you want to archive all {completedCount} completed totems? This will move them to the archive directory."
    confirmLabel="Archive All"
    danger={false}
    onConfirm={archiveAll}
    onCancel={() => (confirmingArchiveAll = false)}
  />
{/if}
