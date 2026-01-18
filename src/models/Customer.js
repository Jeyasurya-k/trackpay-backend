const Customer = require("../models/Customer");
const Transaction = require("../models/Transaction");
const mongoose = require("mongoose");

// Add a new purchase to a customer
exports.addPurchase = async (req, res) => {
  // Start a session for atomicity
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { customerId } = req.params;
    const { amount, paid, description, date } = req.body;
    const userId = req.user.id;

    // 1. Update Customer Purchase History
    const customer = await Customer.findOne({
      _id: customerId,
      userId,
    }).session(session);

    if (!customer) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Customer not found" });
    }

    const newPurchase = {
      amount: parseFloat(amount),
      paid: parseFloat(paid) || 0,
      description: description || `Items bought by ${customer.name}`,
      date: date || new Date(),
    };

    customer.purchases.push(newPurchase);
    await customer.save({ session });

    // 2. Auto-Sync to Dashboard Transactions (as Income)
    if (newPurchase.paid > 0) {
      await Transaction.create(
        [
          {
            userId,
            type: "income",
            amount: newPurchase.paid,
            category: "Customer Payment",
            description: `Received from ${customer.name}: ${newPurchase.description}`,
            date: newPurchase.date,
          },
        ],
        { session },
      );
    }

    // Commit changes
    await session.commitTransaction();
    session.endSession();

    res.status(201).json(customer);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res
      .status(500)
      .json({ message: "Failed to sync transaction", error: error.message });
  }
};

// Update an existing purchase (When customer pays pending debt)
exports.updatePayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { customerId, purchaseId } = req.params;
    const { additionalPaid } = req.body;
    const userId = req.user.id;

    const customer = await Customer.findOne({
      _id: customerId,
      userId,
    }).session(session);
    const purchase = customer.purchases.id(purchaseId);

    if (!purchase) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Purchase record not found" });
    }

    // Update the paid amount in customer record
    purchase.paid += parseFloat(additionalPaid);
    await customer.save({ session });

    // Auto-Sync the new payment to Dashboard
    if (parseFloat(additionalPaid) > 0) {
      await Transaction.create(
        [
          {
            userId,
            type: "income",
            amount: parseFloat(additionalPaid),
            category: "Debt Recovery",
            description: `Pending payment cleared by ${customer.name}`,
            date: new Date(),
          },
        ],
        { session },
      );
    }

    await session.commitTransaction();
    session.endSession();

    res.json(customer);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ error: error.message });
  }
};
