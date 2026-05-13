import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Page object for the backlog (list) view at /.
 */
export class BacklogPage {
  readonly totemItems: Locator;

  constructor(
    private page: Page,
    private baseURL: string
  ) {
    this.totemItems = page.locator('.totem-item');
  }

  /**
   * Navigate to the backlog page and wait for totems to load.
   * @param expectedCount If provided, wait until exactly this many totems are visible.
   */
  async goto(expectedCount?: number) {
    await this.page.goto(this.baseURL + '/');
    if (expectedCount !== undefined && expectedCount > 0) {
      await expect(this.totemItems).toHaveCount(expectedCount, { timeout: 10_000 });
    } else if (expectedCount === undefined) {
      await this.page.waitForSelector('.totem-item', { timeout: 10_000 });
    }
  }

  /** Get all visible totem titles in display order. */
  async getTotemTitles(): Promise<string[]> {
    const titles = await this.totemItems
      .locator('[role="button"] > div > span.text-sm')
      .allTextContents();
    return titles.map((t) => t.trim());
  }

  /** Get all visible totem statuses in display order. */
  async getTotemStatuses(): Promise<string[]> {
    const statuses = await this.totemItems
      .locator('[role="button"] > div > span.rounded-full')
      .allTextContents();
    return statuses.map((s) => s.trim());
  }

  /** Click on a totem by its title. */
  async selectTotem(title: string) {
    await this.totemItems.filter({ hasText: title }).first().locator('[role="button"]').click();
  }

  /** Wait for a specific totem to appear. */
  async waitForTotem(title: string) {
    await this.page.locator('.totem-item', { hasText: title }).waitFor({ timeout: 10_000 });
  }

  /** Wait for a totem to disappear from the list. */
  async waitForTotemGone(title: string) {
    await this.page
      .locator('.totem-item', { hasText: title })
      .waitFor({ state: 'detached', timeout: 10_000 });
  }

  /** Get the count of visible totems. */
  async count(): Promise<number> {
    return this.totemItems.count();
  }

  /** Get the .totem-item for a specific totem by title (uses data-totem-id for precision). */
  totemByTitle(title: string): Locator {
    return this.totemItems.filter({ hasText: title }).first();
  }

  /**
   * Get the draggable card element for a totem, identified by title.
   * Each [draggable] div contains only its own card's content (not descendants),
   * so filtering by text gives us the exact totem's drag handle.
   */
  private draggableByTitle(title: string): Locator {
    return this.page.locator(
      `[draggable="true"]:has([role="button"] span.text-sm:text-is("${title}"))`
    );
  }

  /**
   * Drag a totem to reorder it above/below another totem, or onto it to reparent.
   *
   * The drop zones are: top 25% = above, middle 50% = reparent, bottom 25% = below.
   * We target 10%/90% for reorder and 50% for reparent to avoid zone boundaries.
   */
  async dragTotem(
    sourceTitle: string,
    targetTitle: string,
    position: 'above' | 'below' | 'onto' = 'above'
  ) {
    const source = this.draggableByTitle(sourceTitle);
    const target = this.draggableByTitle(targetTitle);

    const targetBox = await target.boundingBox();
    if (!targetBox) throw new Error(`Target totem "${targetTitle}" not visible`);

    // Compute Y offset within the target card
    const yFraction = position === 'above' ? 0.1 : position === 'below' ? 0.9 : 0.5;
    const targetY = targetBox.height * yFraction;

    await source.dragTo(target, {
      targetPosition: { x: targetBox.width / 2, y: targetY }
    });
  }
}
