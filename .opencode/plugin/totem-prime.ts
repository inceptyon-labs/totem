import type { Plugin } from '@opencode-ai/plugin';

/**
 * Totem Prime Plugin for OpenCode
 *
 * This plugin injects the output of `totem prime` into OpenCode's system prompt,
 * giving the AI context about your project's totems (issues/tasks). It runs on:
 *
 * - Chat session start: Adds totem context to the system prompt
 * - Session compaction: Re-injects context when the session is compacted
 *
 * Plugin Location Options:
 *
 * 1. Project-local (current): .opencode/plugin/totem-prime.ts
 *    - Only available in this project
 *    - Committed to version control, shared with collaborators
 *
 * 2. User-global: ~/.opencode/plugin/totem-prime.ts
 *    - Available in all your projects that use totem
 *    - Personal configuration, not shared
 */

export const TotemPrimePlugin: Plugin = async ({ $, directory }) => {
  // Check if totem CLI exists and project has totem config
  let prime = undefined;

  try {
    // Both conditions must be true:
    // 1. totem CLI is installed
    // 2. Project has .totem.yml config
    const hasTotem = await $`which totem`.quiet();
    const hasConfig = await $`test -f ${directory}/.totem.yml`.quiet();

    if (hasTotem.exitCode === 0 && hasConfig.exitCode === 0) {
      const result = await $`totem prime`.cwd(directory).quiet();
      prime = result.stdout.toString();
    }
  } catch (e) {
    // totem not available or not configured - silently skip
  }

  return {
    'experimental.chat.system.transform': async (_, output) => {
      if (prime) {
        output.system.push(prime);
      }
    },
    'experimental.session.compacting': async (_, output) => {
      if (prime) {
        output.context.push(prime);
      }
    },
  };
};

export default TotemPrimePlugin;
