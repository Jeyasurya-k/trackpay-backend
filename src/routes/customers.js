const express = require("express");
const authMiddleware = require("../middleware/auth");

const router = express.Router();
router.use(authMiddleware);

// Get all customers with summary
router.get("/", async (req, res) => {
  try {
    const customers = await req.prisma.customer.findMany({
      where: { userId: req.userId },
      include: {
        purchases: {
          orderBy: { date: "desc" },
        },
      },
    });

    const summary = customers.reduce(
      (acc, customer) => {
        const totalAmount = customer.purchases.reduce(
          (sum, p) => sum + p.amount,
          0,
        );
        const totalPaid = customer.purchases.reduce(
          (sum, p) => sum + p.paid,
          0,
        );
        return {
          totalAmount: acc.totalAmount + totalAmount,
          totalPending: acc.totalPending + (totalAmount - totalPaid),
        };
      },
      { totalAmount: 0, totalPending: 0 },
    );

    res.json({ customers, summary });
  } catch (error) {
    console.error("Get customers error:", error);
    res.status(500).json({ error: "Failed to fetch customers" });
  }
});

// Get single customer
router.get("/:id", async (req, res) => {
  try {
    const customer = await req.prisma.customer.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId,
      },
      include: {
        purchases: {
          orderBy: { date: "desc" },
        },
      },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    res.json(customer);
  } catch (error) {
    console.error("Get customer error:", error);
    res.status(500).json({ error: "Failed to fetch customer" });
  }
});

// Create customer
router.post("/", async (req, res) => {
  try {
    const { name, phone, location } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: "Name and phone are required" });
    }

    const customer = await req.prisma.customer.create({
      data: {
        name,
        phone,
        location: location || null,
        userId: req.userId,
      },
      include: { purchases: true },
    });

    res.status(201).json(customer);
  } catch (error) {
    console.error("Create customer error:", error);
    res.status(500).json({ error: "Failed to create customer" });
  }
});

// Add purchase - SYNCS TO DASHBOARD
router.post("/:id/purchases", async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, paid, description, date } = req.body;

    const customer = await req.prisma.customer.findFirst({
      where: { id, userId: req.userId },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    if (!amount) {
      return res.status(400).json({ error: "Amount is required" });
    }

    console.log("Creating purchase with sync to dashboard...");
    console.log("Customer:", customer.name);
    console.log("Amount:", amount, "Paid:", paid);

    // Use transaction to ensure both records are created
    const result = await req.prisma.$transaction(async (tx) => {
      // 1. Create Purchase
      const purchase = await tx.purchase.create({
        data: {
          amount: parseFloat(amount),
          paid: parseFloat(paid) || 0,
          description: description || "New Purchase",
          date: date ? new Date(date) : new Date(),
          customerId: id,
        },
      });

      console.log("Purchase created:", purchase.id);

      // 2. Create Income transaction if payment made
      if (parseFloat(paid) > 0) {
        const transaction = await tx.transaction.create({
          data: {
            userId: req.userId,
            type: "income",
            amount: parseFloat(paid),
            category: "Customer Payment",
            description: `Payment from ${customer.name}${description ? " - " + description : ""}`,
            date: date ? new Date(date) : new Date(),
          },
        });
        console.log("Dashboard transaction created:", transaction.id);
      }

      return purchase;
    });

    const updatedCustomer = await req.prisma.customer.findUnique({
      where: { id },
      include: {
        purchases: {
          orderBy: { date: "desc" },
        },
      },
    });

    res.status(201).json(updatedCustomer);
  } catch (error) {
    console.error("Add purchase error:", error);
    res.status(500).json({ error: "Failed to add purchase: " + error.message });
  }
});

// Update purchase payment - SYNCS TO DASHBOARD
router.put("/:customerId/purchases/:purchaseId", async (req, res) => {
  try {
    const { customerId, purchaseId } = req.params;
    const { paid } = req.body;

    const customer = await req.prisma.customer.findFirst({
      where: { id: customerId, userId: req.userId },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const currentPurchase = await req.prisma.purchase.findUnique({
      where: { id: purchaseId },
    });

    if (!currentPurchase) {
      return res.status(404).json({ error: "Purchase not found" });
    }

    const additionalPayment = parseFloat(paid) - currentPurchase.paid;

    console.log("Recording payment...");
    console.log("Customer:", customer.name);
    console.log("Previous paid:", currentPurchase.paid, "New paid:", paid);
    console.log("Additional payment:", additionalPayment);

    const result = await req.prisma.$transaction(async (tx) => {
      // 1. Update Purchase
      const purchase = await tx.purchase.update({
        where: { id: purchaseId },
        data: { paid: parseFloat(paid) },
      });

      console.log("Purchase updated");

      // 2. Create Income transaction for additional payment
      if (additionalPayment > 0) {
        const transaction = await tx.transaction.create({
          data: {
            userId: req.userId,
            type: "income",
            amount: additionalPayment,
            category: "Customer Payment",
            description: `Payment from ${customer.name}${currentPurchase.description ? " - " + currentPurchase.description : ""}`,
            date: new Date(),
          },
        });
        console.log("Dashboard transaction created:", transaction.id);
      }

      return purchase;
    });

    const updatedCustomer = await req.prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        purchases: {
          orderBy: { date: "desc" },
        },
      },
    });

    res.json(updatedCustomer);
  } catch (error) {
    console.error("Update purchase error:", error);
    res
      .status(500)
      .json({ error: "Failed to update purchase: " + error.message });
  }
});

// Delete customer
router.delete("/:id", async (req, res) => {
  try {
    const existing = await req.prisma.customer.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });

    if (!existing) {
      return res.status(404).json({ error: "Customer not found" });
    }

    await req.prisma.customer.delete({
      where: { id: req.params.id },
    });

    res.json({ message: "Customer deleted successfully" });
  } catch (error) {
    console.error("Delete customer error:", error);
    res.status(500).json({ error: "Failed to delete customer" });
  }
});

module.exports = router;
