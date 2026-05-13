import { pipe, subscribe } from 'wonka';
import { client } from './graphqlClient';
import { ActiveAgentStatusesDocument, AgentSessionStatus } from './graphql/generated';

class AgentStatusesStore {
  runningTotemIds = $state<Set<string>>(new Set());

  #unsubscribe: (() => void) | null = null;

  subscribe(): void {
    if (this.#unsubscribe) return;

    const { unsubscribe } = pipe(
      client.subscription(ActiveAgentStatusesDocument, {}),
      subscribe(
        (result) => {
          if (result.error) {
            console.error('Agent statuses subscription error:', result.error);
            return;
          }

          const statuses = result.data?.activeAgentStatuses;
          if (statuses) {
            this.runningTotemIds = new Set(
              statuses.filter((s) => s.status === AgentSessionStatus.Running).map((s) => s.totemId)
            );
          }
        }
      )
    );

    this.#unsubscribe = unsubscribe;
  }

  unsubscribe(): void {
    if (this.#unsubscribe) {
      this.#unsubscribe();
      this.#unsubscribe = null;
    }
  }

  isRunning(totemId: string): boolean {
    return this.runningTotemIds.has(totemId);
  }
}

export const agentStatusesStore = new AgentStatusesStore();
