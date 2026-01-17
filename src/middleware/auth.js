const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.header("Authorization");

    if (!authHeader) {
      return res
        .status(401)
        .json({ error: "No authentication token provided" });
    }

    const token = authHeader.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ error: "Invalid token format" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

module.exports = authMiddleware;
