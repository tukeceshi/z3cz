import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CompositionEvent,
  type FocusEvent,
} from "react";

export interface BufferedTextValue {
  readonly value: string;
  readonly onChange: (value: string) => void;
  /** Persist immediately (blur, generate, overlay apply). */
  readonly flush: () => void;
  /** Replace local + persist immediately (e.g. expand overlay Done). */
  readonly commit: (value: string) => void;
  /** Replace local state without persisting (e.g. history selection). */
  readonly reset: (value: string) => void;
  readonly onFocus: () => void;
  readonly onBlur: () => void;
  readonly onCompositionStart: () => void;
  readonly onCompositionEnd: (event: CompositionEvent<HTMLTextAreaElement>) => void;
}

/**
 * Keep typing responsive for CJK IME: local state updates every keystroke,
 * while React Flow node data is only updated after composition ends + debounce.
 */
export function useBufferedTextValue(
  externalValue: string,
  onCommit: (value: string) => void,
  delayMs = 300
): BufferedTextValue {
  const [localValue, setLocalValue] = useState(externalValue);
  const [isFocused, setIsFocused] = useState(false);
  const composingRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);
  const localValueRef = useRef(localValue);
  const externalValueRef = useRef(externalValue);
  const onCommitRef = useRef(onCommit);

  localValueRef.current = localValue;
  externalValueRef.current = externalValue;
  onCommitRef.current = onCommit;

  useEffect(() => {
    if (isFocused || composingRef.current) return;
    setLocalValue(externalValue);
  }, [externalValue, isFocused]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      const pending = localValueRef.current;
      if (pending !== externalValueRef.current) {
        onCommitRef.current(pending);
      }
    };
  }, []);

  const clearScheduled = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const persist = useCallback((value: string) => {
    clearScheduled();
    if (value === externalValueRef.current) return;
    onCommitRef.current(value);
  }, [clearScheduled]);

  const schedulePersist = useCallback(
    (value: string) => {
      clearScheduled();
      timeoutRef.current = window.setTimeout(() => {
        timeoutRef.current = null;
        if (value === externalValueRef.current) return;
        onCommitRef.current(value);
      }, delayMs);
    },
    [clearScheduled, delayMs]
  );

  const onChange = useCallback(
    (value: string) => {
      setLocalValue(value);
      localValueRef.current = value;
      if (composingRef.current) return;
      schedulePersist(value);
    },
    [schedulePersist]
  );

  const flush = useCallback(() => {
    persist(localValueRef.current);
  }, [persist]);

  const commit = useCallback(
    (value: string) => {
      setLocalValue(value);
      localValueRef.current = value;
      persist(value);
    },
    [persist]
  );

  const reset = useCallback(
    (value: string) => {
      clearScheduled();
      composingRef.current = false;
      setIsFocused(false);
      setLocalValue(value);
      localValueRef.current = value;
    },
    [clearScheduled]
  );

  const onFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  const onBlur = useCallback(
    (_event?: FocusEvent<HTMLTextAreaElement>) => {
      setIsFocused(false);
      composingRef.current = false;
      persist(localValueRef.current);
    },
    [persist]
  );

  const onCompositionStart = useCallback(() => {
    composingRef.current = true;
    clearScheduled();
  }, [clearScheduled]);

  const onCompositionEnd = useCallback(
    (_event: CompositionEvent<HTMLTextAreaElement>) => {
      composingRef.current = false;
      schedulePersist(localValueRef.current);
    },
    [schedulePersist]
  );

  return {
    value: localValue,
    onChange,
    flush,
    commit,
    reset,
    onFocus,
    onBlur,
    onCompositionStart,
    onCompositionEnd,
  };
}
