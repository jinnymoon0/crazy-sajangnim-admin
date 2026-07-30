/*
 * The super admin is the only account allowed to remove other admins,
 * and can never be removed. Override with the SUPER_ADMIN_EMAIL env
 * variable if it ever needs to change without a code edit.
 */
export const SUPER_ADMIN_EMAIL = (
  process.env.SUPER_ADMIN_EMAIL ?? "jinnymoon0@gmail.com"
).toLowerCase();

export function isSuperAdmin(email: string | null | undefined): boolean {
  return Boolean(email) && email!.toLowerCase() === SUPER_ADMIN_EMAIL;
}
