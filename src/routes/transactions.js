const express = require("express");
const authMiddleware = require("../middleware/auth");
const {
  validateCreateTransaction,
  validateDateQuery,
  validateUUID,
} = require("../middleware/validate");

const router = express.Router();
router.use(authMiddleware);

// GET /transactions — with pagination + date validation
router.get("/", validateDateQuery, async (req, res) => {
  try {
    const { type, category, startDate, endDate, page = 1, limit = 50 } = req.query;
    const where = { userId: req.userId };

    if (type && ["income", "expense"].includes(type)) where.type = type;
    if (category) where.category = category;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

    const [transactions, total] = await Promise.all([
      req.prisma.transaction.findMany({
        where,
        orderBy: { date: "desc" },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      req.prisma.transaction.count({ where }),
    ]);

    res.json({
      transactions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("Fetch transactions error:", error.message);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

// POST /transactions
router.post("/", validateCreateTransaction, async (req, res) => {
  try {
    const { type, amount, category, description, date } = req.body;

    const transaction = await req.prisma.transaction.create({
      data: {
        type,
        amount: parseFloat(amount),
        category: category.trim(),
        description: description ? description.trim() : null,
        date: date ? new Date(date) : new Date(),
        userId: req.userId,
      },
    });

    res.status(201).json(transaction);
  } catch (error) {
    console.error("Create transaction error:", error.message);
    res.status(500).json({ error: "Failed to create transaction" });
  }
});

// DELETE /transactions/:id
router.delete("/:id", async (req, res) => {
  try {
    const existing = await req.prisma.transaction.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });

    if (!existing) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    await req.prisma.transaction.delete({ where: { id: req.params.id } });
    res.json({ message: "Transaction deleted successfully" });
  } catch (error) {
    console.error("Delete transaction error:", error.message);
    res.status(500).json({ error: "Failed to delete transaction" });
  }
});

// GET /transactions/summary
router.get("/summary", validateDateQuery, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const where = { userId: req.userId };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const transactions = await req.prisma.transaction.findMany({ where });

    const income = transactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
    const expense = transactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);

    const categoryBreakdown = {};
    transactions
      .filter((t) => t.type === "expense")
      .forEach((t) => {
        categoryBreakdown[t.category] =
          (categoryBreakdown[t.category] || 0) + t.amount;
      });

    res.json({ income, expense, balance: income - expense, categoryBreakdown });
  } catch (error) {
    console.error("Summary error:", error.message);
    res.status(500).json({ error: "Failed to get summary" });
  }
});

module.exports = router;
