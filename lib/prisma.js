import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import prismaClientPkg from "@prisma/client";
import { config } from "../src/config/env.js";

const { PrismaClient } = prismaClientPkg;

const pool = new pg.Pool({
  connectionString: config.databaseUrl,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export { prisma };