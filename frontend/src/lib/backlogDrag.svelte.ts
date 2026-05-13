/**
 * Shared drag state for the backlog view.
 *
 * Since TotemItem is recursive, we need a single source of truth for
 * which totem is being dragged and where the drop target is. This module
 * provides that shared reactive state.
 *
 * Card hover uses three zones:
 *   - Top 25%:    reorder above
 *   - Middle 50%: reparent onto this totem
 *   - Bottom 25%: reorder below
 */

import type { Totem } from '$lib/totems.svelte';
import { totemsStore } from '$lib/totems.svelte';
import { applyDrop, applyReparent } from '$lib/dragOrder';

export type DropMode = 'reorder' | 'reparent';

class BacklogDragState {
  draggedTotemId = $state<string | null>(null);
  /** The parent ID of the sibling group being hovered (null = top-level) */
  dropTargetParent = $state<string | null | undefined>(undefined);
  dropIndex = $state<number | null>(null);
  /** The totem ID being hovered for reparenting */
  reparentTargetId = $state<string | null>(null);
  dropMode = $state<DropMode>('reorder');
  /** The target status when dropping into a different section */
  targetStatus = $state<string | null>(null);

  get isDragging() {
    return this.draggedTotemId !== null;
  }

  startDrag(e: DragEvent, totem: Totem) {
    this.draggedTotemId = totem.id;
    e.dataTransfer!.effectAllowed = 'move';
    e.dataTransfer!.setData('text/plain', totem.id);
  }

  endDrag() {
    this.draggedTotemId = null;
    this.dropTargetParent = undefined;
    this.dropIndex = null;
    this.reparentTargetId = null;
    this.dropMode = 'reorder';
    this.targetStatus = null;
  }

  hoverCard(e: DragEvent, parentId: string | null, index: number, totemId: string, status?: string) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer!.dropEffect = 'move';

    // Don't allow dropping on yourself
    if (totemId === this.draggedTotemId) return;

    if (status) this.targetStatus = status;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const relativeY = (e.clientY - rect.top) / rect.height;

    if (relativeY < 0.25) {
      // Top zone — reorder above
      this.dropMode = 'reorder';
      this.dropTargetParent = parentId;
      this.dropIndex = index;
      this.reparentTargetId = null;
    } else if (relativeY > 0.75) {
      // Bottom zone — reorder below
      this.dropMode = 'reorder';
      this.dropTargetParent = parentId;
      this.dropIndex = index + 1;
      this.reparentTargetId = null;
    } else {
      // Middle zone — reparent onto this totem
      this.dropMode = 'reparent';
      this.reparentTargetId = totemId;
      this.dropTargetParent = undefined;
      this.dropIndex = null;
    }
  }

  hoverList(e: DragEvent, parentId: string | null, totemCount: number, status?: string) {
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';
    this.dropMode = 'reorder';
    this.reparentTargetId = null;
    this.dropTargetParent = parentId;
    this.targetStatus = status ?? null;
    if (this.dropIndex === null || this.dropTargetParent !== parentId) {
      this.dropIndex = totemCount;
    }
  }

  leaveList(e: DragEvent, listEl: HTMLElement, parentId: string | null) {
    if (!listEl.contains(e.relatedTarget as Node)) {
      if (this.dropTargetParent === parentId) {
        this.dropTargetParent = undefined;
        this.dropIndex = null;
      }
      if (this.reparentTargetId) {
        this.reparentTargetId = null;
      }
    }
  }

  drop(e: DragEvent, parentId: string | null, totems: Totem[]) {
    e.preventDefault();
    e.stopPropagation();

    const mode = this.dropMode;
    const targetIdx = this.dropIndex;
    const totemId = this.draggedTotemId;
    const reparentTarget = this.reparentTargetId;
    const newStatus = this.targetStatus;

    this.dropTargetParent = undefined;
    this.dropIndex = null;
    this.draggedTotemId = null;
    this.reparentTargetId = null;
    this.dropMode = 'reorder';
    this.targetStatus = null;

    if (!totemId) return;

    if (mode === 'reparent' && reparentTarget) {
      const targetChildren = totemsStore.children(reparentTarget);
      applyReparent(totemId, reparentTarget, targetChildren);
    } else {
      applyDrop(totems, totemId, targetIdx ?? totems.length, {
        newParentId: parentId,
        newStatus: newStatus ?? undefined
      });
    }
  }

  /** Check if a drop indicator should show at this position */
  showIndicator(parentId: string | null, index: number, totemId: string, status?: string): boolean {
    return (
      this.dropMode === 'reorder' &&
      this.dropTargetParent === parentId &&
      (!status || this.targetStatus === status) &&
      this.draggedTotemId !== null &&
      this.draggedTotemId !== totemId &&
      this.dropIndex === index
    );
  }

  showEndIndicator(parentId: string | null, count: number, status?: string): boolean {
    return (
      this.dropMode === 'reorder' &&
      this.dropTargetParent === parentId &&
      (!status || this.targetStatus === status) &&
      this.draggedTotemId !== null &&
      this.dropIndex === count
    );
  }

  /** Check if this totem is the reparent target */
  isReparentTarget(totemId: string): boolean {
    return this.dropMode === 'reparent' && this.reparentTargetId === totemId;
  }
}

export const backlogDrag = new BacklogDragState();
