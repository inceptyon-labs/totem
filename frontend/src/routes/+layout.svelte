<script lang="ts">
  import './layout.css';
  import favicon from '$lib/assets/favicon.svg';
  import { preloadHighlighter } from '$lib/markdown';
  import { page } from '$app/state';
  import { onMount, onDestroy } from 'svelte';
  import { totemsStore } from '$lib/totems.svelte';
  import { worktreeStore, MAIN_WORKSPACE_ID } from '$lib/worktrees.svelte';
  import { agentStatusesStore } from '$lib/agentStatuses.svelte';
  import { configStore } from '$lib/config.svelte';
  import { ui } from '$lib/uiState.svelte';
  import TotemForm from '$lib/components/TotemForm.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import SplitPane from '$lib/components/SplitPane.svelte';

  preloadHighlighter();

  let { data, children } = $props();

  // Initialize UI state from load function data (runs before first render)
  $effect.pre(() => {
    ui.showPlanningChat = data.showPlanningChat;
    ui.showChanges = data.showChanges;
    ui.filterText = data.filterText;
  });

  // Sync UIState from URL path on every navigation
  $effect(() => {
    ui.syncFromUrl(page.url.pathname);
  });

  // Hydrate initial totem selection from URL ?totem= param (once, after activeView is set)
  let initialTotemApplied = false;
  $effect(() => {
    if (!initialTotemApplied && data.selectedTotemId) {
      initialTotemApplied = true;
      ui.selectTotemById(data.selectedTotemId);
    }
  });

  // Fall back to planning view if agents are disabled or the workspace's worktree is removed.
  // Wait for worktreeStore to initialize before checking — otherwise a cold page load
  // to a workspace route would redirect before the subscription delivers data.
  $effect(() => {
    if (
      !ui.isPlanning &&
      worktreeStore.initialized &&
      (!configStore.agentEnabled || (ui.activeView !== MAIN_WORKSPACE_ID && !worktreeStore.hasWorktree(ui.activeView)))
    ) {
      ui.navigateTo('planning');
    }
  });

  onMount(() => {
    configStore.load();
    totemsStore.subscribe();
    worktreeStore.subscribe();
    agentStatusesStore.subscribe();
  });

  onDestroy(() => {
    totemsStore.unsubscribe();
    worktreeStore.unsubscribe();
    agentStatusesStore.unsubscribe();
  });
</script>

<svelte:head>
  <title>{configStore.projectName ? `${configStore.projectName} — Totem` : 'Totem'}</title>
  <link rel="icon" href={favicon} />
</svelte:head>

<div class="flex h-screen flex-col bg-surface-alt">
  {#if totemsStore.error}
    <div class="m-4">
      <div class="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
        Error: {totemsStore.error}
      </div>
    </div>
  {:else}
    {#snippet sidebarPanel()}
      <Sidebar />
    {/snippet}

    {#snippet mainContent()}
      {@render children()}
    {/snippet}

    <SplitPane
      direction="horizontal"
      panels={[
        { content: sidebarPanel, size: 224, minSize: 150, maxSize: 400, persistKey: 'sidebar' },
        { content: mainContent }
      ]}
    />
  {/if}
</div>

{#if ui.showForm}
  <TotemForm
    totem={ui.editingTotem}
    onClose={() => ui.closeForm()}
    onSaved={(totem) => ui.selectTotem(totem)}
  />
{/if}
