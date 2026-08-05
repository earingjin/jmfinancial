import { useMemo, useState, useCallback } from 'react';
import { initialFormData } from './initialFormData';
import { setIn } from './pathUtils';
import { FormContext } from './formState';

export function FormProvider({ children }) {
  const [formData, setFormData] = useState(initialFormData);

  // path 예: "income.salary.monthly"
  const setField = useCallback((path, value) => {
    setFormData((prev) => setIn(prev, path, value));
  }, []);

  const addListItem = useCallback((path, item) => {
    setFormData((prev) => {
      const list = path.split('.').reduce((acc, k) => acc[k], prev) || [];
      return setIn(prev, path, [...list, item]);
    });
  }, []);

  const removeListItem = useCallback((path, index) => {
    setFormData((prev) => {
      const list = path.split('.').reduce((acc, k) => acc[k], prev) || [];
      return setIn(prev, path, list.filter((_, i) => i !== index));
    });
  }, []);

  const updateListItem = useCallback((path, index, key, value) => {
    setFormData((prev) => {
      const list = path.split('.').reduce((acc, k) => acc[k], prev) || [];
      const updated = list.map((item, i) => (i === index ? { ...item, [key]: value } : item));
      return setIn(prev, path, updated);
    });
  }, []);

  const value = useMemo(
    () => ({ formData, setField, addListItem, removeListItem, updateListItem, setFormData }),
    [formData, setField, addListItem, removeListItem, updateListItem]
  );

  return <FormContext.Provider value={value}>{children}</FormContext.Provider>;
}
