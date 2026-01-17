const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

// 1. Create a connection pool using your DATABASE_URL
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// 2. Initialize the adapter
const adapter = new PrismaPg(pool);

// 3. Pass the adapter to the Prisma Client
const prisma = new PrismaClient({ adapter });

module.exports = prisma;
