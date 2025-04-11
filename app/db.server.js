import { PrismaClient } from "@prisma/client";

// Create a singleton Prisma Client instance
let prisma;

if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient();
} else {
  // In development, create a singleton instance to prevent multiple connections
  if (!global.prismaGlobal) {
    global.prismaGlobal = new PrismaClient({
      log: ["query", "error", "warn"],
    });
  }
  prisma = global.prismaGlobal;
}

// Add connection retry logic
prisma.$connect()
  .catch(e => {
    console.error("Failed to connect to the database:", e);
    // Don't throw during build process
    if (process.env.SKIP_BUILD_SCRIPT !== "true") {
      throw e;
    }
  });

export default prisma;
