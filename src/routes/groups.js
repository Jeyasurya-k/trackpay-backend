const express = require("express");
const authMiddleware = require("../middleware/auth");
const {
  validateCreateGroup,
  validateAddGroupMember,
  validateCreateGroupExpense,
  validateSettleExpenseSplit,
} = require("../middleware/validate");

const router = express.Router();

// Logging middleware to check if requests reach this router
router.use((req, res, next) => {
  console.log(`[Groups Router] ${req.method} ${req.originalUrl}`);
  next();
});

// DEBUG: Test route without auth
router.get("/debug", (req, res) => {
  res.json({ message: "Groups router is loaded" });
});

// Apply auth middleware to all routes
router.use(authMiddleware);

// ===== GROUP MANAGEMENT =====

// GET - List user's groups
router.get("/", async (req, res) => {
  try {
    const groups = await req.prisma.group.findMany({
      where: { userId: req.userId },
      include: {
        members: true,
        expenses: {
          include: { splits: true },
        },
      },
    });

    // Calculate summaries for each group
    const groupsWithSummary = groups.map((group) => {
      const totalExpense = group.expenses.reduce(
        (sum, exp) => sum + exp.amount,
        0
      );
      const totalPending = group.expenses.reduce((sum, exp) => {
        const pending = exp.splits.reduce((expSum, split) => {
          return expSum + (split.status === "pending" ? split.amount : 0);
        }, 0);
        return sum + pending;
      }, 0);

      return {
        id: group.id,
        name: group.name,
        description: group.description,
        memberCount: group.members.length,
        totalExpense,
        totalPending,
        members: group.members,
        createdAt: group.createdAt,
      };
    });

    res.json({ groups: groupsWithSummary });
  } catch (error) {
    console.error("Get groups error:", error.message);
    res.status(500).json({ error: "Failed to retrieve groups" });
  }
});

// GET - Get single group with all details
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const group = await req.prisma.group.findUnique({
      where: { id },
      include: {
        members: true,
        expenses: {
          include: {
            splits: {
              include: { member: true },
            },
            paidByMember: true,
          },
          orderBy: { date: "desc" },
        },
      },
    });

    if (!group || group.userId !== req.userId) {
      return res.status(404).json({ error: "Group not found" });
    }

    res.json({ group });
  } catch (error) {
    console.error("Get group error:", error.message);
    res.status(500).json({ error: "Failed to retrieve group" });
  }
});

// POST - Create new group
router.post("/", validateCreateGroup, async (req, res) => {
  try {
    const { name, description } = req.body;

    const group = await req.prisma.group.create({
      data: {
        name,
        description,
        userId: req.userId,
      },
    });

    res.status(201).json({ group });
  } catch (error) {
    console.error("Create group error:", error.message);
    res.status(500).json({ error: "Failed to create group" });
  }
});

// PUT - Update group
router.put("/:id", validateCreateGroup, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const group = await req.prisma.group.findUnique({
      where: { id },
    });

    if (!group || group.userId !== req.userId) {
      return res.status(404).json({ error: "Group not found" });
    }

    const updated = await req.prisma.group.update({
      where: { id },
      data: { name, description },
    });

    res.json({ group: updated });
  } catch (error) {
    console.error("Update group error:", error.message);
    res.status(500).json({ error: "Failed to update group" });
  }
});

// DELETE - Delete group
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const group = await req.prisma.group.findUnique({
      where: { id },
    });

    if (!group || group.userId !== req.userId) {
      return res.status(404).json({ error: "Group not found" });
    }

    await req.prisma.group.delete({
      where: { id },
    });

    res.json({ message: "Group deleted successfully" });
  } catch (error) {
    console.error("Delete group error:", error.message);
    res.status(500).json({ error: "Failed to delete group" });
  }
});

// ===== GROUP MEMBERS =====

// GET - List group members
router.get("/:groupId/members", async (req, res) => {
  try {
    const { groupId } = req.params;

    const group = await req.prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group || group.userId !== req.userId) {
      return res.status(404).json({ error: "Group not found" });
    }

    const members = await req.prisma.groupMember.findMany({
      where: { groupId },
    });

    res.json({ members });
  } catch (error) {
    console.error("Get members error:", error.message);
    res.status(500).json({ error: "Failed to retrieve members" });
  }
});

// POST - Add member to group (by email, username, or name)
router.post("/:groupId/members", validateAddGroupMember, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { nameOrEmail } = req.body;

    // Verify group exists and belongs to user
    const group = await req.prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group || group.userId !== req.userId) {
      return res.status(404).json({ error: "Group not found" });
    }

    // Try to find user by email or username
    let user = null;
    let name = nameOrEmail;
    let email = null;

    if (nameOrEmail.includes("@")) {
      // Looks like email
      user = await req.prisma.user.findUnique({
        where: { email: nameOrEmail.toLowerCase() },
      });
      if (user) {
        name = user.username;
        email = user.email;
      }
    } else {
      // Try username lookup
      user = await req.prisma.user.findFirst({
        where: { username: nameOrEmail },
      });
      if (user) {
        name = user.username;
        email = user.email;
      }
    }

    // Create group member
    const member = await req.prisma.groupMember.create({
      data: {
        groupId,
        name,
        email: email || null,
        userId: user?.id || null,
      },
    });

    res.status(201).json({ member });
  } catch (error) {
    console.error("Add member error:", error.message);
    res.status(500).json({ error: "Failed to add member" });
  }
});

// DELETE - Remove member from group
router.delete("/:groupId/members/:memberId", async (req, res) => {
  try {
    const { groupId, memberId } = req.params;

    const group = await req.prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group || group.userId !== req.userId) {
      return res.status(404).json({ error: "Group not found" });
    }

    const member = await req.prisma.groupMember.findUnique({
      where: { id: memberId },
    });

    if (!member || member.groupId !== groupId) {
      return res.status(404).json({ error: "Member not found" });
    }

    // Check if member has pending splits
    const pendingSplits = await req.prisma.groupExpenseSplit.findMany({
      where: { memberId, status: "pending" },
    });

    if (pendingSplits.length > 0) {
      return res.status(400).json({
        error: "Cannot remove member with pending debts. Settle debts first.",
      });
    }

    await req.prisma.groupMember.delete({
      where: { id: memberId },
    });

    res.json({ message: "Member removed successfully" });
  } catch (error) {
    console.error("Remove member error:", error.message);
    res.status(500).json({ error: "Failed to remove member" });
  }
});

// ===== GROUP EXPENSES =====

// POST - Create group expense with splits
router.post("/:groupId/expenses", validateCreateGroupExpense, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { amount, description, category, paidByMemberId, splitType, splits, date } =
      req.body;

    // Verify group exists
    const group = await req.prisma.group.findUnique({
      where: { id: groupId },
      include: { members: true },
    });

    if (!group || group.userId !== req.userId) {
      return res.status(404).json({ error: "Group not found" });
    }

    // Verify paidByMember exists in group
    const paidByMember = group.members.find((m) => m.id === paidByMemberId);
    if (!paidByMember) {
      return res.status(400).json({ error: "Invalid member" });
    }

    // Calculate splits
    let expenseSplits = [];
    if (splitType === "equal") {
      const splitAmount = amount / group.members.length;
      expenseSplits = group.members.map((member) => ({
        memberId: member.id,
        amount: splitAmount,
        status: "pending",
      }));
    } else if (splitType === "custom") {
      // Validate custom splits
      if (!splits || splits.length === 0) {
        return res.status(400).json({ error: "Custom splits required" });
      }

      const totalSplits = splits.reduce((sum, split) => sum + split.amount, 0);
      if (Math.abs(totalSplits - amount) > 0.01) {
        return res.status(400).json({
          error: `Splits total must equal amount (₹${amount}). Current total: ₹${totalSplits}`,
        });
      }

      expenseSplits = splits.map((split) => ({
        memberId: split.memberId,
        amount: split.amount,
        status: "pending",
      }));
    }

    // Create expense and splits atomically
    const expense = await req.prisma.$transaction(async (tx) => {
      const newExpense = await tx.groupExpense.create({
        data: {
          groupId,
          amount,
          description,
          category,
          paidByMemberId,
          splitType,
          date: date ? new Date(date) : new Date(),
          splits: {
            create: expenseSplits,
          },
        },
        include: {
          splits: { include: { member: true } },
          paidByMember: true,
        },
      });

      // Auto-create Transaction for the payer
      await tx.transaction.create({
        data: {
          userId: req.userId,
          type: "income",
          amount,
          category: "Group Payment",
          description: `Split in group "${group.name}"`,
          date: new Date(),
        },
      });

      return newExpense;
    });

    res.status(201).json({ expense });
  } catch (error) {
    console.error("Create expense error:", error.message);
    res.status(500).json({ error: "Failed to create expense" });
  }
});

// GET - List expenses for a group
router.get("/:groupId/expenses", async (req, res) => {
  try {
    const { groupId } = req.params;
    const { startDate, endDate } = req.query;

    const group = await req.prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group || group.userId !== req.userId) {
      return res.status(404).json({ error: "Group not found" });
    }

    const where = { groupId };
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const expenses = await req.prisma.groupExpense.findMany({
      where,
      include: {
        splits: { include: { member: true } },
        paidByMember: true,
      },
      orderBy: { date: "desc" },
    });

    res.json({ expenses });
  } catch (error) {
    console.error("Get expenses error:", error.message);
    res.status(500).json({ error: "Failed to retrieve expenses" });
  }
});

// PUT - Settle an expense split
router.put(
  "/:groupId/expenses/:expenseId/settle",
  validateSettleExpenseSplit,
  async (req, res) => {
    try {
      const { groupId, expenseId } = req.params;
      const { memberId } = req.body;

      // Verify group exists
      const group = await req.prisma.group.findUnique({
        where: { id: groupId },
      });

      if (!group || group.userId !== req.userId) {
        return res.status(404).json({ error: "Group not found" });
      }

      // Find the split to settle
      const split = await req.prisma.groupExpenseSplit.findFirst({
        where: { expenseId, memberId },
        include: { expense: true },
      });

      if (!split) {
        return res.status(404).json({ error: "Split not found" });
      }

      // Update split status
      const settledSplit = await req.prisma.groupExpenseSplit.update({
        where: { id: split.id },
        data: {
          status: "settled",
          settledDate: new Date(),
        },
      });

      // Create transaction for settlement
      await req.prisma.transaction.create({
        data: {
          userId: req.userId,
          type: "expense",
          amount: split.amount,
          category: "Group Settlement",
          description: `Settled group payment in "${group.name}"`,
          date: new Date(),
        },
      });

      res.json({ split: settledSplit });
    } catch (error) {
      console.error("Settle split error:", error.message);
      res.status(500).json({ error: "Failed to settle payment" });
    }
  }
);

// GET - Settlement summary for a group
router.get("/:groupId/settlement", async (req, res) => {
  try {
    const { groupId } = req.params;

    const group = await req.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: true,
        expenses: {
          include: { splits: true },
        },
      },
    });

    if (!group || group.userId !== req.userId) {
      return res.status(404).json({ error: "Group not found" });
    }

    // Calculate who owes whom
    const settlement = {};

    group.expenses.forEach((expense) => {
      const paidByMemberId = expense.paidByMemberId;

      expense.splits.forEach((split) => {
        if (split.memberId !== paidByMemberId && split.status === "pending") {
          const key = `${split.memberId}_${paidByMemberId}`;
          settlement[key] = (settlement[key] || 0) + split.amount;
        }
      });
    });

    // Format settlement data
    const debts = Object.entries(settlement).map(([key, amount]) => {
      const [debtor, creditor] = key.split("_");
      const debtorMember = group.members.find((m) => m.id === debtor);
      const creditorMember = group.members.find((m) => m.id === creditor);

      return {
        from: debtorMember,
        to: creditorMember,
        amount,
      };
    });

    res.json({ debts });
  } catch (error) {
    console.error("Get settlement error:", error.message);
    res.status(500).json({ error: "Failed to retrieve settlement" });
  }
});

module.exports = router;
