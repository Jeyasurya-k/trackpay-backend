const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// 1. ADD NEW PURCHASE (Updates Customer Ledger + Dashboard Dashboard)
exports.addPurchase = async (req, res) => {
  const { customerId } = req.params;
  const { amount, paid, description, date } = req.body;
  const userId = req.user.id; // Extracted from your Auth Middleware

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Step A: Create the Purchase record
      const purchase = await tx.purchase.create({
        data: {
          amount: parseFloat(amount),
          paid: parseFloat(paid) || 0,
          description: description || "New Purchase",
          date: date ? new Date(date) : new Date(),
          customer: { connect: { id: customerId } },
        },
        include: { customer: true }, // To get customer name for the dashboard
      });

      // Step B: If money was paid, add it to the Dashboard Transactions
      if (parseFloat(paid) > 0) {
        await tx.transaction.create({
          data: {
            userId: userId,
            type: "income",
            amount: parseFloat(paid),
            category: "Customer Payment",
            description: `Payment from ${purchase.customer.name}`,
            date: date ? new Date(date) : new Date(),
          },
        });
      }
      return purchase;
    });

    res.status(201).json(result);
  } catch (error) {
    console.error("Sync Error:", error);
    res.status(500).json({ error: "Failed to sync purchase to dashboard" });
  }
};

// 2. UPDATE PAYMENT (When customer pays later)
exports.updatePayment = async (req, res) => {
  const { purchaseId } = req.params;
  const { additionalPaid } = req.body;
  const userId = req.user.id;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Step A: Update the purchase amount
      const updatedPurchase = await tx.purchase.update({
        where: { id: purchaseId },
        data: {
          paid: { increment: parseFloat(additionalPaid) },
        },
        include: { customer: true },
      });

      // Step B: Add this new cash flow to the Dashboard
      if (parseFloat(additionalPaid) > 0) {
        await tx.transaction.create({
          data: {
            userId: userId,
            type: "income",
            amount: parseFloat(additionalPaid),
            category: "Debt Recovery",
            description: `Debt cleared by ${updatedPurchase.customer.name}`,
            date: new Date(),
          },
        });
      }
      return updatedPurchase;
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to update balance" });
  }
};
