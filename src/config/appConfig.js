export const brandColors = {
  teal: {
    saturated: "#22e2c5",
    pastel: "#d4ffea"
  },
  purple: {
    saturated: "#716fa3",
    pastel: "#eecbff"
  },
  blue: {
    saturated: "#a2b1cc",
    pastel: "#dbdcff"
  },
  yellow: {
    saturated: "#fde6bb",
    pastel: "#feffa3"
  },
  coral: {
    saturated: "#fd846f",
    pastel: "#ffd4e5"
  }
};

export const cuteIcons = [
  "restaurant", "shopping_bag", "directions_car", "sports_esports", "work", "pending",
  "local_cafe", "home", "bolt", "medical_services", "school", "flight", "pets",
  "fitness_center", "spa", "redeem", "movie", "wifi", "handyman", "family_restroom"
];

export const pastelColors = [
  { value: "bg-brand-teal-light text-brand-teal", name: "Teal" },
  { value: "bg-brand-purple-light text-brand-purple", name: "Purple" },
  { value: "bg-brand-blue-light text-brand-blue", name: "Blue" },
  { value: "bg-brand-yellow-light text-brand-yellow", name: "Yellow" },
  { value: "bg-brand-coral-light text-brand-coral", name: "Coral" }
];

export const defaultUser = {
  name: "Văn Thương",
  email: "vanthuong@example.com"
};

export const defaultWallets = [];

export const DEFAULT_BUDGET_LIMIT = 0;

export const defaultSavingsGoal = {
  target: 0,
  saved: 0
};

export const defaultCategoryLimits = {
  dining: 0,
  shopping: 0,
  transport: 0,
  entertainment: 0,
  other: 0
};

export const defaultCategories = [
  { id: "dining", nameVi: "Ăn uống", nameEn: "Dining", icon: "restaurant", color: "bg-brand-teal-light text-brand-teal" },
  { id: "shopping", nameVi: "Mua sắm", nameEn: "Shopping", icon: "shopping_bag", color: "bg-brand-purple-light text-brand-purple" },
  { id: "transport", nameVi: "Di chuyển", nameEn: "Transport", icon: "directions_car", color: "bg-brand-blue-light text-brand-blue" },
  { id: "entertainment", nameVi: "Giải trí", nameEn: "Entertainment", icon: "sports_esports", color: "bg-brand-yellow-light text-brand-yellow" },
  { id: "salary", nameVi: "Lương", nameEn: "Salary", icon: "work", color: "bg-brand-teal-light text-brand-teal" },
  { id: "other", nameVi: "Khác", nameEn: "Other", icon: "pending", color: "bg-brand-blue-light text-brand-blue" }
];

export const USD_RATE = 25000;

export const JPY_RATE = 160;

export const defaultTransactions = [];
