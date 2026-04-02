const prisma = require("../lib/prisma");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// 1. REGISTER USER (Updated for Email)
const registerUser = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res
        .status(400)
        .json({ error: "Username, email, and password are required" });
    }

    // Check if user exists by either username OR email
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ username: username }, { email: email.toLowerCase() }],
      },
    });

    if (existingUser) {
      const field = existingUser.username === username ? "Username" : "Email";
      return res.status(400).json({ error: `${field} is already taken` });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        username,
        email: email.toLowerCase(),
        password: hashedPassword,
      },
    });

    // Generate Token immediately so they are logged in after signup
    const token = jwt.sign({ userId: newUser.id }, process.env.JWT_SECRET, {
      expiresIn: "30d",
    });

    res.status(201).json({
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 2. LOGIN USER (Updated for Identifier)
const loginUser = async (req, res) => {
  try {
    const { identifier, password } = req.body; // 'identifier' can be email or username

    if (!identifier || !password) {
      return res
        .status(400)
        .json({ error: "Username/Email and password are required" });
    }

    // Find user by username OR email
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: identifier.toLowerCase() }, { username: identifier }],
      },
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: "30d",
    });

    res.json({
      token,
      user: { id: user.id, username: user.username, email: user.email },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { registerUser, loginUser };
