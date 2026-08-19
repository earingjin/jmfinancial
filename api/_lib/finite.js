export class NonFiniteCalculationError extends Error {
  constructor(path) {
    super(`CALCULATION_NON_FINITE:${path}`);
    this.name = 'NonFiniteCalculationError';
    this.code = 'CALCULATION_NON_FINITE';
  }
}

export function assertFiniteCalculationResult(value, path = 'result') {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new NonFiniteCalculationError(path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertFiniteCalculationResult(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => assertFiniteCalculationResult(item, `${path}.${key}`));
  }
}
