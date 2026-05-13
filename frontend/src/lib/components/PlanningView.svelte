<script lang="ts">
  import { totemsStore } from '$lib/totems.svelte';
  import { ui } from '$lib/uiState.svelte';

  let { planningView }: { planningView: 'backlog' | 'board' } = $props();
  import { backlogDrag } from '$lib/backlogDrag.svelte';
  import { matchesFilter } from '$lib/filter';
  import TotemItem from '$lib/components/TotemItem.svelte';
  import BoardView from '$lib/components/BoardView.svelte';
  import TotemPane from '$lib/components/TotemPane.svelte';
  import SplitPane from '$lib/components/SplitPane.svelte';
  import FilterInput from '$lib/components/FilterInput.svelte';
  import ViewToolbar from '$lib/components/ViewToolbar.svelte';

  let filterInput = $state<FilterInput | null>(null);

  const topLevelTotems = $derived(totemsStore.all.filter((b) => !b.parentId));

  function filterTotems(totems: typeof topLevelTotems) {
    const text = ui.filterText;
    if (!text) return totems;
    return totems.filter((totem) => {
      if (matchesFilter(totem, text)) return true;
      return totemsStore.children(totem.id).some((child) => matchesFilter(child, text));
    });
  }

  const filteredTodoTotems = $derived(filterTotems(topLevelTotems.filter((b) => b.status === 'todo')));
  const filteredDraftTotems = $derived(
    filterTotems(topLevelTotems.filter((b) => b.status === 'draft'))
  );

  function handleKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && (e.key === 'f' || e.key === '/')) {
      e.preventDefault();
      filterInput?.focus();
      return;
    }
    if (e.key === 'Escape' && ui.currentTotem && !ui.showForm) {
      ui.clearSelection();
    }
  }

  function handlePlanningClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      ui.clearSelection();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="flex h-full flex-col">
  <ViewToolbar showPanelToggles={false}>
    <div class="flex">
      <button
        onclick={() => ui.navigateToPlanningView('backlog')}
        class={[
          'btn-tab rounded-l-md',
          planningView === 'backlog' ? 'btn-tab-active' : 'btn-tab-inactive'
        ]}
      >
        Backlog
      </button>
      <button
        onclick={() => ui.navigateToPlanningView('board')}
        class={[
          'btn-tab rounded-r-md border-l-0',
          planningView === 'board' ? 'btn-tab-active' : 'btn-tab-inactive'
        ]}
      >
        Board
      </button>
    </div>
    <div class="mx-3 w-60">
      <FilterInput bind:this={filterInput} />
    </div>
    {#snippet right()}
      <button class="btn-primary" onclick={() => ui.openCreateForm()}>+ New Totem</button>
    {/snippet}
  </ViewToolbar>

  <div class="flex min-h-0 flex-1 overflow-hidden">
    {#snippet backlogBoard()}
        <div class="flex h-full flex-col bg-surface">
          {#if planningView === 'backlog'}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="min-h-0 flex-1 overflow-auto bg-surface-alt" onclick={handlePlanningClick}>
              {#snippet backlogSection(totems: typeof filteredTodoTotems, status: string, label: string)}
                <div
                  class="p-3"
                  ondragover={(e) => backlogDrag.hoverList(e, null, totems.length, status)}
                  ondragleave={(e) => backlogDrag.leaveList(e, e.currentTarget, null)}
                  ondrop={(e) => backlogDrag.drop(e, null, totems)}
                  role="list"
                >
                  <h3 class="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-text-faint">
                    {label}
                    <span class="font-normal">{totems.length}</span>
                  </h3>
                  {#each totems as totem, i (totem.id)}
                    <TotemItem
                      {totem}
                      parentId={null}
                      index={i}
                      selectedId={ui.currentTotem?.id}
                      onSelect={(b) => ui.selectTotem(b)}
                      filterText={ui.filterText}
                      sectionStatus={status}
                    />
                  {:else}
                    {#if !totemsStore.loading}
                      <p class="text-center py-4 text-sm text-text-muted">No totems</p>
                    {/if}
                  {/each}

                  <div
                    class={[
                      'mx-1 rounded-full transition-colors',
                      backlogDrag.showEndIndicator(null, totems.length, status)
                        ? 'h-0.5 bg-accent'
                        : 'h-0'
                    ]}
                  ></div>
                </div>
              {/snippet}

              {@render backlogSection(filteredTodoTotems, 'todo', 'Todo')}
              {@render backlogSection(filteredDraftTotems, 'draft', 'Draft')}
            </div>
          {:else}
            <BoardView onSelect={(b) => ui.selectTotem(b)} selectedId={ui.currentTotem?.id} />
          {/if}
        </div>
      {/snippet}

      {#snippet detailPanel()}
        {#if ui.currentTotem}
          <TotemPane
            totem={ui.currentTotem}
            onSelect={(b) => ui.selectTotem(b)}
            onEdit={(b) => ui.openEditForm(b)}
            onClose={() => ui.clearSelection()}
          />
        {/if}
      {/snippet}

      <SplitPane
        direction="horizontal"
        panels={[
          { content: backlogBoard },
          {
            content: detailPanel,
            size: 480,
            collapsed: !ui.currentTotem,
            persistKey: 'detail-width'
          }
        ]}
      />
  </div>
</div>
