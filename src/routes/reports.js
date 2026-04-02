const express = require("express");
const authMiddleware = require("../middleware/auth");

const router = express.Router();
router.use(authMiddleware);

// GET /api/reports/summary - Overall financial summary with monthly breakdown
router.get("/summary", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const where = { userId: req.userId };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const transactions = await req.prisma.transaction.findMany({
      where,
      orderBy: { date: "asc" },
    });

    // Overall totals
    const totalIncome = transactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = transactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);

    // Monthly breakdown
    const monthlyMap = {};
    transactions.forEach((t) => {
      const d = new Date(t.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthlyMap[key]) {
        monthlyMap[key] = { month: key, income: 0, expense: 0 };
      }
      if (t.type === "income") {
        monthlyMap[key].income += t.amount;
      } else {
        monthlyMap[key].expense += t.amount;
      }
    });

    const monthlyBreakdown = Object.values(monthlyMap).sort((a, b) =>
      a.month.localeCompare(b.month),
    );

    // Category breakdown (expenses)
    const expenseCategoryMap = {};
    transactions
      .filter((t) => t.type === "expense")
      .forEach((t) => {
        expenseCategoryMap[t.category] =
          (expenseCategoryMap[t.category] || 0) + t.amount;
      });

    const expenseByCategory = Object.entries(expenseCategoryMap)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    // Category breakdown (income)
    const incomeCategoryMap = {};
    transactions
      .filter((t) => t.type === "income")
      .forEach((t) => {
        incomeCategoryMap[t.category] =
          (incomeCategoryMap[t.category] || 0) + t.amount;
      });

    const incomeByCategory = Object.entries(incomeCategoryMap)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    res.json({
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      totalTransactions: transactions.length,
      monthlyBreakdown,
      expenseByCategory,
      incomeByCategory,
    });
  } catch (error) {
    console.error("Report summary error:", error);
    res.status(500).json({ error: "Failed to generate report summary" });
  }
});

// GET /api/reports/customers - Customer payment report
router.get("/customers", async (req, res) => {
  try {
    const customers = await req.prisma.customer.findMany({
      where: { userId: req.userId },
      include: {
        purchases: {
          orderBy: { date: "desc" },
        },
      },
    });

    const customerReport = customers
      .map((customer) => {
        const totalBilled = customer.purchases.reduce(
          (sum, p) => sum + p.amount,
          0,
        );
        const totalPaid = customer.purchases.reduce(
          (sum, p) => sum + p.paid,
          0,
        );
        const totalPending = totalBilled - totalPaid;
        const purchaseCount = customer.purchases.length;
        const lastPurchase =
          customer.purchases.length > 0 ? customer.purchases[0].date : null;

        return {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          location: customer.location,
          totalBilled,
          totalPaid,
          totalPending,
          purchaseCount,
          lastPurchase,
        };
      })
      .sort((a, b) => b.totalBilled - a.totalBilled);

    const overallTotalBilled = customerReport.reduce(
      (sum, c) => sum + c.totalBilled,
      0,
    );
    const overallTotalPaid = customerReport.reduce(
      (sum, c) => sum + c.totalPaid,
      0,
    );
    const overallTotalPending = customerReport.reduce(
      (sum, c) => sum + c.totalPending,
      0,
    );

    res.json({
      customers: customerReport,
      totalCustomers: customerReport.length,
      overallTotalBilled,
      overallTotalPaid,
      overallTotalPending,
    });
  } catch (error) {
    console.error("Customer report error:", error);
    res.status(500).json({ error: "Failed to generate customer report" });
  }
});

module.exports = router;
