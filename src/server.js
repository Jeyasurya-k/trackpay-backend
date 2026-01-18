require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");

// Import Routes
const authRoutes = require("./routes/auth");
const transactionRoutes = require("./routes/transactions");
const customerRoutes = require("./routes/customers");

// --- VERSION CONTROL CONFIGURATION ---
const LATEST_APP_VERSION = "1.1.3";
const UPDATE_URL = "https://expo.dev/artifacts/eas/2PeXksNtsf6Xs79bBMtZD3.apk";

const app = express();

/**
 * Prisma 5 with Neon Optimization
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

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Inject Prisma into the request object
app.use((req, res, next) => {
  req.prisma = prisma;
  next();
});

// --- NEW CONFIGURATION ENDPOINT ---
app.get("/api/app-config", (req, res) => {
  res.json({
    latestVersion: LATEST_APP_VERSION,
    forceUpdate: true, // Set to false if you want the modal to be skippable
    updateUrl: UPDATE_URL,
    message:
      "A new version of TrackPay is available with improved sync and bug fixes.",
  });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/customers", customerRoutes);

// Root route - Updated to show dynamic version
app.get("/", (req, res) => {
  res.json({
    status: "OK",
    message: "TrackPay API is running on Render",
    version: LATEST_APP_VERSION,
    environment: process.env.NODE_ENV || "production",
  });
});

// Health check endpoint
app.get("/api/health", async (req, res) => {
  try {
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

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.originalUrl,
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
✅ Version: ${LATEST_APP_VERSION}
✅ Environment: ${process.env.NODE_ENV || "production"}
  `);
});

// Graceful shutdown
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
