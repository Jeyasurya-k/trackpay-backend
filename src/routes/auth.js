const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const authMiddleware = require("../middleware/auth");
const {
  validateSignup,
  validateLogin,
  validateChangePassword,
  validateUpdateProfile,
} = require("../middleware/validate");

const router = express.Router();

// Helper: generate JWT with short expiration
function generateToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
}

// SIGNUP
router.post("/signup", validateSignup, async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const existingUser = await req.prisma.user.findFirst({
      where: {
        OR: [{ email: email.toLowerCase() }, { username }],
      },
    });

    if (existingUser) {
      return res
        .status(400)
        .json({ error: "User with this email or username already exists" });
    }

    // Bcrypt with cost factor 12 (stronger than 10)
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await req.prisma.user.create({
      data: {
        username,
        email: email.toLowerCase(),
        password: hashedPassword,
      },
    });

    const token = generateToken(user.id);

    res.status(201).json({
      token,
      user: { id: user.id, username: user.username, email: user.email },
    });
  } catch (error) {
    console.error("Signup error:", error.message);
    res.status(500).json({ error: "Signup failed. Please try again." });
  }
});

// LOGIN
router.post("/login", validateLogin, async (req, res) => {
  try {
    const { identifier, password } = req.body;

    const user = await req.prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier.toLowerCase() },
          { username: identifier },
        ],
      },
    });

    // Always return same error to prevent user enumeration
    if (!user || !user.password) {
      return res.status(401).json({ error: "Invalid email/username or password" });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid email/username or password" });
    }

    const token = generateToken(user.id);

    res.json({
      token,
      user: { id: user.id, username: user.username, email: user.email },
    });
  } catch (error) {
    console.error("Login error:", error.message);
    res.status(500).json({ error: "Login failed. Please try again." });
  }
});

// APPLE AUTH
router.post("/apple-login", async (req, res) => {
  try {
    const { appleId, email, username } = req.body;

    if (!appleId) {
      return res.status(400).json({ error: "Apple ID is required" });
    }

    let user = await req.prisma.user.findUnique({ where: { appleId } });

    if (!user) {
      if (email) {
        user = await req.prisma.user.findUnique({
          where: { email: email.toLowerCase() },
        });
      }

      if (user) {
        user = await req.prisma.user.update({
          where: { id: user.id },
          data: { appleId },
        });
      } else {
        user = await req.prisma.user.create({
          data: {
            appleId,
            email: (email || `apple_${appleId.substring(0, 8)}@trackpay.app`).toLowerCase(),
            username: username || `user_${Date.now()}`,
          },
        });
      }
    }

    const token = generateToken(user.id);
    res.json({
      token,
      user: { id: user.id, username: user.username, email: user.email },
    });
  } catch (error) {
    console.error("Apple login error:", error.message);
    res.status(500).json({ error: "Apple login failed. Please try again." });
  }
});

// CHANGE PASSWORD
router.put(
  "/change-password",
  authMiddleware,
  validateChangePassword,
  async (req, res) => {
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
      if (!validPassword) {
        return res.status(400).json({ error: "Incorrect current password" });
      }

      const hashedNewPassword = await bcrypt.hash(newPassword, 12);
      await req.prisma.user.update({
        where: { id: req.userId },
        data: { password: hashedNewPassword },
      });

      res.json({ message: "Password updated successfully" });
    } catch (error) {
      console.error("Change password error:", error.message);
      res.status(500).json({ error: "Password change failed" });
    }
  },
);

// Get current user
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await req.prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, username: true, email: true, createdAt: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (error) {
    console.error("Get user error:", error.message);
    res.status(500).json({ error: "Failed to get user data" });
  }
});

// UPDATE PROFILE
router.put(
  "/update-profile",
  authMiddleware,
  validateUpdateProfile,
  async (req, res) => {
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
      console.error("Update profile error:", error.message);
      res.status(400).json({ error: "Username or email already taken" });
    }
  },
);

module.exports = router;
