import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "dotenv";
import { join } from "path";
// yolo
config({ path: join("..", ".env") });
config({ path: join(".env") });
export const createDB = () => {
  console.log("conn string we got", process.env.CONNECTION_STRING);
  const sql = postgres(
    "postgresql://test_user:test_password@localhost:5432/test_db",
    { max: 1 }
  );
  return { db: drizzle(sql), sql };
};
