const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.header("Authorization");

    // 1. Check if Header exists
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ error: "Access denied. No valid token provided." });
    }

    // 2. Extract Token
    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ error: "Authentication token missing" });
    }

    // 3. Verify Token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 4. Attach userId to the request object
    // Note: Ensure this matches the key you used in jwt.sign (userId)
    if (!decoded.userId) {
      return res.status(401).json({ error: "Invalid token payload" });
    }

    req.userId = decoded.userId;

    next();
  } catch (error) {
    // Distinguish between expired and generic invalid tokens
    const message =
      error.name === "TokenExpiredError"
        ? "Session expired. Please login again."
        : "Invalid authentication token.";

    res.status(401).json({ error: message });
  }
};

module.exports = authMiddleware;
