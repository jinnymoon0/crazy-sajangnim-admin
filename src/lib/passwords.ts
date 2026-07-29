import { randomBytes, scryptSync } from "node:crypto";

/*
 * Matches the scrypt format used by the main site
 * (crazy_sajangnim/src/lib/auth/passwords.ts) so admin-issued temporary
 * passwords work with the site's login.
 */
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;

export function hashSecret(secret: string): string {
  const salt = randomBytes(16);

  const key = scryptSync(secret.slice(0, 256), salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });

  return [
    "scrypt",
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString("base64"),
    key.toString("base64"),
  ].join("$");
}

const TEMP_PASSWORD_ALPHABET =
  "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateTemporaryPassword(): string {
  const bytes = randomBytes(14);

  let password = "";

  for (const byte of bytes) {
    password += TEMP_PASSWORD_ALPHABET[byte % TEMP_PASSWORD_ALPHABET.length];
  }

  return password;
}
