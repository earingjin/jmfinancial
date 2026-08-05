import { createContext, useContext } from 'react';

export const FormContext = createContext(null);

export function useFormData() {
  const ctx = useContext(FormContext);
  if (!ctx) throw new Error('useFormData must be used within FormProvider');
  return ctx;
}
