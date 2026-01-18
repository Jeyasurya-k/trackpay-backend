const Customer = require("../models/Customer");
const Transaction = require("../models/Transaction");
const mongoose = require("mongoose");
// controllers/customerController.js

/**
 * Add a new purchase to a customer and sync to Dashboard Transactions
 */
exports.addPurchase = async (req, res) => {
  const { customerId } = req.params;
  const { amount, paid, description, date } = req.body;
  const userId = req.user.id;
  const prisma = req.prisma; // Assumes prisma is attached to req in middleware

  try {
    // Start a Prisma Transaction to ensure both records are created
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the Purchase record for the customer
      const purchase = await tx.purchase.create({
        data: {
          amount: parseFloat(amount),
          paid: parseFloat(paid) || 0,
          description: description || "New Purchase",
          date: date ? new Date(date) : new Date(),
          customer: { connect: { id: customerId } },
        },
      });

      // 2. Automatically create an Income entry for the Main Dashboard
      if (parseFloat(paid) > 0) {
        await tx.transaction.create({
          data: {
            userId: userId,
            type: "income",
            amount: parseFloat(paid),
            category: "Customer Payment",
            description: `Payment from Customer (Purchase Ref: ${purchase.id})`,
            date: date ? new Date(date) : new Date(),
          },
        });
      }

      return purchase;
    });

    res.status(201).json(result);
  } catch (error) {
    console.error("Add Purchase Error:", error);
    res.status(500).json({
      message: "Failed to record purchase and sync dashboard",
      error: error.message,
    });
  }
};

/**
 * Update payment for an existing purchase (Clearing pending debt)
 */
exports.updatePayment = async (req, res) => {
  const { purchaseId } = req.params; // Using purchaseId directly is safer in SQL
  const { additionalPaid } = req.body;
  const userId = req.user.id;
  const prisma = req.prisma;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Find the purchase and update the 'paid' column
      const updatedPurchase = await tx.purchase.update({
        where: { id: purchaseId },
        data: {
          paid: { increment: parseFloat(additionalPaid) },
        },
        include: { customer: true }, // To get the customer name for the dashboard
      });

      // 2. Create the Income entry for the Main Dashboard
      if (parseFloat(additionalPaid) > 0) {
        await tx.transaction.create({
          data: {
            userId: userId,
            type: "income",
            amount: parseFloat(additionalPaid),
            category: "Debt Recovery",
            description: `Debt payment from ${updatedPurchase.customer.name}`,
            date: new Date(),
          },
        });
      }

      return updatedPurchase;
    });

    res.json(result);
  } catch (error) {
    console.error("Update Payment Error:", error);
    res.status(500).json({
      message: "Failed to update debt payment",
      error: error.message,
    });
  }
};
