import { defaultCategories, defaultTransactions, defaultUser, defaultWallets } from '../config/appConfig.js';

const STORAGE_KEYS = {
  user: "finz_user",
  transactions: "finz_transactions",
  wallets: "finz_wallets",
  budgetLimit: "finz_budget_limit",
  savingsGoal: "finz_savings_goal",
  language: "finz_language",
  currency: "finz_currency",
  theme: "finz_theme",
  categoryLimits: "finz_category_limits",
  categories: "finz_categories",
  startAngleOffset: "finz_start_angle_offset"
};

const oldTestUserNames = new Set(["Minh", "Minh (Local Guest)", "Khách", "Khách (Local Guest)"]);
const legacyDemoCategoryLimits = {
  dining: 4000000,
  shopping: 3000000,
  transport: 1500000,
  entertainment: 2000000,
  other: 1500000
};

function readJson(key, fallback) {
  const value = localStorage.getItem(key);
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function migrateCategoryColors(categories) {
  const oldToNewColorMap = {
    "bg-tertiary-container text-on-tertiary-container": "bg-brand-teal-light text-brand-teal",
    "bg-secondary-container text-on-secondary-container": "bg-brand-purple-light text-brand-purple",
    "bg-primary-container/40 text-primary": "bg-brand-blue-light text-brand-blue",
    "bg-yellow-100 text-yellow-800": "bg-brand-yellow-light text-brand-yellow",
    "bg-emerald-100 text-emerald-800": "bg-brand-teal-light text-brand-teal",
    "bg-surface-container-highest text-on-surface-variant": "bg-brand-blue-light text-brand-blue"
  };

  let migrated = false;
  categories.forEach(cat => {
    if (oldToNewColorMap[cat.color]) {
      cat.color = oldToNewColorMap[cat.color];
      migrated = true;
    }
  });

  if (migrated) writeJson(STORAGE_KEYS.categories, categories);
}

function isLegacyCashWallet(wallets) {
  return wallets.length === 1 && wallets[0].id === "cash" && Number(wallets[0].balance || 0) === 0;
}

function isLegacyDemoCategoryLimits(limits) {
  return Object.entries(legacyDemoCategoryLimits).every(([key, value]) => Number(limits?.[key] || 0) === value);
}

export function resetLegacyDemoData(state) {
  const hasNoTransactions = state.transactions.length === 0;
  if (!hasNoTransactions) return;

  if (state.budgetLimit === 12000000) state.budgetLimit = 0;
  if (state.macbookGoal?.target === 45000000) {
    state.macbookGoal = { target: 0, saved: 0 };
  }
  if (isLegacyDemoCategoryLimits(state.categoryLimits)) {
    Object.keys(state.categoryLimits).forEach(key => {
      state.categoryLimits[key] = 0;
    });
  }
  if (isLegacyCashWallet(state.wallets)) {
    state.wallets = [];
  }
}

export function loadStateFromLocalStorage(state) {
  const savedUser = readJson(STORAGE_KEYS.user, null);
  if (savedUser) {
    if (oldTestUserNames.has(savedUser.name)) {
      localStorage.clear();
      state.isLoggedIn = false;
      state.user = { ...defaultUser };
      state.transactions = [];
      return;
    }
    state.user = savedUser;
    state.isLoggedIn = true;
  }

  state.transactions = readJson(STORAGE_KEYS.transactions, null) ?? [...defaultTransactions];
  writeJson(STORAGE_KEYS.transactions, state.transactions);

  state.wallets = readJson(STORAGE_KEYS.wallets, null) ?? [...defaultWallets];
  writeJson(STORAGE_KEYS.wallets, state.wallets);

  const savedBudget = localStorage.getItem(STORAGE_KEYS.budgetLimit);
  if (savedBudget) state.budgetLimit = parseInt(savedBudget, 10);

  state.macbookGoal = readJson(STORAGE_KEYS.savingsGoal, state.macbookGoal);
  state.language = localStorage.getItem(STORAGE_KEYS.language) || state.language;
  state.currency = localStorage.getItem(STORAGE_KEYS.currency) || state.currency;
  state.theme = localStorage.getItem(STORAGE_KEYS.theme) || state.theme;
  state.startAngleOffset = parseFloat(localStorage.getItem(STORAGE_KEYS.startAngleOffset) || "0");
  state.categoryLimits = readJson(STORAGE_KEYS.categoryLimits, state.categoryLimits);

  state.categories = readJson(STORAGE_KEYS.categories, null) ?? [...defaultCategories];
  writeJson(STORAGE_KEYS.categories, state.categories);
  migrateCategoryColors(state.categories);
  resetLegacyDemoData(state);
  saveSettingsToLocalStorage(state);
  saveWalletsToLocalStorage(state.wallets);
}

export function saveUserToLocalStorage(user) {
  writeJson(STORAGE_KEYS.user, user);
}

export function saveTransactionsToLocalStorage(transactions) {
  writeJson(STORAGE_KEYS.transactions, transactions);
}

export function saveWalletsToLocalStorage(wallets) {
  writeJson(STORAGE_KEYS.wallets, wallets);
}

export function saveSettingsToLocalStorage(state) {
  localStorage.setItem(STORAGE_KEYS.budgetLimit, state.budgetLimit.toString());
  writeJson(STORAGE_KEYS.savingsGoal, state.macbookGoal);
  localStorage.setItem(STORAGE_KEYS.language, state.language);
  localStorage.setItem(STORAGE_KEYS.currency, state.currency);
  localStorage.setItem(STORAGE_KEYS.theme, state.theme);
  writeJson(STORAGE_KEYS.categoryLimits, state.categoryLimits);
  writeJson(STORAGE_KEYS.categories, state.categories);
  localStorage.setItem(STORAGE_KEYS.startAngleOffset, state.startAngleOffset.toString());
}

export function clearSessionStorage() {
  Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
}
