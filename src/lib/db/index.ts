import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

const isBuildTime = !process.env.TURSO_DATABASE_URL;

const client = isBuildTime
  ? (null as unknown as ReturnType<typeof createClient>)
  : createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });

export const db = isBuildTime
  ? (null as unknown as ReturnType<typeof drizzle<typeof schema>>)
  : drizzle(client, { schema });
