import { pipe, subscribe } from 'wonka';
import { SvelteMap } from 'svelte/reactivity';
import { client } from './graphqlClient';
import {
  TotemChangedDocument,
  type TotemFieldsFragment,
  type TotemChangedSubscription,
} from './graphql/generated';

/**
 * Totem type matching the GraphQL schema (re-exported from codegen)
 */
export type Totem = TotemFieldsFragment;

/**
 * Svelte 5 runes-style stateful store for totems.
 * Frontend equivalent of totemcore on the backend.
 */
export class TotemsStore {
  /** All totems indexed by ID */
  totems = $state(new SvelteMap<string, Totem>());

  /** Loading state (true until first non-initial event or subscription fully synced) */
  loading = $state(true);

  /** Error state */
  error = $state<string | null>(null);

  /** Whether subscription is connected */
  connected = $state(false);

  /** Whether initial sync is complete */
  #initialSyncDone = false;

  /** Subscription teardown function */
  #unsubscribe: (() => void) | null = null;

  /** All non-archived totems as a sorted array (derived) */
  get all(): Totem[] {
    return sortTotems(Array.from(this.totems.values()).filter((b) => !b.path.startsWith('archive/')));
  }

  /** Count of totems */
  get count(): number {
    return this.totems.size;
  }

  /**
   * Start subscription to totem changes with initial state.
   * This is the primary method to initialize the store - it subscribes to changes
   * and receives all current totems as initial events, eliminating race conditions.
   */
  subscribe(): void {
    if (this.#unsubscribe) {
      return; // Already subscribed
    }

    this.loading = true;
    this.error = null;
    this.#initialSyncDone = false;

    const { unsubscribe } = pipe(
      client.subscription(TotemChangedDocument, { includeInitial: true }),
      subscribe((result) => {
        if (result.error) {
          console.error('Subscription error:', result.error);
          this.connected = false;
          this.error = result.error.message;
          this.loading = false;
          return;
        }

        this.connected = true;

        const event = result.data?.totemChanged;
        if (!event) return;

        switch (event.type) {
          case 'INITIAL_SNAPSHOT':
            if (event.totems) {
              const fresh = new SvelteMap<string, Totem>();
              for (const b of event.totems) {
                fresh.set(b.id, b);
              }
              this.totems = fresh;
            }
            this.#initialSyncDone = true;
            this.loading = false;
            break;
          case 'CREATED':
          case 'UPDATED':
            if (event.totem) {
              this.totems.set(event.totem.id, event.totem);
            }
            break;
          case 'DELETED':
            this.totems.delete(event.totemId);
            break;
        }
      })
    );

    this.#unsubscribe = unsubscribe;
  }

  /**
   * Stop subscription to totem changes.
   */
  unsubscribe(): void {
    if (this.#unsubscribe) {
      this.#unsubscribe();
      this.#unsubscribe = null;
      this.connected = false;
    }
  }

  /**
   * Get a totem by ID
   */
  get(id: string): Totem | undefined {
    return this.totems.get(id);
  }

  /**
   * Get totems filtered by status
   */
  byStatus(status: string): Totem[] {
    return this.all.filter((b) => b.status === status);
  }

  /**
   * Get totems filtered by type
   */
  byType(type: string): Totem[] {
    return this.all.filter((b) => b.type === type);
  }

  /**
   * Get children of a totem (totems with this totem as parent)
   */
  children(parentId: string): Totem[] {
    return this.all.filter((b) => b.parentId === parentId);
  }

  /**
   * Get totems that are blocking a given totem
   */
  blockedBy(totemId: string): Totem[] {
    return this.all.filter((b) => b.blockingIds.includes(totemId));
  }

  /**
   * Optimistically update a totem's fields in the local store.
   * The subscription will eventually confirm or overwrite.
   */
  optimisticUpdate(id: string, fields: Partial<Totem>): void {
    const totem = this.totems.get(id);
    if (totem) {
      this.totems.set(id, { ...totem, ...fields });
    }
  }
}

/**
 * Sort order arrays matching the backend's config.DefaultStatuses/Priorities/Types.
 * These must stay in sync with internal/config/config.go.
 */
const STATUS_ORDER = ['in-progress', 'todo', 'draft', 'completed', 'scrapped'];
const PRIORITY_ORDER = ['critical', 'high', 'normal', 'low', 'deferred'];
const TYPE_ORDER = ['milestone', 'epic', 'bug', 'feature', 'task'];

function orderOf(value: string, order: string[], defaultTo?: string): number {
  if (!value && defaultTo) value = defaultTo;
  const idx = order.indexOf(value);
  return idx >= 0 ? idx : order.length;
}

/**
 * Sort totems by status → priority → type → title, matching the backend's
 * SortByStatusPriorityAndType from internal/totem/sort.go.
 */
export function sortTotems(totems: Totem[]): Totem[] {
  return totems.toSorted((a, b) => {
    // Primary: status
    let d = orderOf(a.status, STATUS_ORDER) - orderOf(b.status, STATUS_ORDER);
    if (d !== 0) return d;

    // Secondary: manual order (fractional index) — totems with order come first
    if (a.order && b.order) {
      if (a.order < b.order) return -1;
      if (a.order > b.order) return 1;
    } else if (a.order && !b.order) return -1;
    else if (!a.order && b.order) return 1;

    // Tertiary: priority (empty = normal)
    d =
      orderOf(a.priority, PRIORITY_ORDER, 'normal') - orderOf(b.priority, PRIORITY_ORDER, 'normal');
    if (d !== 0) return d;

    // Quaternary: type
    d = orderOf(a.type, TYPE_ORDER) - orderOf(b.type, TYPE_ORDER);
    if (d !== 0) return d;

    // Final: title (case-insensitive)
    return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
  });
}

/**
 * Singleton instance of the totems store
 */
export const totemsStore = new TotemsStore();
