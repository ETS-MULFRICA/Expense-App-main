import session from "express-session";
import { PostgresStorage } from "./postgres-storage";

// Create a session store for PostgresStorage
const sessionStore = new session.MemoryStore();
export const storage = new PostgresStorage(sessionStore);
