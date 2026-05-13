import { goto } from '$app/navigation';
import type { Totem } from '$lib/totems.svelte';
import { totemsStore } from '$lib/totems.svelte';

class UIState {
  // Active view: 'planning' or a totemId for workspace view (derived from URL)
  activeView = $state<'planning' | string>('planning');

  // Planning sub-view (derived from URL)
  planningView = $state<'backlog' | 'board'>('backlog');

  get isPlanning(): boolean {
    return this.activeView === 'planning';
  }

  /** Sync UIState from URL path. Called reactively from layout on every navigation. */
  syncFromUrl(pathname: string) {
    const workspaceMatch = pathname.match(/^\/workspace\/([^/]+)/);
    const newView = workspaceMatch ? workspaceMatch[1] : 'planning';
    const viewChanged = newView !== this.activeView;

    if (workspaceMatch) {
      this.activeView = workspaceMatch[1];
    } else {
      this.activeView = 'planning';
      this.planningView = pathname === '/planning/board' ? 'board' : 'backlog';
    }

    // Restore the remembered totem selection in the URL only when switching views
    if (viewChanged) {
      this.syncSelectedTotemToUrl();
    }
  }

  /** Navigate to a view via URL routing. */
  navigateTo(view: 'planning' | string) {
    if (view === 'planning') {
      goto(`/planning${this.planningView === 'board' ? '/board' : ''}`);
    } else {
      goto(`/workspace/${view}`);
    }
  }

  /** Navigate to a planning sub-view. */
  navigateToPlanningView(view: 'backlog' | 'board') {
    goto(view === 'board' ? '/planning/board' : '/planning');
  }

  // Per-view selected totem ID (keyed by activeView: 'planning' or worktree ID)
  private selectedTotemByView = $state<Record<string, string | null>>({});

  // Selected totem ID for the current view
  get selectedTotemId(): string | null {
    return this.selectedTotemByView[this.activeView] ?? null;
  }

  set selectedTotemId(id: string | null) {
    this.selectedTotemByView[this.activeView] = id;
  }

  // Resolved totem from store
  get currentTotem(): Totem | null {
    return this.selectedTotemId ? (totemsStore.get(this.selectedTotemId) ?? null) : null;
  }

  selectTotem(totem: Totem) {
    this.selectedTotemId = totem.id;
    this.syncSelectedTotemToUrl();
  }

  selectTotemById(id: string) {
    this.selectedTotemId = id;
    this.syncSelectedTotemToUrl();
  }

  /** Pre-select a totem for a specific view (e.g. before navigating to that view). */
  selectTotemForView(totemId: string, view: string) {
    this.selectedTotemByView[view] = totemId;
    // If already on this view, sync to URL immediately
    if (view === this.activeView) {
      this.syncSelectedTotemToUrl();
    }
    // Otherwise, syncFromUrl will pick it up when the navigation completes
  }

  clearSelection() {
    this.selectedTotemId = null;
    this.syncSelectedTotemToUrl();
  }

  /** Update the URL query param without navigation */
  private syncSelectedTotemToUrl() {
    const url = new URL(window.location.href);
    if (this.selectedTotemId) {
      url.searchParams.set('totem', this.selectedTotemId);
    } else {
      url.searchParams.delete('totem');
    }
    window.history.replaceState(window.history.state, '', url);
  }

  // Planning chat pane (persisted to localStorage)
  showPlanningChat = $state(false);

  togglePlanningChat() {
    this.showPlanningChat = !this.showPlanningChat;
    localStorage.setItem('totems-planning-chat', this.showPlanningChat ? 'true' : 'false');
  }

  // Changes pane (persisted to localStorage)
  showChanges = $state(false);

  toggleChanges() {
    this.showChanges = !this.showChanges;
    localStorage.setItem('totems-changes-pane', this.showChanges ? 'true' : 'false');
  }

  // Terminal pane (always hidden by default, not persisted)
  showTerminal = $state(false);
  terminalInitialized = $state(false);

  toggleTerminal() {
    this.showTerminal = !this.showTerminal;
    if (this.showTerminal) {
      this.terminalInitialized = true;
    }
  }

  // Filter text (persisted to localStorage)
  filterText = $state('');

  setFilterText(text: string) {
    this.filterText = text;
    if (text) {
      localStorage.setItem('totems-filter-text', text);
    } else {
      localStorage.removeItem('totems-filter-text');
    }
  }

  // Form modal
  showForm = $state(false);
  editingTotem = $state<Totem | null>(null);

  openCreateForm() {
    this.editingTotem = null;
    this.showForm = true;
  }

  openEditForm(totem: Totem) {
    this.editingTotem = totem;
    this.showForm = true;
  }

  closeForm() {
    this.showForm = false;
    this.editingTotem = null;
  }
}

export const ui = new UIState();
