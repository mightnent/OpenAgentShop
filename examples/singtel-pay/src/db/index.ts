import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { mkdirSync } from "fs";
import { dirname } from "path";

// Extract file path from DATABASE_URL (file:./data/singtel.db -> ./data/singtel.db)
const dbPath = (process.env.DATABASE_URL || "file:./data/singtel.db").replace("file:", "");

// Create data directory if it doesn't exist
try {
  mkdirSync(dirname(dbPath), { recursive: true });
} catch (err) {
  // Directory might already exist
}

const sqlite = new Database(dbPath);
export const db = drizzle(sqlite, { schema });
