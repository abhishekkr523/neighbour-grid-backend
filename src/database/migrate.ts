import fs from "fs";
import path from "path";
import { pool } from "../config/db";

async function runMigration() {
  try {
    const migrationPath = path.join(__dirname, "migrations", "001_init.sql");
    const sql = fs.readFileSync(migrationPath, "utf-8");

    console.log("Running database migrations...");
    await pool.query(sql);
    console.log("Migrations executed successfully.");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await pool.end();
  }
}

runMigration();
