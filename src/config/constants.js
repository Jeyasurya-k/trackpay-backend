import Constants from "expo-constants";
import { Platform } from "react-native";

const getApiUrl = () => {
  // Production API URL
  const PRODUCTION_URL = "https://trackpay-backend.onrender.com/api";

  // Get from app.json extra config
  const configUrl = Constants.expoConfig?.extra?.apiUrl;

  // Check if running in development
  const isDevelopment = __DEV__;

  if (!isDevelopment) {
    return configUrl || PRODUCTION_URL;
  }

  // Development URLs
  if (Platform.OS === "android") {
    return "http://10.0.2.2:5000/api";
  } else if (Platform.OS === "ios") {
    return "http://localhost:5000/api";
  } else {
    return "http://localhost:5000/api";
  }
};

export const API_URL = getApiUrl();

export const APP_CONFIG = {
  appName: "TrackPay",
  version: "1.1.3",
  defaultCategories: [
    "Salary",
    "Freelance",
    "Customer Payment", // Added for Sync
    "Debt Recovery", // Added for Sync
    "Food",
    "Transport",
    "Shopping",
    "Bills",
    "Entertainment",
    "Healthcare",
    "Education",
    "Other",
  ],
};

console.log("🌐 API URL:", API_URL);
console.log("🔧 Environment:", __DEV__ ? "Development" : "Production");
