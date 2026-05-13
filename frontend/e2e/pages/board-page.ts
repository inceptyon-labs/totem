import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Page object for the board (kanban) view, accessible via the Board toggle on /.
 */
export class BoardPage {
  constructor(
    private page: Page,
    private baseURL: string
  ) {}

  async goto() {
    await this.page.goto(this.baseURL + '/');
    // Click the Board toggle button
    await this.page.getByRole('button', { name: 'Board' }).click();
    // Wait for columns to render
    await this.page.waitForSelector('[data-status]', { timeout: 10_000 });
  }

  /** Get a column locator by status name. */
  private column(status: string): Locator {
    return this.page.locator(`[data-status="${status}"]`);
  }

  /** Get all totem titles in a specific column, in display order. */
  async getColumnTitles(status: string): Promise<string[]> {
    const col = this.column(status);
    const cards = col.locator('[role="listitem"] [role="button"] span.text-sm');
    const titles = await cards.allTextContents();
    return titles.map((t) => t.trim());
  }

  /** Get the count of totems in a column. */
  async getColumnCount(status: string): Promise<number> {
    const col = this.column(status);
    return col.locator('[role="listitem"]').count();
  }

  /** Wait for a specific count of totems in a column. */
  async waitForColumnCount(status: string, count: number) {
    const col = this.column(status);
    await expect(col.locator('[role="listitem"]')).toHaveCount(count, { timeout: 10_000 });
  }

  /** Wait for a totem to appear in a specific column. */
  async waitForTotemInColumn(title: string, status: string) {
    const col = this.column(status);
    await col.locator('[role="listitem"]', { hasText: title }).waitFor({ timeout: 10_000 });
  }

  /** Wait for a totem to disappear from a specific column. */
  async waitForTotemNotInColumn(title: string, status: string) {
    const col = this.column(status);
    await col
      .locator('[role="listitem"]', { hasText: title })
      .waitFor({ state: 'detached', timeout: 10_000 });
  }

  /** Get the "Archive all" button in the completed column. */
  get archiveAllButton() {
    return this.column('completed').getByRole('button', { name: 'Archive all completed totems' });
  }

  /** Click the "Archive all" button and confirm the modal. */
  async archiveAllCompleted() {
    await this.archiveAllButton.click();
    await this.page.getByRole('button', { name: 'Archive All', exact: true }).click();
  }
}
