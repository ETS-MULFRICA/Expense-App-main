import session from "express-session";
import { PostgresStorage } from "./postgres-storage";

/**
 * Storage Factory
 * Returns a PostgresStorage instance backed by an in-memory SessionStore.
 */
export async function createStorage() {
  const sessionStore = new session.MemoryStore();
  return new PostgresStorage(sessionStore);
}
