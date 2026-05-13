import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from './fixtures';

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'test',
  GIT_AUTHOR_EMAIL: 'test@test',
  GIT_COMMITTER_NAME: 'test',
  GIT_COMMITTER_EMAIL: 'test@test'
};

/**
 * Helper: commit .totems/ directory to git so worktrees inherit totem files.
 */
function commitTotemsDir(projectDir: string) {
  execFileSync('git', ['add', '.totems', '.totems.yml'], {
    cwd: projectDir,
    timeout: 10_000
  });
  execFileSync('git', ['commit', '-m', 'commit totems'], {
    cwd: projectDir,
    timeout: 10_000,
    env: GIT_ENV
  });
}

/**
 * Helper: find the totem file in a .totems/ directory by totem ID prefix.
 */
function findTotemFile(totemsDir: string, totemId: string): string {
  const files = readdirSync(totemsDir);
  const match = files.find((f) => f.startsWith(totemId) && f.endsWith('.md'));
  if (!match) throw new Error(`No totem file found for ${totemId} in ${totemsDir}`);
  return match;
}

/**
 * Helper: create a workspace via the UI and return its name + worktree path.
 */
async function createWorkspaceAndGetPath(
  page: import('@playwright/test').Page,
  getWorktrees: () => Promise<{ id: string; path: string; branch: string }[]>
) {
  const sidebar = page.locator('nav');
  await page.getByRole('button', { name: 'Create worktree' }).click();
  await expect(page).toHaveURL(/\/workspace\//, { timeout: 10_000 });

  const activeLabel = sidebar.locator('button.font-medium span.truncate');
  await expect(activeLabel).toBeVisible({ timeout: 5_000 });
  const wsName = (await activeLabel.textContent())!;

  const worktrees = await getWorktrees();
  const wt = worktrees.find((w) => w.branch.includes(wsName));
  expect(wt).toBeTruthy();

  return { wsName, wtPath: wt!.path };
}

test.describe('Workspace totem association', () => {
  test('totems modified in a worktree appear under the workspace in sidebar', async ({
    totems,
    page
  }) => {
    // Create a totem and commit .totems/ to git so worktrees inherit it
    const totemId = totems.create('WT Association Totem', { type: 'task', status: 'todo' });
    commitTotemsDir(totems.projectDir);

    await page.goto(totems.baseURL + '/');
    await expect(page.getByText('Workspaces')).toBeVisible({ timeout: 10_000 });

    // Create a workspace
    const { wsName, wtPath } = await createWorkspaceAndGetPath(page, () => totems.getWorktrees());

    // Modify the totem file in the worktree's .totems/ directory
    const totemFile = findTotemFile(join(wtPath, '.totems'), totemId);
    const totemPath = join(wtPath, '.totems', totemFile);
    const content = readFileSync(totemPath, 'utf-8');
    writeFileSync(totemPath, content.replace('status: todo', 'status: in-progress'));

    // The totem should appear under the workspace in the sidebar
    // (the file watcher detects the change, DetectTotemIDs picks it up via git diff)
    const sidebar = page.locator('nav');
    const wsCard = sidebar.locator('div.rounded-md').filter({
      has: page.locator('span.truncate', { hasText: wsName })
    });
    await expect(wsCard.getByText('WT Association Totem')).toBeVisible({ timeout: 10_000 });
  });

  test('committed totem changes in worktree appear under workspace', async ({ totems, page }) => {
    // Create a totem and commit .totems/ to git
    const totemId = totems.create('Committed Totem Change', { type: 'bug', status: 'todo' });
    commitTotemsDir(totems.projectDir);

    await page.goto(totems.baseURL + '/');
    await expect(page.getByText('Workspaces')).toBeVisible({ timeout: 10_000 });

    const { wsName, wtPath } = await createWorkspaceAndGetPath(page, () => totems.getWorktrees());

    // Modify and commit the totem in the worktree
    const totemFile = findTotemFile(join(wtPath, '.totems'), totemId);
    const totemPath = join(wtPath, '.totems', totemFile);
    const content = readFileSync(totemPath, 'utf-8');
    writeFileSync(totemPath, content.replace('status: todo', 'status: in-progress'));
    execFileSync('git', ['add', '.totems'], { cwd: wtPath, timeout: 10_000 });
    execFileSync('git', ['commit', '-m', 'update totem status'], {
      cwd: wtPath,
      timeout: 10_000,
      env: GIT_ENV
    });

    // The totem should appear under the workspace
    const sidebar = page.locator('nav');
    const wsCard = sidebar.locator('div.rounded-md').filter({
      has: page.locator('span.truncate', { hasText: wsName })
    });
    await expect(wsCard.getByText('Committed Totem Change')).toBeVisible({ timeout: 10_000 });
  });

  test('unmodified totems do not appear under workspace', async ({ totems, page }) => {
    // Create a totem and commit .totems/ to git
    totems.create('Unchanged Totem', { type: 'task', status: 'todo' });
    commitTotemsDir(totems.projectDir);

    await page.goto(totems.baseURL + '/');
    await expect(page.getByText('Workspaces')).toBeVisible({ timeout: 10_000 });

    const { wsName } = await createWorkspaceAndGetPath(page, () => totems.getWorktrees());

    // Don't modify the totem — it should NOT appear under the workspace
    const sidebar = page.locator('nav');
    const wsCard = sidebar.locator('div.rounded-md').filter({
      has: page.locator('span.truncate', { hasText: wsName })
    });

    // Wait a moment to ensure the subscription has settled, then verify absence
    await page.waitForTimeout(2_000);
    await expect(wsCard.getByText('Unchanged Totem')).not.toBeVisible();
  });
});
