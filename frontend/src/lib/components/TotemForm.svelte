<script lang="ts">
  import type { Totem } from '$lib/totems.svelte';
  import { totemsStore } from '$lib/totems.svelte';
  import { client } from '$lib/graphqlClient';
  import { CreateTotemDocument, UpdateTotemDocument, type CreateTotemInput, type UpdateTotemInput } from '$lib/graphql/generated';

  interface Props {
    totem?: Totem | null;
    onClose: () => void;
    onSaved?: (totem: Totem) => void;
  }

  let { totem = null, onClose, onSaved }: Props = $props();

  const isEdit = $derived(!!totem);

  // Form fields — intentionally capture initial prop values for local editing
  /* eslint-disable svelte/valid-compile */
  // svelte-ignore state_referenced_locally
  let title = $state(totem?.title ?? '');
  // svelte-ignore state_referenced_locally
  let type = $state(totem?.type ?? 'task');
  // svelte-ignore state_referenced_locally
  let status = $state(totem?.status ?? 'todo');
  // svelte-ignore state_referenced_locally
  let priority = $state(totem?.priority ?? 'normal');
  // svelte-ignore state_referenced_locally
  let tags = $state(totem?.tags.join(', ') ?? '');
  // svelte-ignore state_referenced_locally
  let body = $state(totem?.body ?? '');
  // svelte-ignore state_referenced_locally
  let parentId = $state(totem?.parentId ?? '');
  /* eslint-enable svelte/valid-compile */

  let submitting = $state(false);
  let error = $state<string | null>(null);

  const types = ['task', 'bug', 'feature', 'epic', 'milestone'];
  const statuses = ['draft', 'todo', 'in-progress', 'completed', 'scrapped'];
  const priorities = ['critical', 'high', 'normal', 'low', 'deferred'];

  // Available parents (all totems except current totem and its descendants)
  const availableParents = $derived(
    totemsStore.all.filter((b) => {
      if (!totem) return true;
      if (b.id === totem.id) return false;
      // Simple cycle check: don't allow own children as parent
      let current: Totem | undefined = b;
      while (current) {
        if (current.parentId === totem.id) return false;
        current = current.parentId ? totemsStore.get(current.parentId) : undefined;
      }
      return true;
    })
  );

  function parseTags(raw: string): string[] {
    return raw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  }

  async function handleSubmit() {
    if (!title.trim()) {
      error = 'Title is required';
      return;
    }

    submitting = true;
    error = null;

    const fields = {
      title: title.trim(),
      type,
      status,
      priority,
      body: body || null,
      tags: parseTags(tags),
      parent: parentId || null
    };

    let saved: Totem | null = null;
    if (isEdit && totem) {
      const input: UpdateTotemInput = fields;
      const result = await client.mutation(UpdateTotemDocument, { id: totem.id, input }).toPromise();
      submitting = false;
      if (result.error) { error = result.error.message; return; }
      saved = result.data?.updateTotem ?? null;
    } else {
      const input: CreateTotemInput = fields;
      const result = await client.mutation(CreateTotemDocument, { input }).toPromise();
      submitting = false;
      if (result.error) { error = result.error.message; return; }
      saved = result.data?.createTotem ?? null;
    }
    if (saved) {
      onSaved?.(saved);
    }
    onClose();
  }
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
  <div class="w-11/12 max-w-2xl rounded-xl bg-surface p-6 shadow-xl">
    <h3 class="text-lg font-bold text-text">{isEdit ? 'Edit Totem' : 'New Totem'}</h3>

    {#if error}
      <div
        class="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
      >
        {error}
      </div>
    {/if}

    <form
      onsubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
      class="mt-4 space-y-4"
    >
      <!-- Title -->
      <div>
        <label class="mb-1 block text-sm font-medium text-text-muted" for="totem-title">Title</label>
        <input
          id="totem-title"
          type="text"
          class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:border-accent focus:ring-2 focus:ring-accent/50 focus:outline-none"
          bind:value={title}
          placeholder="What needs to be done?"
        />
      </div>

      <!-- Type / Status / Priority row -->
      <div class="grid grid-cols-3 gap-3">
        <div>
          <label class="mb-1 block text-sm font-medium text-text-muted" for="totem-type">Type</label>
          <select
            id="totem-type"
            class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:border-accent focus:ring-2 focus:ring-accent/50 focus:outline-none"
            bind:value={type}
          >
            {#each types as t}
              <option value={t}>{t}</option>
            {/each}
          </select>
        </div>

        <div>
          <label class="mb-1 block text-sm font-medium text-text-muted" for="totem-status"
            >Status</label
          >
          <select
            id="totem-status"
            class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:border-accent focus:ring-2 focus:ring-accent/50 focus:outline-none"
            bind:value={status}
          >
            {#each statuses as s}
              <option value={s}>{s}</option>
            {/each}
          </select>
        </div>

        <div>
          <label class="mb-1 block text-sm font-medium text-text-muted" for="totem-priority"
            >Priority</label
          >
          <select
            id="totem-priority"
            class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:border-accent focus:ring-2 focus:ring-accent/50 focus:outline-none"
            bind:value={priority}
          >
            {#each priorities as p}
              <option value={p}>{p}</option>
            {/each}
          </select>
        </div>
      </div>

      <!-- Parent -->
      <div>
        <label class="mb-1 block text-sm font-medium text-text-muted" for="totem-parent"
          >Parent</label
        >
        <select
          id="totem-parent"
          class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:border-accent focus:ring-2 focus:ring-accent/50 focus:outline-none"
          bind:value={parentId}
        >
          <option value="">None</option>
          {#each availableParents as p}
            <option value={p.id}>{p.title} ({p.type})</option>
          {/each}
        </select>
      </div>

      <!-- Tags -->
      <div>
        <label class="mb-1 block text-sm font-medium text-text-muted" for="totem-tags">Tags</label>
        <input
          id="totem-tags"
          type="text"
          class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:border-accent focus:ring-2 focus:ring-accent/50 focus:outline-none"
          bind:value={tags}
          placeholder="Comma-separated tags"
        />
      </div>

      <!-- Body -->
      <div>
        <label class="mb-1 block text-sm font-medium text-text-muted" for="totem-body"
          >Description (Markdown)</label
        >
        <textarea
          id="totem-body"
          class="h-40 w-full resize-y rounded-md border border-border bg-surface px-3 py-2 font-mono text-sm text-text focus:border-accent focus:ring-2 focus:ring-accent/50 focus:outline-none"
          bind:value={body}
          placeholder="Markdown content..."
        ></textarea>
      </div>

      <!-- Actions -->
      <div class="flex justify-end gap-2 pt-2">
        <button
          type="button"
          class="cursor-pointer rounded-md border border-border px-4 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-surface-alt"
          onclick={onClose}
          disabled={submitting}>Cancel</button
        >
        <button
          type="submit"
          class="flex cursor-pointer items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-text transition-opacity hover:opacity-90 disabled:opacity-50"
          disabled={submitting || !title.trim()}
        >
          {#if submitting}
            <span
              class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-accent-text/30 border-t-accent-text"
            ></span>
          {/if}
          {isEdit ? 'Save Changes' : 'Create Totem'}
        </button>
      </div>
    </form>
  </div>
  <!-- Backdrop -->
  <button class="fixed inset-0 -z-10" onclick={onClose} tabindex="-1" aria-label="Close"></button>
</div>
