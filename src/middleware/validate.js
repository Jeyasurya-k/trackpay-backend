const { body, param, query, validationResult } = require("express-validator");

// Middleware to check validation results
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: errors.array()[0].msg,
    });
  }
  next();
};

// ===== AUTH VALIDATORS =====

const validateSignup = [
  body("username")
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage("Username must be 3-30 characters")
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage("Username can only contain letters, numbers, and underscores"),
  body("email")
    .trim()
    .isEmail()
    .withMessage("Please provide a valid email address")
    .normalizeEmail(),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters")
    .matches(/[A-Z]/)
    .withMessage("Password must contain at least one uppercase letter")
    .matches(/[0-9]/)
    .withMessage("Password must contain at least one number"),
  handleValidation,
];

const validateLogin = [
  body("identifier")
    .trim()
    .notEmpty()
    .withMessage("Email or username is required")
    .isLength({ max: 100 })
    .withMessage("Identifier too long"),
  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ max: 128 })
    .withMessage("Password too long"),
  handleValidation,
];

const validateChangePassword = [
  body("oldPassword").notEmpty().withMessage("Current password is required"),
  body("newPassword")
    .isLength({ min: 8 })
    .withMessage("New password must be at least 8 characters")
    .matches(/[A-Z]/)
    .withMessage("New password must contain at least one uppercase letter")
    .matches(/[0-9]/)
    .withMessage("New password must contain at least one number"),
  handleValidation,
];

const validateUpdateProfile = [
  body("username")
    .optional()
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage("Username must be 3-30 characters")
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage("Username can only contain letters, numbers, and underscores"),
  body("email")
    .optional()
    .trim()
    .isEmail()
    .withMessage("Please provide a valid email address")
    .normalizeEmail(),
  handleValidation,
];

// ===== TRANSACTION VALIDATORS =====

const validateCreateTransaction = [
  body("type")
    .trim()
    .isIn(["income", "expense"])
    .withMessage("Type must be 'income' or 'expense'"),
  body("amount")
    .isFloat({ min: 0.01, max: 99999999 })
    .withMessage("Amount must be between 0.01 and 99,999,999"),
  body("category")
    .trim()
    .notEmpty()
    .withMessage("Category is required")
    .isLength({ max: 50 })
    .withMessage("Category must be under 50 characters"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Description must be under 200 characters"),
  body("date").optional().isISO8601().withMessage("Invalid date format"),
  handleValidation,
];

const validateDateQuery = [
  query("startDate")
    .optional()
    .isISO8601()
    .withMessage("Invalid start date format"),
  query("endDate")
    .optional()
    .isISO8601()
    .withMessage("Invalid end date format"),
  handleValidation,
];

// ===== CUSTOMER VALIDATORS =====

const validateCreateCustomer = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Customer name is required")
    .isLength({ max: 100 })
    .withMessage("Name must be under 100 characters"),
  body("phone")
    .trim()
    .notEmpty()
    .withMessage("Phone number is required")
    .isLength({ min: 7, max: 15 })
    .withMessage("Phone must be 7-15 digits"),
  body("location")
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Location must be under 200 characters"),
  handleValidation,
];

const validateAddPurchase = [
  body("amount")
    .isFloat({ min: 0.01, max: 99999999 })
    .withMessage("Amount must be between 0.01 and 99,999,999"),
  body("paid")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Paid amount cannot be negative"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Description must be under 200 characters"),
  body("date").optional().isISO8601().withMessage("Invalid date format"),
  handleValidation,
];

const validateUpdatePayment = [
  body("paid")
    .isFloat({ min: 0 })
    .withMessage("Paid amount must be a positive number"),
  handleValidation,
];

const validateUUID = [
  param("id").isUUID().withMessage("Invalid ID format"),
  handleValidation,
];

// ===== GROUP VALIDATORS =====

const validateCreateGroup = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Group name is required")
    .isLength({ min: 1, max: 100 })
    .withMessage("Group name must be 1-100 characters"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description must be under 500 characters"),
  handleValidation,
];

const validateAddGroupMember = [
  body("nameOrEmail")
    .trim()
    .notEmpty()
    .withMessage("Name, email, or username is required")
    .isLength({ min: 1, max: 100 })
    .withMessage("Input must be 1-100 characters"),
  handleValidation,
];

const validateCreateGroupExpense = [
  body("amount")
    .isFloat({ min: 0.01, max: 99999999 })
    .withMessage("Amount must be between 0.01 and 99,999,999"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Description must be under 200 characters"),
  body("category")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Category must be under 50 characters"),
  body("paidByMemberId")
    .isUUID()
    .withMessage("Invalid member ID"),
  body("splitType")
    .isIn(["equal", "custom"])
    .withMessage("Split type must be 'equal' or 'custom'"),
  body("splits")
    .optional()
    .isArray()
    .withMessage("Splits must be an array"),
  body("splits.*.memberId")
    .optional()
    .isUUID()
    .withMessage("Invalid member ID in splits"),
  body("splits.*.amount")
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage("Split amount must be positive"),
  body("date")
    .optional()
    .isISO8601()
    .withMessage("Invalid date format"),
  handleValidation,
];

const validateSettleExpenseSplit = [
  body("memberId")
    .isUUID()
    .withMessage("Invalid member ID"),
  handleValidation,
];

module.exports = {
  validateSignup,
  validateLogin,
  validateChangePassword,
  validateUpdateProfile,
  validateCreateTransaction,
  validateDateQuery,
  validateCreateCustomer,
  validateAddPurchase,
  validateUpdatePayment,
  validateUUID,
  validateCreateGroup,
  validateAddGroupMember,
  validateCreateGroupExpense,
  validateSettleExpenseSplit,
};
