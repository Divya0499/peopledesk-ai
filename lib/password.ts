import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keyLength: number,
) => Promise<Buffer>;

const KEY_LENGTH = 64;
const SALT_BYTES = 16;

export const MIN_PASSWORD_LENGTH = 8;

// Stored as "scrypt$<salt>$<hash>" (both base64), so the salt travels with
// the hash and the scheme can change later without breaking old rows.
// scrypt is deliberately slow and memory-hard, which makes guessing
// passwords from a leaked database expensive.
export async function hashPassword(password: string) {
  const salt = randomBytes(SALT_BYTES);
  const hash = await scryptAsync(password, salt, KEY_LENGTH);

  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

// False for a wrong password and for a stored value it can't read.
// timingSafeEqual takes the same time however many bytes match, so the
// response time doesn't leak how close a guess was.
export async function verifyPassword(password: string, stored: string) {
  const [scheme, saltText, hashText] = stored.split("$");

  if (scheme !== "scrypt" || !saltText || !hashText) {
    return false;
  }

  const expected = Buffer.from(hashText, "base64");
  const actual = await scryptAsync(
    password,
    Buffer.from(saltText, "base64"),
    expected.length,
  );

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
