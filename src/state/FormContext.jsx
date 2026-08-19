import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { initialFormData } from './initialFormData';
import { setIn } from './pathUtils';
import { FormContext } from './formState';
import { readDraft, writeDraft } from './draftStorage';

const mergeDraft = (defaults, saved) => {
  if (Array.isArray(defaults)) return Array.isArray(saved) ? saved : defaults;
  if (!defaults || typeof defaults !== 'object') return saved === undefined ? defaults : saved;
  const source = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  return Object.fromEntries(Object.keys(defaults).map((key) => [key, mergeDraft(defaults[key], source[key])]));
};

export function FormProvider({ children, userId, initialDraft, onDraftSaved }) {
  const [formData, setFormData] = useState(() => mergeDraft(initialFormData, initialDraft?.formData));
  const dirtyRef = useRef(false);

  const changeFormData = useCallback((updater) => {
    dirtyRef.current = true;
    setFormData(updater);
  }, []);

  useEffect(() => {
    if (!dirtyRef.current || !userId) return;
    const stepIndex = readDraft(userId)?.stepIndex || 0;
    const saved = writeDraft(userId, formData, stepIndex);
    if (saved) onDraftSaved?.(saved.updatedAt);
  }, [formData, onDraftSaved, userId]);

  // path 예: "income.salary.monthly"
  const setField = useCallback((path, value) => {
    changeFormData((prev) => setIn(prev, path, value));
  }, [changeFormData]);

  const addListItem = useCallback((path, item) => {
    changeFormData((prev) => {
      const list = path.split('.').reduce((acc, k) => acc[k], prev) || [];
      return setIn(prev, path, [...list, item]);
    });
  }, [changeFormData]);

  const removeListItem = useCallback((path, index) => {
    changeFormData((prev) => {
      const list = path.split('.').reduce((acc, k) => acc[k], prev) || [];
      return setIn(prev, path, list.filter((_, i) => i !== index));
    });
  }, [changeFormData]);

  const updateListItem = useCallback((path, index, key, value) => {
    changeFormData((prev) => {
      const list = path.split('.').reduce((acc, k) => acc[k], prev) || [];
      const updated = list.map((item, i) => (i === index ? { ...item, [key]: value } : item));
      return setIn(prev, path, updated);
    });
  }, [changeFormData]);

  const value = useMemo(
    () => ({ formData, setField, addListItem, removeListItem, updateListItem, setFormData: changeFormData }),
    [formData, setField, addListItem, removeListItem, updateListItem, changeFormData]
  );

  return <FormContext.Provider value={value}>{children}</FormContext.Provider>;
}
