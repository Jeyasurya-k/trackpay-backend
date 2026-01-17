const express = require("express");
const authMiddleware = require("../middleware/auth");

const router = express.Router();
router.use(authMiddleware);

router.get("/", async (req, res) => {
  try {
    const customers = await req.prisma.customer.findMany({
      where: { userId: req.userId },
      include: { purchases: { orderBy: { date: "desc" } } },
    });

    const summary = customers.reduce(
      (acc, customer) => {
        const totalAmount = customer.purchases.reduce(
          (sum, p) => sum + p.amount,
          0
        );
        const totalPaid = customer.purchases.reduce(
          (sum, p) => sum + p.paid,
          0
        );
        return {
          totalAmount: acc.totalAmount + totalAmount,
          totalPending: acc.totalPending + (totalAmount - totalPaid),
        };
      },
      { totalAmount: 0, totalPending: 0 }
    );

    res.json({ customers, summary });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch customers" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const customer = await req.prisma.customer.findFirst({
      where: { id: req.params.id, userId: req.userId },
      include: { purchases: { orderBy: { date: "desc" } } },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch customer" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, phone, location } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: "Name and phone are required" });
    }

    const customer = await req.prisma.customer.create({
      data: { name, phone, location: location || null, userId: req.userId },
      include: { purchases: true },
    });

    res.status(201).json(customer);
  } catch (error) {
    res.status(500).json({ error: "Failed to create customer" });
  }
});

router.post("/:id/purchases", async (req, res) => {
  try {
    const customer = await req.prisma.customer.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const { amount, paid, description, date } = req.body;

    if (!amount) {
      return res.status(400).json({ error: "Amount is required" });
    }

    await req.prisma.purchase.create({
      data: {
        amount: parseFloat(amount),
        paid: paid ? parseFloat(paid) : 0,
        description: description || null,
        date: date ? new Date(date) : new Date(),
        customerId: req.params.id,
      },
    });

    const updatedCustomer = await req.prisma.customer.findUnique({
      where: { id: req.params.id },
      include: { purchases: { orderBy: { date: "desc" } } },
    });

    res.status(201).json(updatedCustomer);
  } catch (error) {
    res.status(500).json({ error: "Failed to add purchase" });
  }
});

router.put("/:customerId/purchases/:purchaseId", async (req, res) => {
  try {
    const customer = await req.prisma.customer.findFirst({
      where: { id: req.params.customerId, userId: req.userId },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    await req.prisma.purchase.update({
      where: { id: req.params.purchaseId },
      data: req.body,
    });

    const updatedCustomer = await req.prisma.customer.findUnique({
      where: { id: req.params.customerId },
      include: { purchases: { orderBy: { date: "desc" } } },
    });

    res.json(updatedCustomer);
  } catch (error) {
    res.status(500).json({ error: "Failed to update purchase" });
  }
});

module.exports = router;
