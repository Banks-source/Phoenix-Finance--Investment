export const MIN_PASSWORD_LENGTH = 10;

/** Returns a user-facing problem with the requested change, or null if it's acceptable. */
export function validatePasswordChange(current: string, next: string, confirm: string): string | null {
  if (!current) return "Enter your current password.";
  if (next.length < MIN_PASSWORD_LENGTH) return `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (next === current) return "New password must be different from your current one.";
  if (next !== confirm) return "The new passwords don't match.";
  return null;
}
