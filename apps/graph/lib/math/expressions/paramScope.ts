// Pure parameter-scope helpers for expression compilers (S19).
//
// Compilers must be callable inside a Web Worker, where the Zustand store
// does not exist. They therefore take an explicit `params` snapshot instead
// of reading `getEditorParameterScope()` themselves, and key their caches on
// both the expression text and the snapshot signature (so a parameter change
// can never serve a stale cached evaluator).

export function getParamScopeSignature(params: Record<string, number>): string {
  return Object.keys(params)
    .sort()
    .map((key) => `${key}:${params[key]}`)
    .join("|");
}
