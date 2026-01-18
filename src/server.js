require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");

// Import Routes
const authRoutes = require("./routes/auth");
const transactionRoutes = require("./routes/transactions");
const customerRoutes = require("./routes/customers");

const app = express();

/**
 * Prisma 5 with Neon Optimization
 * In production (Render/Neon), we initialize Prisma once.
 */
const prisma = new PrismaClient({
  log:
    process.env.NODE_ENV === "development"
      ? ["query", "error", "warn"]
      : ["error"],
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging (Enhanced for debugging 404s)
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Inject Prisma into the request object
app.use((req, res, next) => {
  req.prisma = prisma;
  next();
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/customers", customerRoutes);

// Root route - Helpful for checking if the live server is up
app.get("/", (req, res) => {
  res.json({
    status: "OK",
    message: "TrackPay API is running on Render",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "production",
  });
});

app.get("/api/health", async (req, res) => {
  try {
    // A simple query to verify database connectivity
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: "healthy",
      database: "connected",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      database: "disconnected",
      error: error.message,
    });
  }
});

// 404 handler (Catch-all for undefined routes)
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.originalUrl,
    hint: "Check if you are using the correct prefix like /api/auth/login",
  });
});

// Global Error handling
app.use((err, req, res, next) => {
  console.error("Critical Error:", err.stack);
  res.status(500).json({
    error: "Internal server error",
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Something went wrong",
  });
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`
🚀 TrackPay API Live
📍 Port: ${PORT}
✅ Environment: ${process.env.NODE_ENV || "production"}
✅ Database: Ready
  `);
});

// Graceful shutdown logic for Render
const gracefullyShutdown = async (signal) => {
  console.log(`${signal} received. Shutting down gracefully...`);
  server.close(async () => {
    await prisma.$disconnect();
    console.log("Database disconnected. Process exited.");
    process.exit(0);
  });
};

process.on("SIGTERM", () => gracefullyShutdown("SIGTERM"));
process.on("SIGINT", () => gracefullyShutdown("SIGINT"));
