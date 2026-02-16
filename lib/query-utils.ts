/**
 * Query utilities for case-insensitive database operations
 * 
 * These utilities ensure all search terms are normalized to lowercase
 * before executing Supabase queries, providing consistent case-insensitive matching.
 */

/**
 * Normalize a string to lowercase for database queries
 * @param value - The value to normalize
 * @returns Lowercase string or null if input is null/undefined
 */
export function normalizeForQuery(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return value.toLowerCase();
}

/**
 * Normalize an array of strings to lowercase for database queries
 * @param values - The array of values to normalize
 * @returns Array of lowercase strings
 */
export function normalizeArrayForQuery(values: string[]): string[] {
  return values.map(v => v.toLowerCase());
}

/**
 * Build a case-insensitive equality filter for Supabase
 * @param column - Column name
 * @param value - Value to match (will be lowercased)
 * @returns Supabase filter string
 */
export function caseInsensitiveEq(column: string, value: string): string {
  return `${column}.eq.${normalizeForQuery(value)}`;
}

/**
 * Build a case-insensitive IN filter for Supabase
 * @param column - Column name
 * @param values - Values to match (will be lowercased)
 * @returns Supabase filter string
 */
export function caseInsensitiveIn(column: string, values: string[]): string {
  const normalizedValues = normalizeArrayForQuery(values).join(',');
  return `${column}.in.(${normalizedValues})`;
}

/**
 * Example usage:
 * 
 * // Simple equality
 * const category = normalizeForQuery(userInput);
 * await supabase.from('agent_templates').select('*').eq('category', category);
 * 
 * // Array matching
 * const names = normalizeArrayForQuery(['Manager L3', 'Hotel Expert L2']);
 * await supabase.from('agent_templates').select('*').in('name', names);
 * 
 * // With filter string
 * const filter = caseInsensitiveEq('discipline', 'Frontend_Design');
 * await supabase.from('agent_templates').select('*').or(filter);
 */
