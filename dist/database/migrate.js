"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const db_1 = require("../config/db");
async function runMigration() {
    try {
        const migrationPath = path_1.default.join(__dirname, "migrations", "001_init.sql");
        const sql = fs_1.default.readFileSync(migrationPath, "utf-8");
        console.log("Running database migrations...");
        await db_1.pool.query(sql);
        console.log("Migrations executed successfully.");
    }
    catch (error) {
        console.error("Migration failed:", error);
    }
    finally {
        await db_1.pool.end();
    }
}
runMigration();
