import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL!;

// no-store: Next.js patches fetch and may cache the driver's HTTP queries,
// which makes server-component DB reads return stale results (bit us on the
// /lp/[slug] status gate). DB queries must never be cached.
const sql = neon(databaseUrl, { fetchOptions: { cache: "no-store" } });

export const db = drizzle(sql, { schema });

export const rawSql = sql;
