// Example: src/controllers/authController.js
const prisma = require("../lib/prisma");
const bcrypt = require("bcryptjs");

const registerUser = async (req, res) => {
  const { username, password } = req.body;

  try {
    // 1. Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // 2. Hash password and save to Prisma DB
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
      },
    });

    res.status(201).json({ message: "User created!", userId: newUser.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
