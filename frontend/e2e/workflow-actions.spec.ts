import { test, expect } from './fixtures';

test.describe('Workflow action buttons', () => {
  test('draft totem shows Todo and Scrap buttons', async ({ totems, backlogPage, page }) => {
    totems.create('Draft Totem', { status: 'draft', type: 'task' });

    await backlogPage.goto(1);
    await backlogPage.selectTotem('Draft Totem');

    const detail = page.locator('h1', { hasText: 'Draft Totem' }).locator('..');

    await expect(detail.getByRole('button', { name: 'Todo' })).toBeVisible();
    await expect(detail.getByRole('button', { name: 'Scrap' })).toBeVisible();
    await expect(detail.getByRole('button', { name: 'Complete' })).not.toBeVisible();
  });

  test('todo totem shows Scrap button (no Start Work without agent)', async ({
    totems,
    backlogPage,
    page
  }) => {
    totems.create('Todo Totem', { status: 'todo', type: 'task' });

    await backlogPage.goto(1);
    await backlogPage.selectTotem('Todo Totem');

    const detail = page.locator('h1', { hasText: 'Todo Totem' }).locator('..');

    await expect(detail.getByRole('button', { name: 'Scrap' })).toBeVisible();
    await expect(detail.getByRole('button', { name: 'Todo' })).not.toBeVisible();
    await expect(detail.getByRole('button', { name: 'Complete' })).not.toBeVisible();
  });

  test('in-progress totem shows Complete and Scrap buttons', async ({
    totems,
    boardPage,
    page
  }) => {
    totems.create('Active Totem', { status: 'in-progress', type: 'task' });

    await boardPage.goto();
    await boardPage.waitForTotemInColumn('Active Totem', 'in-progress');
    // Click the totem in the board to select it
    await page.locator('[data-status="in-progress"] [role="listitem"]', { hasText: 'Active Totem' }).locator('[role="button"]').click();

    const detail = page.locator('h1', { hasText: 'Active Totem' }).locator('..');

    await expect(detail.getByRole('button', { name: 'Complete' })).toBeVisible();
    await expect(detail.getByRole('button', { name: 'Scrap' })).toBeVisible();
    await expect(detail.getByRole('button', { name: 'Todo' })).not.toBeVisible();
  });

  test('completed totem shows no workflow buttons', async ({ totems, boardPage, page }) => {
    totems.create('Done Totem', { status: 'completed', type: 'task' });

    await boardPage.goto();
    await boardPage.waitForTotemInColumn('Done Totem', 'completed');
    await page.locator('[data-status="completed"] [role="listitem"]', { hasText: 'Done Totem' }).locator('[role="button"]').click();

    const detail = page.locator('h1', { hasText: 'Done Totem' }).locator('..');

    await expect(detail.getByRole('button', { name: 'Todo' })).not.toBeVisible();
    await expect(detail.getByRole('button', { name: 'Scrap' })).not.toBeVisible();
    await expect(detail.getByRole('button', { name: 'Complete' })).not.toBeVisible();
    await expect(detail.getByRole('button', { name: 'Start Work' })).not.toBeVisible();
  });

  test('scrapped totem shows no workflow buttons', async ({ totems, page }) => {
    const id = totems.create('Scrapped Totem', { status: 'scrapped', type: 'task' });

    // Navigate directly with totem param since scrapped totems don't appear in any view
    await page.goto(`${totems.baseURL}/?totem=${id}`);
    await expect(page.locator('h1', { hasText: 'Scrapped Totem' })).toBeVisible({ timeout: 10_000 });

    const detail = page.locator('h1', { hasText: 'Scrapped Totem' }).locator('..');

    await expect(detail.getByRole('button', { name: 'Todo' })).not.toBeVisible();
    await expect(detail.getByRole('button', { name: 'Scrap' })).not.toBeVisible();
    await expect(detail.getByRole('button', { name: 'Complete' })).not.toBeVisible();
  });

  test('Todo button moves draft totem to todo status', async ({ totems, backlogPage, page }) => {
    totems.create('My Draft', { status: 'draft', type: 'task' });

    await backlogPage.goto(1);
    await backlogPage.selectTotem('My Draft');

    const detail = page.locator('h1', { hasText: 'My Draft' }).locator('..');

    await detail.getByRole('button', { name: 'Todo' }).click();

    // Workflow buttons should update to todo state
    await expect(detail.getByRole('button', { name: 'Scrap' })).toBeVisible({ timeout: 5000 });
    await expect(detail.getByRole('button', { name: 'Todo' })).not.toBeVisible();
  });

  test('Complete button moves in-progress totem to completed', async ({
    totems,
    boardPage,
    page
  }) => {
    totems.create('Active Task', { status: 'in-progress', type: 'task' });

    await boardPage.goto();
    await boardPage.waitForTotemInColumn('Active Task', 'in-progress');
    await page.locator('[data-status="in-progress"] [role="listitem"]', { hasText: 'Active Task' }).locator('[role="button"]').click();

    const detail = page.locator('h1', { hasText: 'Active Task' }).locator('..');

    await detail.getByRole('button', { name: 'Complete' }).click();

    // No workflow buttons should remain, Archive should appear
    await expect(detail.getByRole('button', { name: 'Archive' })).toBeVisible({ timeout: 5000 });
    await expect(detail.getByRole('button', { name: 'Complete' })).not.toBeVisible();
    await expect(detail.getByRole('button', { name: 'Scrap' })).not.toBeVisible();
  });

  test('Scrap button moves totem to scrapped', async ({ totems, backlogPage, page }) => {
    totems.create('Unwanted Totem', { status: 'todo', type: 'task' });

    await backlogPage.goto(1);
    await backlogPage.selectTotem('Unwanted Totem');

    const detail = page.locator('h1', { hasText: 'Unwanted Totem' }).locator('..');

    await detail.getByRole('button', { name: 'Scrap' }).click();

    // No workflow buttons should remain, Archive should appear
    await expect(detail.getByRole('button', { name: 'Archive' })).toBeVisible({ timeout: 5000 });
    await expect(detail.getByRole('button', { name: 'Scrap' })).not.toBeVisible();
  });
});
