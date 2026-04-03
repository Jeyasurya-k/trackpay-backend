const express = require("express");
const authMiddleware = require("../middleware/auth");
const {
  validateCreateCustomer,
  validateAddPurchase,
  validateUpdatePayment,
} = require("../middleware/validate");

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
    console.error("Get customers error:", error.message);
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
    console.error("Get customer error:", error.message);
    res.status(500).json({ error: "Failed to fetch customer" });
  }
});

// Create customer
router.post("/", validateCreateCustomer, async (req, res) => {
  try {
    const { name, phone, location } = req.body;

    const customer = await req.prisma.customer.create({
      data: {
        name: name.trim(),
        phone: phone.trim(),
        location: location ? location.trim() : null,
        userId: req.userId,
      },
      include: { purchases: true },
    });

    res.status(201).json(customer);
  } catch (error) {
    console.error("Create customer error:", error.message);
    res.status(500).json({ error: "Failed to create customer" });
  }
});

// Add purchase — SYNCS TO DASHBOARD
router.post("/:id/purchases", validateAddPurchase, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, paid, description, date } = req.body;

    const customer = await req.prisma.customer.findFirst({
      where: { id, userId: req.userId },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const parsedPaid = parseFloat(paid) || 0;
    const parsedAmount = parseFloat(amount);

    if (parsedPaid > parsedAmount) {
      return res.status(400).json({ error: "Paid amount cannot exceed total amount" });
    }

    const result = await req.prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.create({
        data: {
          amount: parsedAmount,
          paid: parsedPaid,
          description: description ? description.trim() : "New Purchase",
          date: date ? new Date(date) : new Date(),
          customerId: id,
        },
      });

      if (parsedPaid > 0) {
        await tx.transaction.create({
          data: {
            userId: req.userId,
            type: "income",
            amount: parsedPaid,
            category: "Customer Payment",
            description: `Payment from ${customer.name}${description ? " - " + description.trim() : ""}`,
            date: date ? new Date(date) : new Date(),
          },
        });
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
    console.error("Add purchase error:", error.message);
    res.status(500).json({ error: "Failed to add purchase" });
  }
});

// Update purchase payment — SYNCS TO DASHBOARD
router.put(
  "/:customerId/purchases/:purchaseId",
  validateUpdatePayment,
  async (req, res) => {
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

      const parsedPaid = parseFloat(paid);
      if (parsedPaid > currentPurchase.amount) {
        return res.status(400).json({ error: "Paid amount cannot exceed purchase amount" });
      }

      const additionalPayment = parsedPaid - currentPurchase.paid;

      const result = await req.prisma.$transaction(async (tx) => {
        const purchase = await tx.purchase.update({
          where: { id: purchaseId },
          data: { paid: parsedPaid },
        });

        if (additionalPayment > 0) {
          await tx.transaction.create({
            data: {
              userId: req.userId,
              type: "income",
              amount: additionalPayment,
              category: "Customer Payment",
              description: `Payment from ${customer.name}${currentPurchase.description ? " - " + currentPurchase.description : ""}`,
              date: new Date(),
            },
          });
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
      console.error("Update purchase error:", error.message);
      res.status(500).json({ error: "Failed to update purchase" });
    }
  },
);

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
    console.error("Delete customer error:", error.message);
    res.status(500).json({ error: "Failed to delete customer" });
  }
});

module.exports = router;
