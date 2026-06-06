import type { FilterGroup } from '../filter/filterBuilder.js';
import { filterFieldRoot, isSafePropertyKey } from '../utils/path.js';

/** Optional schema integration — pass a validator schema. */
export function validateFilterWithSchema(
  schema: { safeParse: (input: unknown) => { success: boolean; data?: FilterGroup; error?: unknown } },
  input: unknown,
): FilterGroup {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new Error('Invalid filter schema');
  }
  return assertFilterShape(result.data as FilterGroup);
}

export function assertFilterShape(group: FilterGroup): FilterGroup {
  const walk = (node: FilterGroup | { field: string; op: string }): void => {
    if ('field' in node) {
      if (!isSafePropertyKey(filterFieldRoot(node.field))) {
        throw new Error('Unsafe filter field');
      }
      return;
    }
    for (const clause of node.and ?? []) walk(clause as FilterGroup);
    for (const clause of node.or ?? []) walk(clause as FilterGroup);
    if (node.not) walk(node.not as FilterGroup);
  };
  walk(group);
  return group;
}
