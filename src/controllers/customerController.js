const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

exports.addPurchase = async (req, res) => {
  const { customerId } = req.params;
  const { amount, paid, description, date } = req.body;
  const userId = req.user.id; // The ID of the logged-in user (ab9b4805-...)

  try {
    // We use $transaction to ensure both actions happen at once
    const result = await prisma.$transaction(async (tx) => {
      // 1. Save the Purchase to the Customer history
      const purchase = await tx.purchase.create({
        data: {
          amount: parseFloat(amount),
          paid: parseFloat(paid) || 0,
          description: description || "New Purchase",
          date: date ? new Date(date) : new Date(),
          customer: { connect: { id: customerId } },
        },
        include: { customer: true }, // Need this to get the name for the description
      });

      // 2. THIS IS THE MISSING STEP: Add to Dashboard (Transactions Table)
      if (parseFloat(paid) > 0) {
        await tx.transaction.create({
          data: {
            userId: userId,
            type: "income",
            amount: parseFloat(paid),
            category: "Customer Payment", // Matches your Dashboard Categories
            description: `Payment from ${purchase.customer.name}`,
            date: date ? new Date(date) : new Date(),
          },
        });
      }

      return purchase;
    });

    res.status(201).json(result);
  } catch (error) {
    console.error("Dashboard Sync Error:", error);
    res
      .status(500)
      .json({ error: "Could not sync to dashboard", details: error.message });
  }
};
