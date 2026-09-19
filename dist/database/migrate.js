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
        const migrationsDir = path_1.default.join(__dirname, "migrations");
        const files = fs_1.default.readdirSync(migrationsDir).filter(f => f.endsWith(".sql")).sort();
        console.log("Running database migrations...");
        for (const file of files) {
            console.log(`Running migration: ${file}`);
            const sql = fs_1.default.readFileSync(path_1.default.join(migrationsDir, file), "utf-8");
            await db_1.pool.query(sql);
        }
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
