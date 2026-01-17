require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");

const authRoutes = require("./routes/auth");
const transactionRoutes = require("./routes/transactions");
const customerRoutes = require("./routes/customers");

const app = express();
const prisma = new PrismaClient();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Make Prisma available to routes
app.use((req, res, next) => {
  req.prisma = prisma;
  next();
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/customers", customerRoutes);

// Root route
app.get("/", (req, res) => {
  res.json({
    status: "OK",
    message: "TrackPay API is running",
    version: "1.0.0",
    endpoints: {
      auth: "/api/auth (POST /login, POST /signup, GET /me)",
      transactions: "/api/transactions",
      customers: "/api/customers",
    },
  });
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    database: "connected",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Error handling
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

const PORT = process.env.PORT || 5000;

// Start server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🚀 TrackPay API Server Running                     ║
║                                                       ║
║   📍 Port: ${PORT}                                         ║
║   🔗 URL: http://localhost:${PORT}                        ║
║   📊 API: http://localhost:${PORT}/api                    ║
║   ✅ Database: Connected                              ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, closing server...");
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, closing server...");
  await prisma.$disconnect();
  process.exit(0);
});
