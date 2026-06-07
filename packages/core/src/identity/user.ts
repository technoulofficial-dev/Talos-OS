/**
 * User Identity — persistent user_id for cortex sessions.
 *
 * Stores a UUID in .talos/user.json so the cortex can persist
 * across sessions without re-authentication.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..", "..", "..");
const USER_FILE = join(REPO_ROOT, ".talos", "user.json");

export interface UserIdentity {
  userId: string;
  displayName: string;
  createdAt: string;
}

let cachedIdentity: UserIdentity | null = null;

export async function getOrCreateUserIdentity(): Promise<UserIdentity> {
  if (cachedIdentity) return cachedIdentity;

  try {
    if (existsSync(USER_FILE)) {
      const raw = await readFile(USER_FILE, "utf-8");
      cachedIdentity = JSON.parse(raw) as UserIdentity;
      return cachedIdentity!;
    }
  } catch {
    // Corrupted file — regenerate
  }

  const identity: UserIdentity = {
    userId: randomUUID(),
    displayName: "Operator",
    createdAt: new Date().toISOString(),
  };

  await mkdir(dirname(USER_FILE), { recursive: true });
  await writeFile(USER_FILE, JSON.stringify(identity, null, 2), "utf-8");
  cachedIdentity = identity;
  return identity;
}

export async function getUserId(): Promise<string> {
  const identity = await getOrCreateUserIdentity();
  return identity.userId;
}
