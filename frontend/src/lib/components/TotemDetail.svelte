<script lang="ts">
  import type { Totem } from '$lib/totems.svelte';
  import { totemsStore } from '$lib/totems.svelte';
  import { configStore } from '$lib/config.svelte';
  import { worktreeStore } from '$lib/worktrees.svelte';
  import { ui } from '$lib/uiState.svelte';
  import { statusColors, typeColors, priorityColors } from '$lib/styles';
  import { client } from '$lib/graphqlClient';
  import { SendAgentMessageDocument, UpdateTotemStatusDocument, ArchiveTotemDocument } from '$lib/graphql/generated';
  import TotemCard from './TotemCard.svelte';
  import RenderedMarkdown from './RenderedMarkdown.svelte';

  interface Props {
    totem: Totem;
    onSelect?: (totem: Totem) => void;
    onEdit?: (totem: Totem) => void;
  }

  let { totem, onSelect, onEdit }: Props = $props();

  const parent = $derived(totem.parentId ? totemsStore.get(totem.parentId) : null);
  const children = $derived(totemsStore.children(totem.id));
  const blocking = $derived(
    totem.blockingIds.map((id) => totemsStore.get(id)).filter((b): b is Totem => b !== undefined)
  );
  const blockedBy = $derived(totemsStore.blockedBy(totem.id));

  let copied = $state(false);

  function copyId() {
    navigator.clipboard.writeText(totem.id);
    copied = true;
    setTimeout(() => (copied = false), 1500);
  }

  const canStartWork = $derived(configStore.agentEnabled);

  let startingWork = $state(false);

  let worktreeError = $state<string | null>(null);

  const isArchivable = $derived(totem.status === 'completed' || totem.status === 'scrapped');
  let archiving = $state(false);

  async function archiveTotem() {
    archiving = true;
    const result = await client.mutation(ArchiveTotemDocument, { id: totem.id }).toPromise();
    if (result.error) {
      worktreeError = result.error.message;
    }
    archiving = false;
  }

  type WorkflowAction = { label: string; status: string; icon: string; iconColor: string };

  const workflowActions = $derived.by((): WorkflowAction[] => {
    switch (totem.status) {
      case 'draft':
        return [
          { label: 'Todo', status: 'todo', icon: 'icon-[uil--clipboard-notes]', iconColor: 'text-sky-400' },
          { label: 'Scrap', status: 'scrapped', icon: 'icon-[uil--trash-alt]', iconColor: 'text-danger' }
        ];
      case 'todo':
        return [{ label: 'Scrap', status: 'scrapped', icon: 'icon-[uil--trash-alt]', iconColor: 'text-danger' }];
      case 'in-progress':
        return [
          { label: 'Complete', status: 'completed', icon: 'icon-[uil--check-circle]', iconColor: 'text-success' },
          { label: 'Scrap', status: 'scrapped', icon: 'icon-[uil--trash-alt]', iconColor: 'text-danger' }
        ];
      default:
        return [];
    }
  });

  let updatingStatus = $state(false);

  async function updateStatus(newStatus: string) {
    updatingStatus = true;
    const oldStatus = totem.status;
    totemsStore.optimisticUpdate(totem.id, { status: newStatus });
    const result = await client
      .mutation(UpdateTotemStatusDocument, { id: totem.id, input: { status: newStatus } })
      .toPromise();
    if (result.error) {
      totemsStore.optimisticUpdate(totem.id, { status: oldStatus });
    }
    updatingStatus = false;
  }

  async function startWork() {
    startingWork = true;
    worktreeError = null;

    const wt = await worktreeStore.createWorktree();
    if (!wt) {
      worktreeError = worktreeStore.error;
      startingWork = false;
      return;
    }

    // Send initial prompt to the agent in the new worktree
    await client
      .mutation(SendAgentMessageDocument, {
        totemId: wt.id,
        message: `Start working on totem ${totem.id}`
      })
      .toPromise();

    // Navigate to the new workspace
    ui.navigateTo(wt.id);
    startingWork = false;
  }

</script>

<div class="h-full overflow-auto p-6">
  <!-- Header -->
  <div class="mb-6">
    <div class="mb-2 flex flex-wrap items-center gap-2">
      <button
        onclick={copyId}
        class="flex cursor-pointer items-center gap-1 rounded px-2 py-1 font-mono text-xs transition-colors hover:bg-surface-alt"
        title="Copy ID to clipboard"
      >
        {totem.id}
        {#if copied}
          <span class="text-success">&#10003;</span>
        {:else}
          <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
        {/if}
      </button>
      <span
        class={[
          'badge',
          typeColors[totem.type] ?? 'bg-type-task-bg text-type-task-text'
        ]}>{totem.type}</span
      >
      <span
        class={[
          'badge',
          statusColors[totem.status] ?? 'bg-status-todo-bg text-status-todo-text'
        ]}>{totem.status}</span
      >
      {#if totem.priority && totem.priority !== 'normal'}
        <span
          class={[
            'badge border',
            priorityColors[totem.priority]
          ]}
        >
          {totem.priority}
        </span>
      {/if}
    </div>
    <h1 class="text-2xl font-bold text-text">{totem.title}</h1>

    <!-- Action buttons -->
    <div class="mt-2 flex flex-wrap items-center gap-2">
      {#if canStartWork && totem.status === 'todo'}
        <button
          class="btn-toggle btn-toggle-inactive"
          onclick={startWork}
          disabled={startingWork}
        >
          {#if startingWork}
            <span
              class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current"
            ></span>
          {:else}
            <span class="icon-[uil--play-circle] size-4 text-success"></span>
          {/if}
          Start Work
        </button>
      {/if}
      {#each workflowActions as action}
        <button
          class="btn-toggle btn-toggle-inactive"
          onclick={() => updateStatus(action.status)}
          disabled={updatingStatus}
        >
          <span class={[action.icon, 'size-4', action.iconColor]}></span>
          {action.label}
        </button>
      {/each}

      {#if isArchivable}
        <button
          class="btn-toggle btn-toggle-inactive"
          onclick={archiveTotem}
          disabled={archiving}
          title="Archive this totem"
        >
          <span class="icon-[uil--archive] size-4 text-amber-400"></span>
          {archiving ? 'Archiving…' : 'Archive'}
        </button>
      {/if}
      {#if onEdit}
        <button
          class="btn-toggle btn-toggle-inactive"
          onclick={() => onEdit(totem)}
        >
          <span class="icon-[uil--edit] size-4 text-sky-400"></span>
          Edit
        </button>
      {/if}
    </div>
  </div>

  <!-- Error -->
  {#if worktreeError}
    <div class="mb-6 rounded-lg border border-danger/30 bg-danger/5 p-3">
      <div class="flex items-center justify-between">
        <div class="flex min-w-0 items-center gap-2">
          <span class="shrink-0 text-xs font-semibold text-danger uppercase">Error</span>
          <span class="truncate text-xs text-danger/80">{worktreeError}</span>
        </div>
        <button
          class="cursor-pointer px-1 text-xs text-danger/60 hover:text-danger"
          onclick={() => (worktreeError = null)}
        >
          ✕
        </button>
      </div>
    </div>
  {/if}

  <!-- Tags -->
  {#if totem.tags.length > 0}
    <div class="mb-6">
      <h2 class="mb-2 text-xs font-semibold text-text-muted uppercase">Tags</h2>
      <div class="flex flex-wrap gap-1">
        {#each totem.tags as tag}
          <span class="badge border border-border text-text-muted"
            >{tag}</span
          >
        {/each}
      </div>
    </div>
  {/if}

  <!-- Relationships -->
  {#if parent || children.length > 0 || blocking.length > 0 || blockedBy.length > 0}
    <div class="mb-6 space-y-3">
      {#if parent}
        <div>
          <h2 class="mb-1 text-xs font-semibold text-text-muted uppercase">Parent</h2>
          <TotemCard totem={parent} variant="compact" onclick={() => onSelect?.(parent)} />
        </div>
      {/if}

      {#if children.length > 0}
        <div>
          <h2 class="mb-1 text-xs font-semibold text-text-muted uppercase">
            Children ({children.length})
          </h2>
          <div class="space-y-0.5">
            {#each children as child}
              <TotemCard totem={child} variant="compact" onclick={() => onSelect?.(child)} />
            {/each}
          </div>
        </div>
      {/if}

      {#if blocking.length > 0}
        <div>
          <h2 class="mb-1 text-xs font-semibold text-text-muted uppercase">
            Blocking ({blocking.length})
          </h2>
          <div class="space-y-0.5">
            {#each blocking as b}
              <TotemCard totem={b} variant="compact" onclick={() => onSelect?.(b)} />
            {/each}
          </div>
        </div>
      {/if}

      {#if blockedBy.length > 0}
        <div>
          <h2 class="mb-1 text-xs font-semibold text-text-muted uppercase">
            Blocked By ({blockedBy.length})
          </h2>
          <div class="space-y-0.5">
            {#each blockedBy as b}
              <TotemCard totem={b} variant="compact" onclick={() => onSelect?.(b)} />
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Body -->
  {#if totem.body}
    <div class="mb-6">
      <h2 class="mb-2 text-xs font-semibold text-text-muted uppercase">Description</h2>
      <RenderedMarkdown content={totem.body} class="totem-body prose max-w-none" />
    </div>
  {/if}

  <!-- Metadata -->
  <div class="my-4 border-t border-border"></div>
  <div class="space-y-1 text-xs text-text-faint">
    <div>Created: {new Date(totem.createdAt).toLocaleString()}</div>
    <div>Updated: {new Date(totem.updatedAt).toLocaleString()}</div>
    <div>Path: {totem.path}</div>
  </div>
</div>

<style>
  .totem-body :global(h1) {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--th-md-h1);
    border-bottom: 1px solid var(--th-md-h1-border);
    padding-bottom: 0.25rem;
    margin-top: 1.5rem;
  }

  .totem-body :global(h2) {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--th-md-h2);
    margin-top: 1.25rem;
  }

  .totem-body :global(h3) {
    font-size: 1rem;
    font-weight: 600;
    color: var(--th-md-h3);
    margin-top: 1rem;
  }

  .totem-body :global(h4),
  .totem-body :global(h5),
  .totem-body :global(h6) {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--th-md-h456);
    margin-top: 0.75rem;
  }

  .totem-body :global(ul:has(input[type='checkbox'])) {
    list-style: none;
    padding-left: 0;
  }

  .totem-body :global(li:has(> input[type='checkbox'])) {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding-left: 0;
  }

  .totem-body :global(li:has(> input[type='checkbox'])::before) {
    content: none;
  }

  .totem-body :global(input[type='checkbox']) {
    margin-top: 0.25rem;
    accent-color: #22c55e;
  }

  .totem-body :global(pre.shiki) {
    padding: 1rem;
    border-radius: 0.5rem;
    overflow-x: auto;
    font-size: 0.875rem;
    line-height: 1.5;
    margin: 1rem 0;
  }

  .totem-body :global(pre.shiki code) {
    font-family:
      ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Monaco, 'Cascadia Code', Consolas,
      'Liberation Mono', 'Courier New', monospace;
  }

  .totem-body :global(code:not(pre code)) {
    color: var(--th-text);
    background-color: var(--th-md-code-bg);
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-size: 0.875em;
    font-family:
      ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Monaco, 'Cascadia Code', Consolas,
      'Liberation Mono', 'Courier New', monospace;
  }
</style>
