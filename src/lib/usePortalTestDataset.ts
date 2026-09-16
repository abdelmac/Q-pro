import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { generatePortalTestDataset, parsePortalTestDatasetRecipe, type PortalTestDatasetRecipe } from '@/lib/portalTestData';

export type PortalDataMode = 'live' | 'test';
type RpcName = 'get_portal_test_dataset' | 'create_portal_test_dataset' | 'delete_portal_test_dataset';
interface RpcResult { data: unknown; error: { code?: string; message: string } | null; status?: number }
interface TestRpcClient {
  rpc: (name: RpcName, args?: { p_dataset_id: string }) => PromiseLike<RpcResult> & { abortSignal: (signal: AbortSignal) => PromiseLike<RpcResult> };
}

/** Recipes only. This hook never reads or mutates research response tables. */
export function usePortalTestDataset(enabled: boolean, onAccessLost: () => void, identity: string | null) {
  const [storedRecipe, setStoredRecipe] = useState<{ identity: string; recipe: PortalTestDatasetRecipe } | null>(null);
  const [choice, setChoice] = useState<{ identity: string | null; mode: PortalDataMode }>({ identity: null, mode: 'live' });
  const mode = choice.identity === identity ? choice.mode : 'live';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const identityRef = useRef(identity);
  identityRef.current = identity;
  const busyRef = useRef(false);

  const cancelRequest = useCallback(() => {
    generation.current++;
    controller.current?.abort();
    controller.current = null;
  }, []);
  const invalidate = useCallback(() => {
    cancelRequest();
    setStoredRecipe(null);
    setRevision(value => value + 1);
    busyRef.current = false;
    setBusy(false);
  }, [cancelRequest]);
  const clear = useCallback(() => {
    invalidate();
    setChoice({ identity, mode: 'live' });
    setError(false);
  }, [identity, invalidate]);

  const request = useCallback(async (name: RpcName, expectedId?: string) => {
    if (!enabledRef.current || !supabase || !identity) return;
    const requestId = ++generation.current;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const timeout = window.setTimeout(() => abort.abort(), 10_000);
    busyRef.current = true;
    setBusy(true);
    setError(false);
    // In test mode, an absent recipe is a blocked test view, never live fallback.
    setStoredRecipe(null);
    setRevision(value => value + 1);
    try {
      const client = supabase as unknown as TestRpcClient;
      const result = await client.rpc(name, expectedId ? { p_dataset_id: expectedId } : undefined).abortSignal(abort.signal);
      if (generation.current !== requestId || !enabledRef.current || identityRef.current !== identity) return;
      if (result.error) {
        if (result.error.code === '42501' || result.status === 401 || result.status === 403) {
          clear();
          onAccessLost();
          return;
        }
        throw new Error('Test recipe request failed');
      }
      if (name === 'delete_portal_test_dataset') {
        if (typeof result.data !== 'boolean') throw new Error('Invalid deletion receipt');
        setChoice({ identity, mode: 'live' });
      } else if (result.data !== null) {
        const parsed = parsePortalTestDatasetRecipe(result.data);
        // Validate/generate before exposing the recipe to rendering code.
        generatePortalTestDataset(parsed);
        setStoredRecipe({ identity, recipe: parsed });
        if (name === 'create_portal_test_dataset') setChoice({ identity, mode: 'test' });
      } else if (name === 'create_portal_test_dataset') {
        throw new Error('Missing creation receipt');
      }
    } catch {
      if (generation.current === requestId && enabledRef.current && identityRef.current === identity) setError(true);
    } finally {
      window.clearTimeout(timeout);
      if (generation.current === requestId) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }, [clear, onAccessLost, identity]);

  // A real account transition clears the choice. A repeated SIGNED_IN for the
  // same account is only revalidation and must never opt into live research.
  useEffect(() => {
    clear();
  }, [clear]);

  useEffect(() => {
    invalidate();
    if (!enabled || !identity || !supabase) return;
    void request('get_portal_test_dataset');
    const onFocus = () => { if (!busyRef.current) void request('get_portal_test_dataset'); };
    window.addEventListener('focus', onFocus);
    return () => {
      cancelRequest();
      window.removeEventListener('focus', onFocus);
    };
  }, [enabled, identity, invalidate, request, cancelRequest]);

  const dataset = useMemo(() => enabled && storedRecipe?.identity === identity ? generatePortalTestDataset(storedRecipe.recipe) : null, [enabled, storedRecipe, identity]);
  return {
    dataset,
    mode: identity ? mode : 'live' as PortalDataMode,
    busy,
    error,
    revision,
    clear,
    selectMode: (next: PortalDataMode) => { if (enabled && identity && !busyRef.current && (next === 'live' || dataset)) setChoice({ identity, mode: next }); },
    refresh: () => request('get_portal_test_dataset'),
    create: () => {
      if (enabled && identity && !busyRef.current) {
        setChoice({ identity, mode: 'test' });
        return request('create_portal_test_dataset');
      }
    },
    remove: (expectedId: string) => { if (!busyRef.current && dataset?.id === expectedId) return request('delete_portal_test_dataset', expectedId); },
  };
}
