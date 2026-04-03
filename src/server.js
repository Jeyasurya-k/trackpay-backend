require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const hpp = require("hpp");
const { PrismaClient } = require("@prisma/client");

// Import Routes
const authRoutes = require("./routes/auth");
const transactionRoutes = require("./routes/transactions");
const customerRoutes = require("./routes/customers");
const reportRoutes = require("./routes/reports");
let groupRoutes;
try {
  groupRoutes = require("./routes/groups");
  console.log("✓ groupRoutes loaded");
} catch (e) {
  console.log("✗ ERROR loading groupRoutes:", e.message);
  groupRoutes = null;
}

// --- VERSION CONTROL CONFIGURATION ---
const LATEST_APP_VERSION = "1.2.0";
const UPDATE_URL =
  "https://expo.dev/artifacts/eas/vp6goWXbPVZc2m9VpJX4QP.apk";

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

console.log("🔧 SERVER INITIALIZED - About to set up middleware");

// ===== SECURITY MIDDLEWARE =====

// 0. Early logging to catch all requests
app.use((req, res, next) => {
  if (req.path.includes("groups")) {
    console.log(`[EARLY] ${req.method} ${req.path} (originalUrl: ${req.originalUrl})`);
  }
  next();
});

// 1. Helmet — sets secure HTTP headers (XSS protection, content-type sniffing, etc.)
app.use(helmet());

// 2. CORS — whitelist specific origins only
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : [
      "http://localhost:8081",
      "http://localhost:19006",
      "http://localhost:3000",
      "https://trackpay--1a3rdnyuyp.expo.app",
    ];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, server-to-server)
      if (!origin) return callback(null, true);
      // Allow any expo.app subdomain for dev tunnels
      if (origin.endsWith(".expo.app") || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    maxAge: 86400, // Cache preflight for 24 hours
  }),
);

// 3. Rate Limiting — prevent brute force & DoS attacks
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 requests per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});
app.use("/api/", globalLimiter);

// Strict rate limit on auth routes (login/signup)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Only 10 login attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again after 15 minutes." },
});
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/signup", authLimiter);

// 4. HTTP Parameter Pollution protection
app.use(hpp());

// 5. Body parsers with size limits
app.use(express.json({ limit: "10kb" })); // Prevent large payload attacks
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// 6. Request logging (sanitized — no sensitive data)
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ${req.ip}`);
  next();
});

// 7. Inject Prisma into the request object
app.use((req, res, next) => {
  req.prisma = prisma;
  next();
});

// --- NEW CONFIGURATION ENDPOINT ---
app.get("/api/app-config", (req, res) => {
  res.json({
    latestVersion: LATEST_APP_VERSION,
    forceUpdate: true,
    updateUrl: UPDATE_URL,
    message:
      "A new version of TrackPay is available with improved sync and bug fixes.",
  });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/reports", reportRoutes);
if (groupRoutes) {
  console.log("ℹ️  Mounting groupRoutes at /api/groups");
  app.use("/api/groups", groupRoutes);
}

// Root route
app.get("/", (req, res) => {
  res.json({
    status: "OK",
    message: "TrackPay API is running",
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
    });
  }
});

// TEST ENDPOINT - defined AFTER health check
app.get("/api/test-endpoint", (req, res) => {
  console.log("✓ TEST ENDPOINT HIT!");
  res.json({ test: true, message: "Test endpoint is working!" });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
  });
});

// Global Error handling — NEVER expose internals to client
app.use((err, req, res, next) => {
  console.error("Server Error:", err.stack);
  res.status(500).json({
    error: "Internal server error",
  });
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`
  🚀 TrackPay API Live (with test-endpoint)
  Port: ${PORT}
  Version: ${LATEST_APP_VERSION}
  Environment: ${process.env.NODE_ENV || "production"}
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

process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err.message, err.stack);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED REJECTION:", reason);
  process.exit(1);
});

process.on("exit", (code) => {
  console.log("PROCESS EXITING with code:", code);
});
