import { defineConfig } from "drizzle-kit";
import { join } from 'path';

export default defineConfig({
  schema: "./shared/schema.ts",
  dialect: "sqlite",
  out: "./drizzle",
  dbCredentials: {
    url: join(process.cwd(), 'db', 'database.sqlite'),
  },
  verbose: true,
  strict: true,
});
