const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const authMiddleware = require("../middleware/auth"); // Assuming this is your token verifier

const router = express.Router();

//  SIGNUP - Updated with Email
router.post("/signup", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res
        .status(400)
        .json({ error: "Username, email, and password are required" });
    }

    // Check if user already exists by email OR username
    const existingUser = await req.prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      return res
        .status(400)
        .json({ error: "User with this email or username already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await req.prisma.user.create({
      data: {
        username,
        email: email.toLowerCase(),
        password: hashedPassword,
      },
    });

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: "30d",
    });

    res.status(201).json({
      token,
      user: { id: user.id, username: user.username, email: user.email },
    });
  } catch (error) {
    res.status(500).json({ error: "Signup failed." });
  }
});

// LOGIN - Supports Email or Username
router.post("/login", async (req, res) => {
  try {
    const { identifier, password } = req.body; // 'identifier' can be email or username

    const user = await req.prisma.user.findFirst({
      where: {
        OR: [{ email: identifier.toLowerCase() }, { username: identifier }],
      },
    });

    if (!user || !user.password) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: "30d",
    });

    res.json({
      token,
      user: { id: user.id, username: user.username, email: user.email },
    });
  } catch (error) {
    res.status(500).json({ error: "Login failed." });
  }
});

// APPLE AUTH - Handle Apple Sign-in
router.post("/apple-login", async (req, res) => {
  try {
    const { appleId, email, username } = req.body;

    let user = await req.prisma.user.findUnique({ where: { appleId } });

    if (!user) {
      // Check if a user with this email already exists but hasn't linked Apple
      user = await req.prisma.user.findUnique({ where: { email } });

      if (user) {
        // Link Apple ID to existing email account
        user = await req.prisma.user.update({
          where: { email },
          data: { appleId },
        });
      } else {
        // Create brand new user
        user = await req.prisma.user.create({
          data: {
            appleId,
            email: email.toLowerCase(),
            username: username || email.split("@")[0],
          },
        });
      }
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: "30d",
    });
    res.json({
      token,
      user: { id: user.id, username: user.username, email: user.email },
    });
  } catch (error) {
    res.status(500).json({ error: "Apple login failed." });
  }
});

// CHANGE PASSWORD
router.put("/change-password", authMiddleware, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    const user = await req.prisma.user.findUnique({
      where: { id: req.userId },
    });

    if (!user.password) {
      return res
        .status(400)
        .json({ error: "Social accounts must set a password first" });
    }

    const validPassword = await bcrypt.compare(oldPassword, user.password);
    if (!validPassword)
      return res.status(400).json({ error: "Incorrect old password" });

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await req.prisma.user.update({
      where: { id: req.userId },
      data: { password: hashedNewPassword },
    });

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    res.status(500).json({ error: "Update failed" });
  }
});

// Get current user
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await req.prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, username: true, createdAt: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Failed to get user data" });
  }
});

//  UPDATE PROFILE (Username/Email)
router.put("/update-profile", authMiddleware, async (req, res) => {
  try {
    const { username, email } = req.body;

    const updatedUser = await req.prisma.user.update({
      where: { id: req.userId },
      data: {
        username: username || undefined,
        email: email ? email.toLowerCase() : undefined,
      },
    });

    res.json({
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
      },
    });
  } catch (error) {
    res.status(400).json({ error: "Username or Email already taken" });
  }
});

module.exports = router;
