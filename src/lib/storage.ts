export function foyerKey(key: string, uid?: string | null): string {
  return uid ? `foyer_${uid}_${key}` : `foyer_${key}`;
}
