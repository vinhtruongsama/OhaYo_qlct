import {
  DEFAULT_BUDGET_LIMIT,
  defaultCategoryLimits,
  defaultSavingsGoal,
  defaultUser,
  defaultWallets
} from '../config/appConfig.js';

export function createInitialState() {
  return {
    isLoggedIn: false,
    user: { ...defaultUser },
    transactions: [],
    wallets: [...defaultWallets],
    budgetLimit: DEFAULT_BUDGET_LIMIT,
    macbookGoal: { ...defaultSavingsGoal },
    language: "vi",
    currency: "vnd",
    theme: "light",
    categoryLimits: { ...defaultCategoryLimits },
    currentType: "expense",
    currentModalType: "expense",
    categories: [],
    isEditingBudgetWheel: false,
    startAngleOffset: 0
  };
}
