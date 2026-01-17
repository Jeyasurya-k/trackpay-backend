const express = require("express");
const authMiddleware = require("../middleware/auth");

const router = express.Router();
router.use(authMiddleware);

router.get("/", async (req, res) => {
  try {
    const { type, category, startDate, endDate } = req.query;
    const where = { userId: req.userId };

    if (type) where.type = type;
    if (category) where.category = category;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const transactions = await req.prisma.transaction.findMany({
      where,
      orderBy: { date: "desc" },
    });

    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { type, amount, category, description, date } = req.body;

    if (!type || !amount || !category) {
      return res
        .status(400)
        .json({ error: "Type, amount, and category are required" });
    }

    const transaction = await req.prisma.transaction.create({
      data: {
        type,
        amount: parseFloat(amount),
        category,
        description: description || null,
        date: date ? new Date(date) : new Date(),
        userId: req.userId,
      },
    });

    res.status(201).json(transaction);
  } catch (error) {
    res.status(500).json({ error: "Failed to create transaction" });
  }
});

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
    res.status(500).json({ error: "Failed to delete transaction" });
  }
});

router.get("/summary", async (req, res) => {
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
    res.status(500).json({ error: "Failed to get summary" });
  }
});

module.exports = router;
