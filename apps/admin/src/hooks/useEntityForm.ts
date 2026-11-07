import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { z } from 'zod';
import { ApiError } from '../api/client.ts';
import { ReauthCancelled } from '../app/session.tsx';
import { useHasUnsaved, useReportDirty } from '../app/unsaved.tsx';
import { useAuthedAction } from './useAuthedAction.ts';

type Options<V, R> = {
  initial: V;
  schema: z.ZodType;
  /** Ce que le formulaire envoie, par exemple un texte vide devenu nul. */
  toPayload?: (values: V) => unknown;
  save: (payload: never) => Promise<R>;
  onSaved?: (result: R) => void;
  /** Fige les champs pendant l'envoi : utile à la création, qui change ensuite de page. */
  lockWhileSaving?: boolean;
};

export type EntityForm<V> = {
  values: V;
  setField: <K extends keyof V>(key: K, value: V[K]) => void;
  errorFor: (path: string) => string | undefined;
  isDirty: boolean;
  saving: boolean;
  locked: boolean;
  saved: boolean;
  message: string | null;
  submit: (event?: FormEvent) => Promise<void>;
};

const UNSAVED_MESSAGE = 'Vos modifications n’ont pas été enregistrées.';

export const useEntityForm = <V, R = unknown>({ initial, schema, toPayload, save, onSaved, lockWhileSaving = false }: Options<V, R>): EntityForm<V> => {
  const queryClient = useQueryClient();
  const run = useAuthedAction();
  const [values, setValues] = useState<V>(initial);
  const [baseline, setBaseline] = useState(() => JSON.stringify(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedResult, setSavedResult] = useState<{ value: R } | null>(null);
  const saveInFlight = useRef(false);

  const isDirty = JSON.stringify(values) !== baseline;
  useReportDirty(isDirty);
  const hasUnsaved = useHasUnsaved();

  const callback = useRef(onSaved);
  callback.current = onSaved;

  // Attend que plus rien ne soit signalé comme non enregistré : une navigation ici ne doit pas demander confirmation.
  useEffect(() => {
    if (!savedResult || hasUnsaved) return;
    callback.current?.(savedResult.value);
    setSavedResult(null);
  }, [savedResult, hasUnsaved]);

  const setField = useCallback(<K extends keyof V>(key: K, value: V[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }, []);

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (saveInFlight.current) return;

    const parsed = schema.safeParse(toPayload ? toPayload(values) : values);
    if (!parsed.success) {
      setErrors(Object.fromEntries([...parsed.error.issues].reverse().map((issue) => [issue.path.join('.'), issue.message])));
      setMessage('Certains champs sont à corriger.');
      return;
    }

    saveInFlight.current = true;
    setSaving(true);
    setErrors({});
    setMessage(null);
    const sent = values;
    try {
      const result = await run(() => save(parsed.data as never));
      setBaseline(JSON.stringify(sent));
      setSaved(true);
      setSavedResult({ value: result });
      void queryClient.invalidateQueries();
    } catch (error) {
      if (error instanceof ReauthCancelled) setMessage(UNSAVED_MESSAGE);
      else if (error instanceof ApiError) {
        setErrors(Object.fromEntries(error.issues.map((issue) => [issue.path, issue.message])));
        setMessage(error.status === 0 ? `${error.message}. ${UNSAVED_MESSAGE}` : error.message);
      } else setMessage(UNSAVED_MESSAGE);
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  };

  return {
    values,
    setField,
    errorFor: (path) => errors[path],
    isDirty,
    saving,
    locked: lockWhileSaving && saving,
    saved: saved && !isDirty,
    message,
    submit,
  };
};
