import { useCallback, useState } from 'react';

import { invokeCommand, type CommandName, type CommandPayloads } from '@shared/utils/commands';

interface UseCommandState<TResult> {
  data: TResult | undefined;
  error: Error | undefined;
  loading: boolean;
}

/**
 * Tiny wrapper around invokeCommand that tracks loading/error state for one-shot calls.
 *
 * Intentionally minimal in V1 - prefer TanStack Query for cacheable command calls,
 * and reach for this hook only for fire-and-forget mutations.
 */
export function useCommand<TName extends CommandName>(
  name: TName,
): {
  readonly run: (
    payload: CommandPayloads[TName]['input'],
  ) => Promise<CommandPayloads[TName]['output']>;
  readonly data: CommandPayloads[TName]['output'] | undefined;
  readonly error: Error | undefined;
  readonly loading: boolean;
} {
  const [state, setState] = useState<UseCommandState<CommandPayloads[TName]['output']>>({
    data: undefined,
    error: undefined,
    loading: false,
  });

  const run = useCallback(
    async (payload: CommandPayloads[TName]['input']) => {
      setState({ data: undefined, error: undefined, loading: true });
      try {
        const result = await invokeCommand(name, payload);
        setState({ data: result, error: undefined, loading: false });
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setState({ data: undefined, error, loading: false });
        throw error;
      }
    },
    [name],
  );

  return { run, ...state };
}
