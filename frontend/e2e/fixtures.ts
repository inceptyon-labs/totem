import { test as base } from '@playwright/test';
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { connect } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BacklogPage } from './pages/backlog-page';
import { BoardPage } from './pages/board-page';

const PROJECT_ROOT = join(import.meta.dirname, '../..');
const BASE_PORT = 22900;

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'test',
  GIT_AUTHOR_EMAIL: 'test@test',
  GIT_COMMITTER_NAME: 'test',
  GIT_COMMITTER_EMAIL: 'test@test'
};

function getBinaries() {
  const totems = process.env.BEANS_BINARY;
  const totemsServe = process.env.BEANS_SERVE_BINARY;
  if (!totems || !totemsServe) {
    throw new Error('BEANS_BINARY and BEANS_SERVE_BINARY must be set — run tests via e2e/run.sh');
  }
  return { totems, totemsServe };
}

/**
 * Create a totems template directory via `totems init`.
 * Called once per worker. Each test gets a fresh git repo but copies the
 * pre-initialized .totems directory to avoid the expensive CLI invocation.
 */
function createTotemsTemplate(totemsBin: string): string {
  const templateDir = mkdtempSync(join(tmpdir(), 'totems-e2e-template-'));
  execFileSync('git', ['init', '-b', 'main'], { cwd: templateDir, timeout: 10_000 });
  execFileSync('git', ['commit', '--allow-empty', '-m', 'init'], {
    cwd: templateDir,
    timeout: 10_000,
    env: GIT_ENV
  });
  execFileSync(totemsBin, ['init'], {
    cwd: templateDir,
    encoding: 'utf-8',
    timeout: 10_000
  });
  return templateDir;
}

/**
 * Wait for a server to start accepting TCP connections, then verify HTTP.
 * Uses TCP connect first (faster than full HTTP fetch for early polls).
 */
async function waitForServer(port: number, timeoutMs = 10_000): Promise<void> {
  const start = Date.now();
  // First, wait for TCP port to open (much faster than HTTP fetch)
  while (Date.now() - start < timeoutMs) {
    const connected = await new Promise<boolean>((resolve) => {
      const socket = connect(port, '127.0.0.1');
      socket.once('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.once('error', () => {
        socket.destroy();
        resolve(false);
      });
    });
    if (connected) break;
    await new Promise((r) => setTimeout(r, 25));
  }
  // Then verify HTTP is actually ready
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://localhost:${port}/`);
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`Server on port ${port} did not start within ${timeoutMs}ms`);
}

/**
 * Helper to run totems CLI commands against a specific totems path.
 */
class TotemsCLI {
  constructor(
    readonly totemsPath: string,
    readonly projectDir: string,
    private binaryPath: string,
    readonly baseURL: string
  ) {}

  run(args: string[]): string {
    return execFileSync(this.binaryPath, ['--totems-path', this.totemsPath, ...args], {
      cwd: this.projectDir,
      encoding: 'utf-8',
      timeout: 10_000
    });
  }

  create(title: string, opts: { type?: string; status?: string; priority?: string } = {}): string {
    const args = ['create', '--json', title, '-t', opts.type ?? 'task'];
    if (opts.status) args.push('-s', opts.status);
    if (opts.priority) args.push('-p', opts.priority);
    const output = this.run(args);
    const json = JSON.parse(output);
    return (json.totem?.id ?? json.id) as string;
  }

  update(id: string, opts: { status?: string; priority?: string; type?: string }): void {
    const args = ['update', id];
    if (opts.status) args.push('-s', opts.status);
    if (opts.priority) args.push('--priority', opts.priority);
    if (opts.type) args.push('-t', opts.type);
    this.run(args);
  }

  /** Run a GraphQL query against the running totems-serve instance. */
  async graphql<T = unknown>(query: string): Promise<T> {
    const res = await fetch(`${this.baseURL}/api/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    const json = await res.json();
    return json.data as T;
  }

  /** Get all worktree paths from the running server. */
  async getWorktrees(): Promise<{ id: string; path: string; branch: string }[]> {
    const data = await this.graphql<{ worktrees: { id: string; path: string; branch: string }[] }>(
      '{ worktrees { id path branch } }'
    );
    return data.worktrees;
  }

  /** Create a file in a worktree directory to simulate uncommitted changes. */
  createFileInWorktree(worktreePath: string, filename: string, content: string): void {
    writeFileSync(join(worktreePath, filename), content);
  }

  /** Create a commit in a worktree directory to simulate unmerged commits. */
  commitInWorktree(worktreePath: string, filename: string, content: string): void {
    writeFileSync(join(worktreePath, filename), content);
    execFileSync('git', ['add', filename], { cwd: worktreePath, timeout: 10_000 });
    execFileSync('git', ['commit', '-m', 'test commit'], {
      cwd: worktreePath,
      timeout: 10_000,
      env: GIT_ENV
    });
  }
}

type Fixtures = {
  totems: TotemsCLI;
  totemsWithRun: TotemsCLI;
  backlogPage: BacklogPage;
  boardPage: BoardPage;
};

type WorkerFixtures = {
  totemsTemplate: string;
};

/**
 * Each test gets its own temp directory (copied from a worker-scoped template),
 * totems-serve process, and port. Full isolation — no shared state between tests.
 */
export const test = base.extend<Fixtures, WorkerFixtures>({
  // Worker-scoped: run `totems init` once per worker, copy .totems dir for each test.
  // Fresh git repos are created per test (avoids stale git index/worktree state).
  totemsTemplate: [
    async ({}, use) => {
      const { totems: totemsBin } = getBinaries();
      const templateDir = createTotemsTemplate(totemsBin);
      await use(templateDir);
      rmSync(templateDir, { recursive: true, force: true });
    },
    { scope: 'worker' }
  ],

  totems: async ({ page, totemsTemplate }, use, testInfo) => {
    const { totems: totemsBin, totemsServe } = getBinaries();

    // Fresh git repo per test (needed for worktree operations)
    const projectDir = mkdtempSync(join(tmpdir(), 'totems-e2e-'));
    execFileSync('git', ['init', '-b', 'main'], { cwd: projectDir, timeout: 10_000 });
    execFileSync('git', ['commit', '--allow-empty', '-m', 'init'], {
      cwd: projectDir,
      timeout: 10_000,
      env: GIT_ENV
    });
    // Copy pre-initialized totems files from template (avoids expensive `totems init` per test)
    cpSync(join(totemsTemplate, '.totems'), join(projectDir, '.totems'), { recursive: true });
    cpSync(join(totemsTemplate, '.totems.yml'), join(projectDir, '.totems.yml'));

    const totemsPath = join(projectDir, '.totems');

    // Pick a unique port based on worker + test index
    const port = BASE_PORT + testInfo.workerIndex * 100 + testInfo.parallelIndex;

    // Start totems-serve
    const server: ChildProcess = spawn(
      totemsServe,
      ['--port', String(port), '--totems-path', totemsPath],
      {
        cwd: projectDir,
        env: { ...process.env, GIN_MODE: 'release' },
        stdio: 'pipe'
      }
    );

    try {
      await waitForServer(port);

      // Set the base URL for this test's page
      await page.goto(`http://localhost:${port}/`);
      // Navigate away so tests start fresh with goto()
      await page.goto('about:blank');

      const cli = new TotemsCLI(totemsPath, projectDir, totemsBin, `http://localhost:${port}`);
      await use(cli);
    } finally {
      server.kill();
      rmSync(projectDir, { recursive: true, force: true });
    }
  },

  totemsWithRun: async ({ page, totemsTemplate }, use, testInfo) => {
    const { totems: totemsBin, totemsServe } = getBinaries();

    const projectDir = mkdtempSync(join(tmpdir(), 'totems-e2e-'));
    execFileSync('git', ['init', '-b', 'main'], { cwd: projectDir, timeout: 10_000 });
    execFileSync('git', ['commit', '--allow-empty', '-m', 'init'], {
      cwd: projectDir,
      timeout: 10_000,
      env: GIT_ENV
    });
    cpSync(join(totemsTemplate, '.totems'), join(projectDir, '.totems'), { recursive: true });
    cpSync(join(totemsTemplate, '.totems.yml'), join(projectDir, '.totems.yml'));

    // Add a run command to the config — a long-running process we can stop
    const configPath = join(projectDir, '.totems.yml');
    const config = readFileSync(configPath, 'utf-8');
    writeFileSync(configPath, config.replace(/run: ""/g, 'run: "sleep 300"'));

    const totemsPath = join(projectDir, '.totems');
    const port = BASE_PORT + testInfo.workerIndex * 100 + testInfo.parallelIndex;

    const server: ChildProcess = spawn(
      totemsServe,
      ['--port', String(port), '--totems-path', totemsPath],
      {
        cwd: projectDir,
        env: { ...process.env, GIN_MODE: 'release' },
        stdio: 'pipe'
      }
    );

    try {
      await waitForServer(port);
      await page.goto(`http://localhost:${port}/`);
      await page.goto('about:blank');

      const cli = new TotemsCLI(totemsPath, projectDir, totemsBin, `http://localhost:${port}`);
      await use(cli);
    } finally {
      server.kill();
      rmSync(projectDir, { recursive: true, force: true });
    }
  },

  backlogPage: async ({ page, totems }, use) => {
    const backlog = new BacklogPage(page, totems.baseURL);
    await use(backlog);
  },

  boardPage: async ({ page, totems }, use) => {
    const board = new BoardPage(page, totems.baseURL);
    await use(board);
  }
});

export { expect } from '@playwright/test';
