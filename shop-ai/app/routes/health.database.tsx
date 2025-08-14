import { json, type LoaderFunction } from "@remix-run/node";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

export const loader: LoaderFunction = async ({ request }) => {
  try {
    // Test database connection
    await db.$queryRaw`SELECT 1`;
    
    // Check if sessions table exists and is accessible
    const sessionCount = await db.session.count();
    
    // Check if store information table exists
    const storeInfoCount = await db.storeInformation.count();
    
    return json({
      status: "healthy",
      database: "connected",
      tables: {
        sessions: sessionCount,
        storeInformation: storeInfoCount
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Database health check failed:", error);
    
    return json({
      status: "unhealthy",
      database: "disconnected",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}; 