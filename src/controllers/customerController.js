const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// 1. ADD PURCHASE (Saves to Customer AND Dashboard)
exports.addPurchase = async (req, res) => {
  const { customerId } = req.params;
  const { amount, paid, description, date } = req.body;
  const userId = req.user.id; // Crucial: Dashboard needs to know WHICH user gets the income

  try {
    // This ensures BOTH the Customer record and the Dashboard record save together
    const result = await prisma.$transaction(async (tx) => {
      // Step A: Record the purchase for the individual customer
      const purchase = await tx.purchase.create({
        data: {
          amount: parseFloat(amount),
          paid: parseFloat(paid) || 0,
          description: description || "Customer Purchase",
          date: date ? new Date(date) : new Date(),
          customer: { connect: { id: customerId } },
        },
        include: { customer: true }, // Gets customer name for the dashboard entry
      });

      // Step B: Inject this into the Dashboard (Transaction API)
      // We only do this if the customer actually handed you cash (paid > 0)
      if (parseFloat(paid) > 0) {
        await tx.transaction.create({
          data: {
            userId: userId,
            type: "income", // This makes it show up in the Income card on Dashboard
            amount: parseFloat(paid),
            category: "Customer Payment", // Matches your dashboard categories
            description: `Payment from ${purchase.customer.name}`,
            date: date ? new Date(date) : new Date(),
          },
        });
      }

      return purchase;
    });

    res.status(201).json(result);
  } catch (error) {
    console.error("Dashboard Sync Failed:", error);
    res.status(500).json({ error: "Failed to save purchase to dashboard" });
  }
};

// 2. PAY PENDING (When customer pays later, adds to Dashboard again)
exports.updatePayment = async (req, res) => {
  const { purchaseId } = req.params;
  const { additionalPaid } = req.body;
  const userId = req.user.id;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Update customer's pending debt
      const updatedPurchase = await tx.purchase.update({
        where: { id: purchaseId },
        data: {
          paid: { increment: parseFloat(additionalPaid) },
        },
        include: { customer: true },
      });

      // Add the new cash received to the Dashboard Transactions
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
    res.status(500).json({ error: "Failed to update dashboard balance" });
  }
};
