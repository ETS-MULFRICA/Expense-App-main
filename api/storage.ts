import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { PostgresStorage } from "./postgres-storage";
import { pool } from "./db";

// Use a persistent session store in production so sessions survive serverless instances
const PgSession = connectPgSimple(session);
const sessionStore: session.Store =
	process.env.NODE_ENV === "production"
		? new PgSession({
				pool,
				tableName: "session",
				createTableIfMissing: true,
			})
		: new session.MemoryStore();

export const storage = new PostgresStorage(sessionStore);
