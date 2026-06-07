import { i18n } from './i18n/translations.js';
import {
  brandColors,
  cuteIcons,
  pastelColors,
  defaultUser,
  USD_RATE,
  JPY_RATE
} from './config/appConfig.js';
import { formatCompactCurrencyAmount, formatCurrencyAmount, parseCurrencyInput, toBaseCurrency } from './utils/currency.js';
import { getTodayDateString } from './utils/date.js';
import { createInitialState } from './state/appState.js';
import { createLocalTransaction } from './features/transactions/transactionService.js';
import { createWallet } from './features/wallets/walletService.js';
import {
  clearSessionStorage,
  loadStateFromLocalStorage,
  resetLegacyDemoData,
  saveSettingsToLocalStorage,
  saveTransactionsToLocalStorage,
  saveUserToLocalStorage,
  saveWalletsToLocalStorage
} from './storage/appStorage.js';
import { onAuthStateChange, signInWithPassword, signOut, signUpWithPassword } from './services/authService.js';
import {
  createTransaction,
  deleteTransactionById,
  fetchProfile,
  fetchSettings,
  fetchTransactions,
  moveCategoryTransactions,
  saveSettings,
  updateProfile
} from './services/userDataService.js';

// --- State Variables ---
let state = createInitialState();

// Budget Wheel drag state variables
let isDraggingBudgetWheel = false;
let draggedBudgetWheelHandleIndex = -1;

// Chart Instance
let expenseChartInstance = null;

function formatCurrency(amount) {
  return formatCurrencyAmount(amount, state.currency);
}

function formatCompactCurrency(amount) {
  return formatCompactCurrencyAmount(amount, state.currency);
}

function resetNewAccountData() {
  const freshState = createInitialState();
  state.transactions = [];
  state.wallets = [];
  state.budgetLimit = freshState.budgetLimit;
  state.macbookGoal = { ...freshState.macbookGoal };
  state.categoryLimits = { ...freshState.categoryLimits };
  state.startAngleOffset = 0;
}

// --- App Initializer ---
document.addEventListener("DOMContentLoaded", () => {
  // 1. Set default dates in inputs
  const quickDate = document.getElementById('quick-date');
  if (quickDate) quickDate.value = getTodayDateString();
  const modalDate = document.getElementById('modal-date');
  if (modalDate) modalDate.value = getTodayDateString();

  // 2. Load settings/session from localStorage (offline/cache first)
  loadStateFromStorage();

  // 3. Setup category selections in forms
  populateCategorySelects();

  // 4. Update the View
  renderApp();

  // 5. Initialize listeners
  setupListeners();

  // 6. Set up Supabase Auth state change listener
  onAuthStateChange(async (event, session) => {
    if (session) {
      state.isLoggedIn = true;
      state.user = {
        id: session.user.id,
        name: session.user.user_metadata.name || "User",
        email: session.user.email
      };
      await fetchUserData(session.user.id);
    } else {
      state.isLoggedIn = false;
      state.user = { ...defaultUser };
      loadStateFromStorage();
    }
    renderApp();
  });
});

function loadStateFromStorage() {
  loadStateFromLocalStorage(state);
}

function saveTransactionsToStorage() {
  saveTransactionsToLocalStorage(state.transactions);
}

function saveWalletsToStorage() {
  saveWalletsToLocalStorage(state.wallets);
}

function saveSettingsToStorage() {
  saveSettingsToLocalStorage(state);
  saveSettingsToSupabase();
}

async function fetchUserData(userId) {
  try {
    const profile = await fetchProfile(userId);
    if (profile) {
      state.user.name = profile.name;
    }

    const settings = await fetchSettings(userId);
    if (settings) {
      state.budgetLimit = Number(settings.budget_limit) || 0;
      state.categoryLimits = typeof settings.category_limits === 'string' 
        ? JSON.parse(settings.category_limits) 
        : settings.category_limits;
      state.macbookGoal = {
        target: Number(settings.savings_target) || 0,
        saved: Number(settings.savings_saved) || 0
      };
      state.currency = settings.currency;
      state.theme = settings.theme;
      state.language = settings.language;
      
      // Load categories list from database if synced
      if (settings.categories) {
        state.categories = typeof settings.categories === 'string' 
          ? JSON.parse(settings.categories) 
          : settings.categories;
      }
    } else {
      resetNewAccountData();
    }

    state.transactions = await fetchTransactions(userId);
    resetLegacyDemoData(state);
    // Sync to local storage as cache
    saveTransactionsToStorage();
    saveWalletsToStorage();
    saveSettingsToLocalStorage(state);
    await saveSettingsToSupabase();
  } catch (err) {
    console.error("Error fetching user data from Supabase:", err);
  }
}


async function saveSettingsToSupabase() {
  if (!state.isLoggedIn || !state.user.id) return;
  try {
    await saveSettings(state.user.id, state);
  } catch (err) {
    console.error("Error saving settings to Supabase:", err);
  }
}

// --- Dynamic Category Modal Handlers ---
window.openCategoryModal = function (catId = null) {
  const modal = document.getElementById("category-modal");
  const idInput = document.getElementById("category-modal-id");
  const nameViInput = document.getElementById("category-modal-name-vi");
  const nameEnInput = document.getElementById("category-modal-name-en");
  const limitInput = document.getElementById("category-modal-limit");
  const deleteBtn = document.getElementById("category-modal-delete-btn");
  const titleEl = document.getElementById("category-modal-title");

  renderIconPicker();
  renderColorPicker();

  if (catId) {
    const cat = state.categories.find(c => c.id === catId);
    if (!cat) return;

    titleEl.innerText = state.language === 'vi' ? "Chỉnh sửa danh mục" : "Edit Category";
    idInput.value = cat.id;
    nameViInput.value = cat.nameVi;
    nameEnInput.value = cat.nameEn;
    
    // Display limit value converted based on current currency
    const rawLimit = state.categoryLimits[catId] || 0;
    let limitVal = rawLimit;
    if (state.currency === 'usd') limitVal = rawLimit / USD_RATE;
    else if (state.currency === 'jpy') limitVal = rawLimit / JPY_RATE;
    limitInput.value = Math.round(limitVal);

    selectIconInPicker(cat.icon);
    selectColorInPicker(cat.color);

    if (catId === 'salary' || catId === 'other') {
      deleteBtn.classList.add("hidden");
    } else {
      deleteBtn.classList.remove("hidden");
    }
  } else {
    titleEl.innerText = state.language === 'vi' ? "Thêm danh mục mới" : "Add New Category";
    idInput.value = "";
    nameViInput.value = "";
    nameEnInput.value = "";
    
    // default limit base on current currency
    let defaultLimit = 1000000;
    if (state.currency === 'usd') defaultLimit = 50;
    else if (state.currency === 'jpy') defaultLimit = 6000;
    limitInput.value = defaultLimit;

    selectIconInPicker(cuteIcons[0]);
    selectColorInPicker(pastelColors[0].value);
    deleteBtn.classList.add("hidden");
  }

  modal.classList.remove("hidden");
  modal.classList.add("flex");
  setTimeout(() => {
    modal.querySelector("div").classList.remove("scale-95");
    modal.querySelector("div").classList.add("scale-100");
  }, 50);
};

window.closeCategoryModal = function () {
  const modal = document.getElementById("category-modal");
  if (!modal) return;
  modal.querySelector("div").classList.remove("scale-100");
  modal.querySelector("div").classList.add("scale-95");
  setTimeout(() => {
    modal.classList.remove("flex");
    modal.classList.add("hidden");
  }, 150);
};

function renderIconPicker() {
  const container = document.getElementById("category-icon-picker");
  if (!container) return;
  container.innerHTML = "";

  cuteIcons.forEach(icon => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "icon-picker-btn p-2 rounded-xl text-on-surface hover:bg-surface-container flex items-center justify-center border border-transparent transition-all cursor-pointer dark:text-white dark:hover:bg-zinc-800";
    item.setAttribute("data-icon", icon);
    item.innerHTML = `<span class="material-symbols-outlined">${icon}</span>`;
    item.onclick = () => selectIconInPicker(icon);
    container.appendChild(item);
  });
}

function selectIconInPicker(icon) {
  document.getElementById("category-modal-icon").value = icon;
  document.querySelectorAll(".icon-picker-btn").forEach(btn => {
    if (btn.getAttribute("data-icon") === icon) {
      btn.className = "icon-picker-btn p-2 rounded-xl bg-primary text-on-primary flex items-center justify-center border-2 border-primary-container shadow-sm transition-all scale-105";
    } else {
      btn.className = "icon-picker-btn p-2 rounded-xl text-on-surface hover:bg-surface-container flex items-center justify-center border border-transparent transition-all cursor-pointer dark:text-white dark:hover:bg-zinc-800";
    }
  });
}

function renderColorPicker() {
  const container = document.getElementById("category-color-picker");
  if (!container) return;
  container.innerHTML = "";

  pastelColors.forEach(c => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `color-picker-btn w-8 h-8 rounded-full ${c.value.split(' ')[0]} border border-outline-variant/30 flex items-center justify-center transition-all cursor-pointer`;
    item.setAttribute("data-color", c.value);
    item.onclick = () => selectColorInPicker(c.value);
    container.appendChild(item);
  });
}

function selectColorInPicker(color) {
  document.getElementById("category-modal-color").value = color;
  document.querySelectorAll(".color-picker-btn").forEach(btn => {
    if (btn.getAttribute("data-color") === color) {
      btn.innerHTML = `<span class="material-symbols-outlined text-[16px] font-bold">check</span>`;
      btn.className = `color-picker-btn w-8 h-8 rounded-full ${color.split(' ')[0]} border-2 border-primary scale-110 flex items-center justify-center transition-all text-on-primary`;
    } else {
      btn.innerHTML = "";
      btn.className = `color-picker-btn w-8 h-8 rounded-full ${color.split(' ')[0]} border border-outline-variant/30 flex items-center justify-center transition-all cursor-pointer`;
    }
  });
}

window.saveCategory = function (e) {
  e.preventDefault();
  const idInput = document.getElementById("category-modal-id").value;
  const nameVi = document.getElementById("category-modal-name-vi").value.trim();
  const nameEn = document.getElementById("category-modal-name-en").value.trim();
  const rawLimit = parseFloat(document.getElementById("category-modal-limit").value) || 0;
  const icon = document.getElementById("category-modal-icon").value;
  const color = document.getElementById("category-modal-color").value;

  if (!nameVi || !nameEn) {
    alert(state.language === 'vi' ? "Vui lòng nhập tên danh mục!" : "Please enter category name!");
    return;
  }

  // Convert limit to default currency base (VND)
  let limit = rawLimit;
  if (state.currency === 'usd') limit = rawLimit * USD_RATE;
  else if (state.currency === 'jpy') limit = rawLimit * JPY_RATE;

  let catId = idInput;
  if (!catId) {
    catId = nameEn.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now();
    const newCat = {
      id: catId,
      nameVi,
      nameEn,
      icon,
      color
    };
    state.categories.push(newCat);
  } else {
    const cat = state.categories.find(c => c.id === catId);
    if (cat) {
      cat.nameVi = nameVi;
      cat.nameEn = nameEn;
      cat.icon = icon;
      cat.color = color;
    }
  }

  state.categoryLimits[catId] = limit;

  saveSettingsToStorage();
  populateCategorySelects();
  closeCategoryModal();
  showToast(state.language === 'vi' ? "Lưu danh mục thành công!" : "Category saved successfully!");
  renderApp();
};

window.deleteCategory = async function () {
  const catId = document.getElementById("category-modal-id").value;
  if (!catId) return;

  if (catId === 'salary' || catId === 'other') {
    alert(state.language === 'vi' ? "Không thể xóa danh mục mặc định này!" : "Cannot delete this default category!");
    return;
  }

  if (confirm(state.language === 'vi' ? "Bạn có chắc chắn muốn xóa danh mục này? Tất cả giao dịch thuộc danh mục này sẽ chuyển sang danh mục 'Khác'." : "Are you sure you want to delete this category? All transactions in this category will be changed to 'Other'.")) {
    state.categories = state.categories.filter(c => c.id !== catId);
    delete state.categoryLimits[catId];

    let updatedTxsCount = 0;
    state.transactions.forEach(t => {
      if (t.category === catId) {
        t.category = 'other';
        updatedTxsCount++;
      }
    });

    if (updatedTxsCount > 0 && state.isLoggedIn && state.user.id) {
      try {
        await moveCategoryTransactions(state.user.id, catId, 'other');
      } catch (err) {
        console.error("Error updating transaction category in Supabase:", err);
      }
    }

    if (updatedTxsCount > 0) {
      saveTransactionsToStorage();
    }

    saveSettingsToStorage();
    populateCategorySelects();
    closeCategoryModal();
    showToast(state.language === 'vi' ? "Đã xóa danh mục!" : "Category deleted!");
    renderApp();
  }
};

// --- Dynamic UI Renderers ---
function renderApp() {
  // Toggle Views (Auth vs Dashboard)
  if (state.isLoggedIn) {
    document.getElementById("auth-page").classList.add("hidden");
    document.getElementById("app-page").classList.remove("hidden");
  } else {
    document.getElementById("app-page").classList.add("hidden");
    document.getElementById("auth-page").classList.remove("hidden");
    return; // Stop rendering dashboard panels if not logged in
  }

  // Apply language translation
  applyTranslations();

  // Apply Theme Mode
  applyTheme();

  // Header info
  document.getElementById("header-user-name").innerText = state.user.name;
  document.getElementById("profile-name").innerText = state.user.name;
  document.getElementById("profile-email").innerText = state.user.email;

  // Set monthly banner labels dynamically
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const monthLabel = state.language === 'vi' ? `Tháng ${currentMonth}, ${currentYear}` : `Month ${currentMonth}, ${currentYear}`;
  const monthLabelEl = document.getElementById("current-month-year-label");
  if (monthLabelEl) monthLabelEl.innerText = monthLabel;

  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const startDateStr = `01/${currentMonth < 10 ? '0' + currentMonth : currentMonth}/${currentYear}`;
  const endDateStr = `${daysInMonth}/${currentMonth < 10 ? '0' + currentMonth : currentMonth}/${currentYear}`;
  const datesLabelEl = document.getElementById("monthly-tracker-dates");
  if (datesLabelEl) datesLabelEl.innerText = `${startDateStr} - ${endDateStr}`;

  // Currency symbols update
  let sym = 'đ';
  if (state.currency === 'usd') sym = '$';
  else if (state.currency === 'jpy') sym = '¥';
  const quickSym = document.getElementById("quick-currency-symbol");
  if (quickSym) quickSym.innerText = sym;
  document.querySelectorAll(".modal-currency-symbol").forEach(el => el.innerText = sym);

  // Compute statistics
  let totalIncome = 0;
  let totalExpense = 0;

  state.transactions.forEach(t => {
    if (t.type === 'income') {
      totalIncome += t.amount;
    } else {
      totalExpense += t.amount;
    }
  });

  // Starting simulation balance (e.g. 0 baseline + net income)
  const baseBalance = 0;
  const netTotal = baseBalance + totalIncome - totalExpense;

  // Render Dashboard Card values
  document.getElementById("stat-balance").innerText = formatCurrency(netTotal);
  document.getElementById("stat-income").innerText = formatCurrency(totalIncome);
  document.getElementById("stat-expense").innerText = formatCurrency(totalExpense);

  const hasBudgetLimit = state.budgetLimit > 0;
  const remainingBudget = hasBudgetLimit ? state.budgetLimit - totalExpense : 0;
  document.getElementById("stat-remaining-budget").innerText = formatCurrency(remainingBudget);

  // Budget limit card progress bar
  const budgetPercent = hasBudgetLimit ? Math.min(100, Math.max(0, (totalExpense / state.budgetLimit) * 100)) : 0;
  document.getElementById("stat-budget-progress").style.width = `${hasBudgetLimit ? 100 - budgetPercent : 0}%`;

  // Top expense category summary
  updateTopExpenseText();

  // Goal stats rendering
  const hasSavingsGoal = state.macbookGoal.target > 0;
  const goalPercent = hasSavingsGoal ? Math.min(100, Math.max(0, (state.macbookGoal.saved / state.macbookGoal.target) * 100)) : 0;
  document.getElementById("goal-target-val").innerText = formatCurrency(state.macbookGoal.target);
  document.getElementById("goal-saved-val").innerText = formatCurrency(state.macbookGoal.saved);
  document.getElementById("goal-progress-percent").innerText = `${Math.round(goalPercent)}%`;
  document.getElementById("goal-progress-bar").style.width = `${goalPercent}%`;

  // Detail values inside Budget tab
  document.getElementById("goal-target-detail").innerText = formatCurrency(state.macbookGoal.target);
  document.getElementById("goal-saved-detail").innerText = formatCurrency(state.macbookGoal.saved);
  document.getElementById("goal-remaining-detail").innerText = formatCurrency(Math.max(0, state.macbookGoal.target - state.macbookGoal.saved));

  // Detailed Budget limit displays
  document.getElementById("budget-limit-spent").innerText = formatCurrency(totalExpense);
  document.getElementById("budget-limit-total").innerText = formatCurrency(state.budgetLimit);
  document.getElementById("budget-limit-progress-bar").style.width = `${budgetPercent}%`;

  // Set Warning alerts if over budget
  const warnTextEl = document.getElementById("budget-limit-warning");
  if (!hasBudgetLimit) {
    warnTextEl.innerText = state.language === 'vi' ? "Chưa thiết lập hạn mức ngân sách tháng." : "No monthly budget limit set.";
    warnTextEl.className = "text-xs text-on-surface-variant mt-2";
  } else if (totalExpense > state.budgetLimit) {
    warnTextEl.innerText = state.language === 'vi' ? "Cảnh báo: Bạn đã chi tiêu quá hạn mức tháng!" : "Warning: You have exceeded your monthly limit!";
    warnTextEl.className = "text-xs text-brand-coral font-bold mt-2";
  } else {
    const remainingPercentage = Math.round(100 - budgetPercent);
    warnTextEl.innerText = state.language === 'vi' ? `Bạn đã chi tiêu ${Math.round(budgetPercent)}% ngân sách, còn lại ${remainingPercentage}% hạn mức.` : `Spent ${Math.round(budgetPercent)}% of budget, ${remainingPercentage}% limit remaining.`;
    warnTextEl.className = "text-xs text-on-surface-variant mt-2";
  }

  // Render tables
  renderRecentTransactionsTable();
  renderFullTransactionsTable();
  renderCategoryBudgets();
  renderWallets();
  renderSavingsGoal();
  populateWalletSelects();

  // Render Dashboard Category Budgets
  renderDashboardCategoryBudgets();
  syncBudgetWheelEditControls();

  // Synced dropdowns/settings inputs
  document.getElementById("setting-language").value = state.language;
  document.getElementById("setting-currency").value = state.currency;
}

function populateCategorySelects() {
  const quickCat = document.getElementById("quick-category");
  const modalCat = document.getElementById("modal-category");
  const filterCat = document.getElementById("filter-category");

  if (quickCat) quickCat.innerHTML = "";
  if (modalCat) modalCat.innerHTML = "";
  // Keep "All categories" option in filter
  if (filterCat) filterCat.innerHTML = `<option value="">${state.language === 'vi' ? 'Tất cả danh mục' : 'All Categories'}</option>`;

  state.categories.forEach(cat => {
    const name = state.language === 'vi' ? cat.nameVi : cat.nameEn;

    // Add to quick form
    if (quickCat) {
      const opt1 = document.createElement("option");
      opt1.value = cat.id;
      opt1.textContent = name;
      quickCat.appendChild(opt1);
    }

    // Add to modal form
    if (modalCat) {
      const opt2 = document.createElement("option");
      opt2.value = cat.id;
      opt2.textContent = name;
      modalCat.appendChild(opt2);
    }

    // Add to filters
    if (filterCat) {
      const opt3 = document.createElement("option");
      opt3.value = cat.id;
      opt3.textContent = name;
      filterCat.appendChild(opt3);
    }
  });
}

function populateWalletSelects() {
  const modalWallet = document.getElementById("modal-wallet");
  if (!modalWallet) return;

  modalWallet.innerHTML = "";
  if (!state.wallets.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = state.language === 'vi' ? "Chưa có ví" : "No wallet";
    modalWallet.appendChild(option);
    return;
  }

  state.wallets.forEach(wallet => {
    const option = document.createElement("option");
    option.value = wallet.id;
    option.textContent = wallet.name;
    modalWallet.appendChild(option);
  });
}

function renderWallets() {
  const container = document.getElementById("wallets-list-container");
  if (!container) return;

  container.innerHTML = "";
  if (!state.wallets.length) {
    container.innerHTML = `<div class="p-4 text-center text-sm text-on-surface-variant">${state.language === 'vi' ? 'Chưa có ví nào' : 'No wallets yet'}</div>`;
    return;
  }

  state.wallets.forEach(wallet => {
    const item = `
      <div class="flex items-center justify-between rounded-xl border border-outline-variant/10 bg-surface-container-lowest px-3 py-2.5">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-9 h-9 rounded-full ${wallet.color} flex items-center justify-center shrink-0">
            <span class="material-symbols-outlined text-lg">${wallet.icon}</span>
          </div>
          <div class="min-w-0">
            <p class="font-bold text-sm text-on-surface truncate">${wallet.name}</p>
            <p class="text-xs text-on-surface-variant">${formatCurrency(wallet.balance || 0)}</p>
          </div>
        </div>
      </div>
    `;
    container.insertAdjacentHTML("beforeend", item);
  });
}

function renderSavingsGoal() {
  const hasSavingsGoal = state.macbookGoal.target > 0;
  const titleEls = document.querySelectorAll("[data-i18n='goal_title']");
  const savingForEls = document.querySelectorAll("[data-i18n='saving_for_mac']");

  titleEls.forEach(el => {
    el.innerText = hasSavingsGoal
      ? (state.language === 'vi' ? "Mục tiêu tiết kiệm" : "Savings Goal")
      : (state.language === 'vi' ? "Chưa có mục tiêu" : "No savings goal");
  });

  savingForEls.forEach(el => {
    el.innerText = hasSavingsGoal
      ? (state.language === 'vi' ? "Mục tiêu hiện tại" : "Current goal")
      : (state.language === 'vi' ? "Bạn chưa thiết lập mục tiêu tiết kiệm" : "No savings goal has been set");
  });
}

function updateTopExpenseText() {
  const expensesByCat = {};
  state.transactions.forEach(t => {
    if (t.type === 'expense') {
      expensesByCat[t.category] = (expensesByCat[t.category] || 0) + t.amount;
    }
  });

  let topCatId = null;
  let topAmt = 0;
  for (const [catId, amt] of Object.entries(expensesByCat)) {
    if (amt > topAmt) {
      topAmt = amt;
      topCatId = catId;
    }
  }

  const labelEl = document.getElementById("stat-top-expense-category");
  if (topCatId) {
    const catObj = state.categories.find(c => c.id === topCatId);
    const name = catObj ? (state.language === 'vi' ? catObj.nameVi : catObj.nameEn) : "Khác";
    labelEl.innerHTML = (state.language === 'vi' ? `Nhiều nhất: <strong>${name}</strong>` : `Most spent: <strong>${name}</strong>`);
  } else {
    labelEl.innerText = state.language === 'vi' ? "Chưa có khoản chi" : "No expenses yet";
  }
}

function renderRecentTransactionsTable() {
  const container = document.getElementById("recent-transactions-list");
  if (!container) return;
  container.innerHTML = "";

  // Show last 3 transactions, sorted newest first
  const sorted = [...state.transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
  const latest = sorted.slice(0, 3);

  if (latest.length === 0) {
    container.innerHTML = `<div class="p-6 text-center text-on-surface-variant font-medium">${state.language === 'vi' ? 'Không có giao dịch nào' : 'No transactions recorded'}</div>`;
    return;
  }

  latest.forEach(t => {
    const cat = state.categories.find(c => c.id === t.category) || state.categories[state.categories.length - 1];
    const catName = state.language === 'vi' ? cat.nameVi : cat.nameEn;
    const formattedDate = formatDateString(t.date);

    const isExpense = t.type === 'expense';
    const sign = isExpense ? '-' : '+';
    const textClass = isExpense ? 'text-brand-coral' : 'text-brand-teal';

    const item = `
      <div class="px-4 py-3 flex justify-between items-center hover:bg-surface-container-low/40 rounded-xl transition-colors border border-outline-variant/5">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-full ${cat.color} flex items-center justify-center">
            <span class="material-symbols-outlined text-lg">${cat.icon}</span>
          </div>
          <div>
            <p class="font-semibold text-sm text-on-surface">${t.note}</p>
            <div class="flex items-center gap-1.5 mt-0.5">
              <span class="text-[9px] px-1.5 py-0.5 rounded-full ${cat.color} font-bold uppercase inline-block">${catName}</span>
              <span class="text-[9px] text-on-surface-variant flex items-center gap-0.5">
                <span class="material-symbols-outlined text-[10px]">calendar_today</span>
                ${formattedDate}
              </span>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <span class="font-bold text-sm ${textClass}">${sign}${formatCurrency(t.amount)}</span>
          <button onclick="deleteTransaction('${t.id}')" class="text-on-surface-variant hover:text-brand-coral rounded-full p-1 hover:bg-brand-coral-light/20 transition-colors">
            <span class="material-symbols-outlined text-base">delete</span>
          </button>
        </div>
      </div>
    `;
    container.insertAdjacentHTML('beforeend', item);
  });
}

function renderFullTransactionsTable() {
  const container = document.getElementById("full-transactions-timeline");
  if (!container) return;
  container.innerHTML = "";

  const filtered = getFilteredTransactions();

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="p-8 text-center text-on-surface-variant font-medium bg-surface-container-low rounded-2xl border border-outline-variant/10">
        ${state.language === 'vi' ? 'Không tìm thấy giao dịch phù hợp' : 'No transactions match filters'}
      </div>
    `;
    return;
  }

  // Group by date
  const groups = {};
  filtered.forEach(t => {
    if (!groups[t.date]) {
      groups[t.date] = {
        transactions: [],
        netAmount: 0
      };
    }
    groups[t.date].transactions.push(t);
    if (t.type === 'income') {
      groups[t.date].netAmount += t.amount;
    } else {
      groups[t.date].netAmount -= t.amount;
    }
  });

  // Sort dates descending
  const sortedDates = Object.keys(groups).sort((a, b) => new Date(b) - new Date(a));

  sortedDates.forEach(dateStr => {
    const group = groups[dateStr];
    const formattedDate = formatDateString(dateStr);
    const isNetIncome = group.netAmount >= 0;
    const netSign = isNetIncome ? '+' : '-';
    const netClass = isNetIncome ? 'text-brand-teal' : 'text-brand-coral';
    const absNet = Math.abs(group.netAmount);

    let dayBlock = `
      <div class="bento-card custom-shadow overflow-hidden bg-surface-container-lowest border border-outline-variant/10 rounded-2xl mb-4">
        <!-- Day Header -->
        <div class="bg-surface-container-low px-4 py-2.5 flex justify-between items-center text-xs font-bold text-on-surface-variant border-b border-outline-variant/10">
          <div class="flex items-center gap-1.5">
            <span class="material-symbols-outlined text-[16px] text-primary">calendar_today</span>
            <span>${formattedDate}</span>
          </div>
          <span class="${netClass}">${netSign}${formatCurrency(absNet)}</span>
        </div>
        <!-- Day Transactions -->
        <div class="divide-y divide-surface-container">
    `;

    group.transactions.forEach(t => {
      const cat = state.categories.find(c => c.id === t.category) || state.categories[state.categories.length - 1];
      const catName = state.language === 'vi' ? cat.nameVi : cat.nameEn;
      const isExpense = t.type === 'expense';
      const sign = isExpense ? '-' : '+';
      const textClass = isExpense ? 'text-brand-coral' : 'text-brand-teal';

      dayBlock += `
        <div class="px-4 py-3.5 flex justify-between items-center hover:bg-surface-container-low/40 transition-colors">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-full ${cat.color} flex items-center justify-center">
              <span class="material-symbols-outlined text-lg">${cat.icon}</span>
            </div>
            <div>
              <p class="font-semibold text-sm text-on-surface">${t.note}</p>
              <span class="text-[10px] px-2 py-0.5 rounded-full ${cat.color} opacity-90 font-bold uppercase inline-block text-center mt-0.5">${catName}</span>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <span class="font-bold text-sm ${textClass}">${sign}${formatCurrency(t.amount)}</span>
            <button onclick="deleteTransaction('${t.id}')" class="text-on-surface-variant hover:text-brand-coral rounded-full p-1.5 hover:bg-brand-coral-light/20 transition-colors">
              <span class="material-symbols-outlined text-base">delete</span>
            </button>
          </div>
        </div>
      `;
    });

    dayBlock += `
        </div>
      </div>
    `;
    container.insertAdjacentHTML('beforeend', dayBlock);
  });
}

function renderCategoryBudgets() {
  const container = document.getElementById("category-budgets-list");
  if (!container) return;
  container.innerHTML = "";

  // Compute expense amounts per category
  const expenseMap = {};
  state.transactions.forEach(t => {
    if (t.type === 'expense') {
      expenseMap[t.category] = (expenseMap[t.category] || 0) + t.amount;
    }
  });

  state.categories.forEach(cat => {
    if (cat.id === 'salary') return; // salary has no budget limit

    const spent = expenseMap[cat.id] || 0;
    const limit = state.categoryLimits[cat.id] || 0;
    const percent = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
    const name = state.language === 'vi' ? cat.nameVi : cat.nameEn;

    let barColor = "bg-primary";
    if (percent > 90) barColor = "bg-brand-coral";
    else if (percent > 65) barColor = "bg-secondary";

    const card = `
      <div class="py-2.5 border-b border-outline-variant/10 last:border-0">
        <div class="flex justify-between items-center mb-1.5">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-lg ${cat.color.split(' ')[1]}">${cat.icon}</span>
            <span class="font-bold text-sm text-on-surface">${name}</span>
            <button onclick="openCategoryModal('${cat.id}')" class="text-primary hover:text-secondary p-0.5 rounded transition-colors flex items-center justify-center cursor-pointer" title="${state.language === 'vi' ? 'Chỉnh sửa' : 'Edit'}">
              <span class="material-symbols-outlined text-sm">edit</span>
            </button>
          </div>
          <span class="text-xs text-on-surface-variant font-semibold">
            ${formatCurrency(spent)} / ${formatCurrency(limit)} (${percent}%)
          </span>
        </div>
        <div class="w-full bg-surface-container-high h-2.5 rounded-full overflow-hidden">
          <div class="${barColor} h-full rounded-full transition-all duration-500" style="width: ${percent}%"></div>
        </div>
      </div>
    `;
    container.insertAdjacentHTML('beforeend', card);
  });
}

function formatDateString(dateStr) {
  const todayStr = getTodayDateString(0);
  const yesterdayStr = getTodayDateString(-1);

  if (dateStr === todayStr) {
    return state.language === 'vi' ? "Hôm nay" : "Today";
  } else if (dateStr === yesterdayStr) {
    return state.language === 'vi' ? "Hôm qua" : "Yesterday";
  } else {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  }
}

function getFilteredTransactions() {
  const qSearch = document.getElementById("filter-search").value.toLowerCase();
  const qCategory = document.getElementById("filter-category").value;
  const qType = document.getElementById("filter-type").value;
  const qSort = document.getElementById("filter-sort").value;

  let filtered = state.transactions.filter(t => {
    const matchesSearch = t.note.toLowerCase().includes(qSearch);
    const matchesCategory = qCategory === "" || t.category === qCategory;
    const matchesType = qType === "" || t.type === qType;
    return matchesSearch && matchesCategory && matchesType;
  });

  // Sorting
  if (qSort === 'date-desc') {
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  } else if (qSort === 'date-asc') {
    filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
  } else if (qSort === 'amount-desc') {
    filtered.sort((a, b) => b.amount - a.amount);
  } else if (qSort === 'amount-asc') {
    filtered.sort((a, b) => a.amount - b.amount);
  }

  return filtered;
}

// --- Global Window Bindings for HTML Inline Handlers ---
window.toggleAuth = function (type) {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const header = document.getElementById('form-header');

  if (type === 'register') {
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
    header.innerHTML = `
      <h2 class="font-headline-md text-headline-md text-on-surface mb-2" data-i18n="register_title">Bắt đầu cùng FinZ</h2>
      <p class="font-body-md text-body-md text-on-surface-variant" data-i18n="register_sub">Hãy điền các thông tin sau để thiết lập tài khoản của bạn.</p>
    `;
  } else {
    registerForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
    header.innerHTML = `
      <h2 class="font-headline-md text-headline-md text-on-surface mb-2" data-i18n="login_welcome">Mừng bạn quay trở lại!</h2>
      <p class="font-body-md text-body-md text-on-surface-variant" data-i18n="login_sub">Vui lòng nhập thông tin để đăng nhập vào tài khoản.</p>
    `;
  }
  applyTranslations();
};

window.switchTab = function (tabId) {
  const panels = ['dashboard', 'transactions', 'budget', 'settings'];
  panels.forEach(p => {
    const el = document.getElementById(`${p}-panel`);
    if (el) {
      if (p === tabId) {
        el.classList.remove('hidden');
        el.classList.add('block');
      } else {
        el.classList.remove('block');
        el.classList.add('hidden');
      }
    }
  });

  // Update Desktop Nav Active States
  panels.forEach(p => {
    const navDt = document.getElementById(`nav-${p}-dt`);
    if (navDt) {
      if (p === tabId) {
        navDt.className = "flex items-center px-4 py-3 bg-primary-container text-on-primary-container rounded-xl font-bold transition-all duration-200 cursor-pointer";
      } else {
        navDt.className = "flex items-center px-4 py-3 text-on-surface-variant hover:bg-surface-container-highest rounded-xl transition-all duration-200 cursor-pointer";
      }
    }
  });

  // Update Mobile Nav Active States
  panels.forEach(p => {
    const navMb = document.getElementById(`nav-${p}-mb`);
    if (navMb) {
      if (p === tabId) {
        navMb.className = "flex flex-col items-center justify-center bg-secondary-container text-on-secondary-container rounded-full px-2 py-1 cursor-pointer transition-all";
      } else {
        navMb.className = "flex flex-col items-center justify-center bg-transparent text-on-surface-variant rounded-full px-2 py-1 cursor-pointer transition-all";
      }
    }
  });

  // Rerender layout
  renderApp();
};

window.openQuickAddModal = function () {
  const modal = document.getElementById("quick-add-modal");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  // Trigger scaling
  setTimeout(() => {
    modal.querySelector("div").classList.remove("scale-95");
    modal.querySelector("div").classList.add("scale-100");
  }, 50);
};

window.closeQuickAddModal = function () {
  const modal = document.getElementById("quick-add-modal");
  modal.querySelector("div").classList.remove("scale-100");
  modal.querySelector("div").classList.add("scale-95");
  setTimeout(() => {
    modal.classList.remove("flex");
    modal.classList.add("hidden");
  }, 150);
};

window.openCreateWalletModal = function () {
  const modal = document.getElementById("create-wallet-modal");
  if (!modal) return;
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  setTimeout(() => {
    modal.querySelector("div").classList.remove("scale-95");
    modal.querySelector("div").classList.add("scale-100");
  }, 50);
};

window.closeCreateWalletModal = function () {
  const modal = document.getElementById("create-wallet-modal");
  if (!modal) return;
  modal.querySelector("div").classList.remove("scale-100");
  modal.querySelector("div").classList.add("scale-95");
  setTimeout(() => {
    modal.classList.remove("flex");
    modal.classList.add("hidden");
  }, 150);
};

window.handleCreateWallet = function (e) {
  e.preventDefault();
  const nameInput = document.getElementById("new-wallet-name");
  const balanceInput = document.getElementById("new-wallet-balance");
  const iconInput = document.getElementById("new-wallet-icon");
  const colorInput = document.getElementById("new-wallet-color");

  const name = nameInput.value.trim();
  const balance = parseFloat(balanceInput.value) || 0;
  if (!name) {
    showToast(state.language === 'vi' ? "Vui lòng nhập tên ví!" : "Please enter wallet name!");
    return;
  }

  state.wallets.push(createWallet({
    name,
    balance,
    icon: iconInput.value,
    color: colorInput.value
  }));

  saveWalletsToStorage();
  e.target.reset();
  closeCreateWalletModal();
  renderApp();
  showToast(state.language === 'vi' ? "Đã tạo ví mới!" : "Wallet created!");
};

window.setTransactionType = function (type) {
  state.currentType = type;
  const expBtn = document.getElementById("type-expense-btn");
  const incBtn = document.getElementById("type-income-btn");

  if (expBtn && incBtn) {
    if (type === 'expense') {
      expBtn.className = "py-2 rounded-xl border-2 border-primary bg-primary/5 text-primary font-bold text-sm transition-all focus:outline-none";
      incBtn.className = "py-2 rounded-xl border-2 border-transparent bg-surface-container text-on-surface-variant font-bold text-sm transition-all focus:outline-none";
    } else {
      incBtn.className = "py-2 rounded-xl border-2 border-primary bg-primary/5 text-primary font-bold text-sm transition-all focus:outline-none";
      expBtn.className = "py-2 rounded-xl border-2 border-transparent bg-surface-container text-on-surface-variant font-bold text-sm transition-all focus:outline-none";
    }
  }
};

window.setModalTransactionType = function (type) {
  state.currentModalType = type;
  const expBtn = document.getElementById("modal-type-expense-btn");
  const incBtn = document.getElementById("modal-type-income-btn");

  if (type === 'expense') {
    expBtn.className = "py-2 rounded-xl border-2 border-primary bg-primary/5 text-primary font-bold text-sm transition-all focus:outline-none";
    incBtn.className = "py-2 rounded-xl border-2 border-transparent bg-surface-container text-on-surface-variant font-bold text-sm transition-all focus:outline-none";
  } else {
    incBtn.className = "py-2 rounded-xl border-2 border-primary bg-primary/5 text-primary font-bold text-sm transition-all focus:outline-none";
    expBtn.className = "py-2 rounded-xl border-2 border-transparent bg-surface-container text-on-surface-variant font-bold text-sm transition-all focus:outline-none";
  }
};

window.handleQuickAdd = async function (e) {
  e.preventDefault();
  const amountInput = document.getElementById("quick-amount");
  const noteInput = document.getElementById("quick-note");
  const categorySelect = document.getElementById("quick-category");
  const dateInput = document.getElementById("quick-date");

  const newTrans = createLocalTransaction({
    note: noteInput.value,
    category: categorySelect.value,
    date: dateInput.value,
    rawAmount: parseFloat(amountInput.value),
    type: state.currentType,
    currency: state.currency
  });

  if (state.isLoggedIn && state.user.id) {
    try {
      Object.assign(newTrans, await createTransaction(state.user.id, newTrans));
    } catch (err) {
      console.error("Error inserting transaction to Supabase:", err);
      showToast(state.language === 'vi' ? "Lỗi lưu giao dịch!" : "Error saving transaction!");
      return;
    }
  } else {
    newTrans.id = `t_${Date.now()}`;
  }

  state.transactions.push(newTrans);
  state.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
  saveTransactionsToStorage();

  // Clear inputs
  amountInput.value = "";
  noteInput.value = "";
  dateInput.value = getTodayDateString();

  // Show toast
  showToast(state.language === 'vi' ? "Thêm giao dịch thành công!" : "Transaction added successfully!");

  renderApp();
};

window.handleModalAdd = async function (e) {
  e.preventDefault();
  const amountInput = document.getElementById("modal-amount");
  const noteInput = document.getElementById("modal-note");
  const categorySelect = document.getElementById("modal-category");
  const dateInput = document.getElementById("modal-date");

  const newTrans = createLocalTransaction({
    note: noteInput.value,
    category: categorySelect.value,
    date: dateInput.value,
    rawAmount: parseFloat(amountInput.value),
    type: state.currentModalType,
    currency: state.currency
  });

  if (state.isLoggedIn && state.user.id) {
    try {
      Object.assign(newTrans, await createTransaction(state.user.id, newTrans));
    } catch (err) {
      console.error("Error inserting transaction to Supabase:", err);
      showToast(state.language === 'vi' ? "Lỗi lưu giao dịch!" : "Error saving transaction!");
      return;
    }
  } else {
    newTrans.id = `t_${Date.now()}`;
  }

  state.transactions.push(newTrans);
  state.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
  saveTransactionsToStorage();

  // Clear inputs
  amountInput.value = "";
  noteInput.value = "";
  dateInput.value = getTodayDateString();

  closeQuickAddModal();
  showToast(state.language === 'vi' ? "Thêm giao dịch thành công!" : "Transaction added successfully!");

  renderApp();
};

window.deleteTransaction = async function (id) {
  if (confirm(state.language === 'vi' ? "Bạn có chắc chắn muốn xóa giao dịch này?" : "Are you sure you want to delete this transaction?")) {
    if (state.isLoggedIn && state.user.id) {
      try {
        await deleteTransactionById(state.user.id, id);
      } catch (err) {
        console.error("Error deleting transaction from Supabase:", err);
        showToast(state.language === 'vi' ? "Lỗi xóa giao dịch!" : "Error deleting transaction!");
        return;
      }
    }

    state.transactions = state.transactions.filter(t => t.id !== id);
    saveTransactionsToStorage();
    showToast(state.language === 'vi' ? "Đã xóa giao dịch!" : "Transaction deleted!");
    renderApp();
  }
};

window.addSavingsDialog = function () {
  if (state.macbookGoal.target <= 0) {
    const targetInput = prompt(
      state.language === 'vi'
        ? `Nhập mục tiêu tiết kiệm đầu tiên (Đơn vị: ${state.currency.toUpperCase()}):`
        : `Enter your first savings target (Unit: ${state.currency.toUpperCase()}):`,
      state.currency === 'vnd' ? "1000000" : "100"
    );

    if (!targetInput) return;
    const targetValue = parseCurrencyInput(targetInput);
    if (isNaN(targetValue) || targetValue <= 0) {
      alert(state.language === 'vi' ? "Mục tiêu không hợp lệ!" : "Invalid target!");
      return;
    }

    const target = toBaseCurrency(targetValue, state.currency);

    state.macbookGoal = { target, saved: 0 };
    saveSettingsToStorage();
    showToast(state.language === 'vi' ? "Đã tạo mục tiêu tiết kiệm!" : "Savings goal created!");
    renderApp();
    return;
  }

  const maxVal = state.macbookGoal.target - state.macbookGoal.saved;
  if (maxVal <= 0) {
    alert(state.language === 'vi' ? "Chúc mừng! Bạn đã hoàn thành mục mục tiêu tiết kiệm này!" : "Congratulations! You have completed this saving goal!");
    return;
  }

  const input = prompt(
    (state.language === 'vi' ? `Nhập số tiền muốn gửi tiết kiệm (Đơn vị: ${state.currency.toUpperCase()}):` : `Enter savings amount (Unit: ${state.currency.toUpperCase()}):`),
    "500000"
  );

  if (input) {
    const val = parseCurrencyInput(input);
    if (isNaN(val) || val <= 0) {
      alert(state.language === 'vi' ? "Số tiền không hợp lệ!" : "Invalid amount!");
      return;
    }
    const amt = toBaseCurrency(val, state.currency);

    state.macbookGoal.saved += amt;
    if (state.macbookGoal.saved > state.macbookGoal.target) {
      state.macbookGoal.saved = state.macbookGoal.target;
    }
    saveSettingsToStorage();
    showToast(state.language === 'vi' ? "Đã thêm tiền tích lũy thành công!" : "Accumulation added successfully!");
    renderApp();
  }
};

window.resetSavingsDialog = function () {
  if (confirm(state.language === 'vi' ? "Reset lại tiến độ tiết kiệm?" : "Reset savings progress?")) {
    state.macbookGoal.saved = 0;
    saveSettingsToStorage();
    renderApp();
  }
};

window.editBudgetLimitDialog = function () {
  const input = prompt(
    (state.language === 'vi' ? `Nhập hạn mức chi tiêu tháng mới (Đơn vị: ${state.currency.toUpperCase()}):` : `Enter new monthly limit (Unit: ${state.currency.toUpperCase()}):`),
    (state.currency === 'usd' ? state.budgetLimit / USD_RATE : (state.currency === 'jpy' ? state.budgetLimit / JPY_RATE : state.budgetLimit)).toString()
  );

  if (input) {
    const val = parseFloat(input);
    if (isNaN(val) || val <= 0) {
      alert(state.language === 'vi' ? "Giá trị không hợp lệ!" : "Invalid limit value!");
      return;
    }
    let limitVal = val;
    if (state.currency === 'usd') limitVal = val * USD_RATE;
    else if (state.currency === 'jpy') limitVal = val * JPY_RATE;
    state.budgetLimit = limitVal;
    saveSettingsToStorage();
    showToast(state.language === 'vi' ? "Cập nhật hạn mức thành công!" : "Limit updated successfully!");
    renderApp();
  }
};

window.changeLanguageSetting = function () {
  state.language = document.getElementById("setting-language").value;
  saveSettingsToStorage();
  populateCategorySelects();
  renderApp();
};

window.changeCurrencySetting = function () {
  state.currency = document.getElementById("setting-currency").value;
  saveSettingsToStorage();
  renderApp();
};

window.setThemeMode = function (mode) {
  state.theme = mode;
  saveSettingsToStorage();
  renderApp();
};

window.toggleDetailedStats = function () {
  const cards = document.querySelectorAll('.summary-details-card');
  const textEl = document.getElementById('toggle-stats-text');
  const iconEl = document.getElementById('toggle-stats-icon');
  if (!cards.length || !textEl || !iconEl) return;

  const isExpanded = cards[0].classList.contains('show-mobile');

  cards.forEach(card => {
    if (isExpanded) {
      card.classList.remove('show-mobile');
    } else {
      card.classList.add('show-mobile');
    }
  });

  if (isExpanded) {
    textEl.setAttribute('data-i18n', 'toggle_stats_show');
    iconEl.innerText = 'expand_more';
  } else {
    textEl.setAttribute('data-i18n', 'toggle_stats_hide');
    iconEl.innerText = 'expand_less';
  }
  applyTranslations();
};

window.editProfileDialog = async function () {
  const name = prompt(state.language === 'vi' ? "Nhập họ tên mới:" : "Enter new name:", state.user.name);
  if (name === null) return;
  const email = prompt(state.language === 'vi' ? "Nhập email mới:" : "Enter new email:", state.user.email);
  if (email === null) return;

  state.user.name = name;
  state.user.email = email;
  saveUserToLocalStorage(state.user);

  if (state.isLoggedIn && state.user.id) {
    try {
      await updateProfile(state.user.id, name, email);
    } catch (err) {
      console.error("Error updating profile in Supabase:", err);
    }
  }

  showToast(state.language === 'vi' ? "Cập nhật tài khoản thành công!" : "Profile updated!");
  renderApp();
};

window.changeAvatarMock = function () {
  const url = prompt(state.language === 'vi' ? "Nhập URL ảnh đại diện mới:" : "Enter avatar image URL:");
  if (url) {
    document.getElementById("profile-avatar").src = url;
    document.getElementById("header-avatar").src = url;
  }
};

window.manageCategoriesDialog = function () {
  alert(state.language === 'vi' ? "Tính năng tùy biến Danh mục đang được phát triển nâng cấp!" : "Custom categories feature is under development!");
};

window.exportTransactionsCSV = function () {
  let csvContent = "data:text/csv;charset=utf-8,";

  // Header row
  csvContent += "ID,Ghi chu (Note),Danh muc (Category),Ngay (Date),So tien (Amount),Loai (Type)\n";

  state.transactions.forEach(t => {
    const cat = state.categories.find(c => c.id === t.category) || state.categories[state.categories.length - 1];
    const catName = state.language === 'vi' ? cat.nameVi : cat.nameEn;
    // Escape quotes
    const note = t.note.replace(/"/g, '""');
    csvContent += `"${t.id}","${note}","${catName}","${t.date}",${t.amount},"${t.type}"\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `lich_su_giao_dich_finz_${getTodayDateString()}.csv`);
  document.body.appendChild(link); // Required for FF
  link.click();
  document.body.removeChild(link);
  showToast(state.language === 'vi' ? "Đã tải xuống lịch sử giao dịch!" : "Downloaded transaction history!");
};

window.handleLogout = async function () {
  if (confirm(state.language === 'vi' ? "Bạn có chắc chắn muốn đăng xuất?" : "Are you sure you want to log out?")) {
    try {
      await signOut();
    } catch (err) {
      console.error("Error signing out from Supabase:", err);
    }
    clearSessionStorage();
    
    state.isLoggedIn = false;
    renderApp();
  }
};

window.editCategoryLimit = function (catId) {
  const catObj = state.categories.find(c => c.id === catId);
  if (!catObj) return;
  const name = state.language === 'vi' ? catObj.nameVi : catObj.nameEn;
  const currentLimit = state.categoryLimits[catId] || 0;
  const input = prompt(
    state.language === 'vi'
      ? `Nhập hạn mức chi tiêu mới cho [${name}] (Đơn vị: ${state.currency.toUpperCase()}):`
      : `Enter new budget limit for [${name}] (Unit: ${state.currency.toUpperCase()}):`,
    (state.currency === 'usd' ? currentLimit / USD_RATE : (state.currency === 'jpy' ? currentLimit / JPY_RATE : currentLimit)).toString()
  );

  if (input !== null) {
    const val = parseFloat(input);
    if (isNaN(val) || val <= 0) {
      alert(state.language === 'vi' ? "Giá trị không hợp lệ!" : "Invalid limit value!");
      return;
    }
    let limitVal = val;
    if (state.currency === 'usd') limitVal = val * USD_RATE;
    else if (state.currency === 'jpy') limitVal = val * JPY_RATE;
    state.categoryLimits[catId] = limitVal;
    saveSettingsToStorage();
    showToast(state.language === 'vi' ? `Đã cập nhật hạn mức cho ${name}!` : `Updated limit for ${name}!`);
    renderApp();
  }
};

window.filterTransactions = function () {
  renderFullTransactionsTable();
};

function applyTheme() {
  // Toggle button UI active segment style
  const themeBtns = {
    light: document.getElementById("theme-light-btn"),
    dark: document.getElementById("theme-dark-btn"),
    auto: document.getElementById("theme-auto-btn")
  };

  Object.keys(themeBtns).forEach(key => {
    const btn = themeBtns[key];
    if (btn) {
      if (key === state.theme) {
        btn.className = "flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-primary font-bold bg-white shadow-sm transition-all focus:outline-none dark:bg-zinc-800 dark:text-white";
      } else {
        btn.className = "flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-on-surface-variant hover:bg-surface-variant/50 transition-all focus:outline-none";
      }
    }
  });

  // Apply actual HTML styling class
  if (state.theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else if (state.theme === 'light') {
    document.documentElement.classList.remove('dark');
  } else {
    // Auto system detection
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (systemPrefersDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }
}

// --- Setup Event Listeners ---
function setupListeners() {
  // Login Form Submit
  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("login-email").value;
      const password = document.getElementById("login-password").value;

      const submitBtn = loginForm.querySelector("button[type='submit']");
      const originalText = submitBtn.innerText;
      submitBtn.innerText = state.language === 'vi' ? "Đang đăng nhập..." : "Logging in...";
      submitBtn.disabled = true;

      try {
        const { error } = await signInWithPassword(email, password);

        if (error) {
          alert(state.language === 'vi' ? `Lỗi đăng nhập: ${error.message}` : `Login error: ${error.message}`);
          return;
        }

        showToast(state.language === 'vi' ? "Đăng nhập thành công!" : "Login successful!");
      } catch (err) {
        console.error(err);
      } finally {
        submitBtn.innerText = originalText;
        submitBtn.disabled = false;
      }
    });
  }

  // Register Form Submit
  const registerForm = document.getElementById("register-form");
  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("reg-name").value;
      const email = document.getElementById("reg-email").value;
      const password = document.getElementById("reg-password").value;
      const confirmPassword = document.getElementById("reg-confirm").value;

      if (password !== confirmPassword) {
        alert(state.language === 'vi' ? "Mật khẩu xác nhận không khớp!" : "Confirm password does not match!");
        return;
      }

      const submitBtn = registerForm.querySelector("button[type='submit']");
      const originalText = submitBtn.innerText;
      submitBtn.innerText = state.language === 'vi' ? "Đang đăng ký..." : "Registering...";
      submitBtn.disabled = true;

      try {
        const { error } = await signUpWithPassword(name, email, password);

        if (error) {
          alert(state.language === 'vi' ? `Lỗi đăng ký: ${error.message}` : `Registration error: ${error.message}`);
          return;
        }

        alert(state.language === 'vi'
          ? "Đăng ký thành công! Vui lòng kiểm tra email của bạn để xác thực tài khoản (nếu có yêu cầu)."
          : "Registration successful! Please check your email to verify your account (if required)."
        );
        window.toggleAuth('login');
      } catch (err) {
        console.error(err);
      } finally {
        submitBtn.innerText = originalText;
        submitBtn.disabled = false;
      }
    });
  }

  // Local demo login without embedding reusable credentials in the client bundle.
  const googleBtn = document.getElementById("google-login-btn");
  if (googleBtn) {
    googleBtn.addEventListener("click", () => {
      state.user = {
        ...defaultUser,
        name: `${defaultUser.name} (Demo)`
      };
      state.isLoggedIn = true;
      saveUserToLocalStorage(state.user);
      showToast(state.language === 'vi' ? "Đăng nhập Demo thành công!" : "Demo login successful!");
      renderApp();
    });
  }

  // Close modal on background click
  const modal = document.getElementById("quick-add-modal");
  if (modal) {
    modal.addEventListener("click", () => closeQuickAddModal());
  }

  const walletModal = document.getElementById("create-wallet-modal");
  if (walletModal) {
    walletModal.addEventListener("click", () => closeCreateWalletModal());
  }

  // Budget Wheel Global Drag Events
  document.addEventListener("mousemove", (e) => {
    handleBudgetWheelDrag(e);
  });
  document.addEventListener("touchmove", (e) => {
    handleBudgetWheelDrag(e);
  }, { passive: false });

  document.addEventListener("mouseup", () => {
    endBudgetWheelDrag();
  });
  document.addEventListener("touchend", () => {
    endBudgetWheelDrag();
  });
}

// --- Interactive Budget Wheel Math & Helpers ---

function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
  const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
  return {
    x: centerX + (radius * Math.cos(angleInRadians)),
    y: centerY + (radius * Math.sin(angleInRadians))
  };
}

function getDonutSlicePath(x, y, radiusIn, radiusOut, startAngle, endAngle) {
  if (endAngle - startAngle >= 360) {
    endAngle = startAngle + 359.99;
  }
  const startOut = polarToCartesian(x, y, radiusOut, startAngle);
  const endOut = polarToCartesian(x, y, radiusOut, endAngle);
  const startIn = polarToCartesian(x, y, radiusIn, startAngle);
  const endIn = polarToCartesian(x, y, radiusIn, endAngle);
  
  const largeArcFlag = (endAngle - startAngle) > 180 ? 1 : 0;
  
  return [
    "M", startOut.x, startOut.y,
    "A", radiusOut, radiusOut, 0, largeArcFlag, 1, endOut.x, endOut.y,
    "L", endIn.x, endIn.y,
    "A", radiusIn, radiusIn, 0, largeArcFlag, 0, startIn.x, startIn.y,
    "Z"
  ].join(" ");
}

function getHexColorsForCategory(cat) {
  const cls = cat.color || '';
  const base = cls.split(' ')[0];
  let bg = brandColors.blue.pastel;
  let progress = brandColors.blue.saturated;
  
  switch(base) {
    case 'bg-tertiary-container':
    case 'bg-brand-teal-light':
      bg = brandColors.teal.pastel;
      progress = brandColors.teal.saturated;
      break;
    case 'bg-secondary-container':
    case 'bg-brand-purple-light':
      bg = brandColors.purple.pastel;
      progress = brandColors.purple.saturated;
      break;
    case 'bg-primary-container/40':
    case 'bg-primary-container':
    case 'bg-brand-blue-light':
      bg = brandColors.blue.pastel;
      progress = brandColors.blue.saturated;
      break;
    case 'bg-yellow-100':
    case 'bg-brand-yellow-light':
      bg = brandColors.yellow.pastel;
      progress = brandColors.yellow.saturated;
      break;
    case 'bg-emerald-100':
      bg = brandColors.teal.pastel;
      progress = brandColors.teal.saturated;
      break;
    case 'bg-red-100':
    case 'bg-orange-100':
    case 'bg-pink-100':
    case 'bg-brand-coral-light':
      bg = brandColors.coral.pastel;
      progress = brandColors.coral.saturated;
      break;
    case 'bg-indigo-100':
      bg = brandColors.purple.pastel;
      progress = brandColors.purple.saturated;
      break;
    case 'bg-surface-container-highest':
      bg = '#f3f4f6'; // gray track
      progress = '#72787a'; // gray progress
      break;
  }
  return { bg, progress };
}

function setCenterInfo(label, value, colorClass = '') {
  const labelEl = document.getElementById("budget-wheel-center-label");
  const valueEl = document.getElementById("budget-wheel-center-value");
  if (labelEl) labelEl.textContent = label;
  if (valueEl) {
    valueEl.textContent = value;
    // Map text classes to the element class
    const cleanColorClass = colorClass ? colorClass.replace('font-bold', '') : 'text-primary';
    valueEl.setAttribute("class", `font-bold text-xs md:text-sm ${cleanColorClass}`);
  }
}

// Toggle edit mode
function syncBudgetWheelEditControls() {
  const btnText = document.getElementById("budget-wheel-edit-text");
  const btnIcon = document.getElementById("budget-wheel-edit-icon");
  const subtitle = document.getElementById("budget-wheel-subtitle");

  if (state.isEditingBudgetWheel) {
    if (btnText) btnText.innerText = state.language === 'vi' ? "Lưu" : "Save";
    if (btnIcon) btnIcon.innerText = "check";
    if (subtitle) {
      subtitle.innerText = state.language === 'vi'
        ? "Kéo thả các thanh chia để phân bổ ngân sách"
        : "Drag dividers to allocate budget";
      subtitle.className = "text-xs text-secondary font-bold animate-pulse";
    }
    return;
  }

  if (btnText) btnText.innerText = state.language === 'vi' ? "Chỉnh sửa" : "Edit";
  if (btnIcon) btnIcon.innerText = "edit";
  if (subtitle) {
    subtitle.innerText = state.language === 'vi'
      ? "Tình hình sử dụng hạn mức"
      : "Budget utilization status";
    subtitle.className = "text-xs text-on-surface-variant";
  }
}

window.toggleBudgetWheelEdit = function() {
  state.isEditingBudgetWheel = !state.isEditingBudgetWheel;

  if (!state.isEditingBudgetWheel) {
    saveSettingsToStorage();
    showToast(state.language === 'vi' ? "Đã lưu phân bổ ngân sách mới!" : "New budget allocation saved!");
  }

  renderApp();
};

// Handle dragging logic
function handleBudgetWheelDrag(e) {
  if (!isDraggingBudgetWheel || draggedBudgetWheelHandleIndex === -1) return;

  const svg = document.getElementById("budget-wheel-svg");
  if (!svg) return;

  const clientX = e.clientX || (e.touches && e.touches[0].clientX);
  const clientY = e.clientY || (e.touches && e.touches[0].clientY);

  const rect = svg.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const dx = clientX - centerX;
  const dy = clientY - centerY;

  let angle = Math.atan2(dy, dx) * 180 / Math.PI + 90;
  if (angle < 0) angle += 360;

  const categoriesToShow = state.categories.filter(c => c.id !== 'salary');
  let totalCategoryBudget = 0;
  categoriesToShow.forEach(cat => {
    totalCategoryBudget += state.categoryLimits[cat.id] || 0;
  });
  if (totalCategoryBudget === 0) return;

  const angles = [0];
  let currentAngle = 0;
  categoriesToShow.forEach(cat => {
    const limit = state.categoryLimits[cat.id] || 0;
    const sliceAngle = (limit / totalCategoryBudget) * 360;
    currentAngle += sliceAngle;
    angles.push(currentAngle);
  });
  angles[angles.length - 1] = 360;

  const startAngleOffset = state.startAngleOffset || 0;
  const absAngles = angles.map(a => a + startAngleOffset);

  const idx = draggedBudgetWheelHandleIndex;
  const minAngle = 12; // Enforce minimum slice width (approx 3.3%)
  const currentAbsAngle = absAngles[idx];

  let diff = angle - (currentAbsAngle % 360);
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  let targetAbsAngle = currentAbsAngle + diff;

  let prevAbsAngle, nextAbsAngle;
  let catPrev, catNext;

  if (idx === 0) {
    prevAbsAngle = absAngles[absAngles.length - 2] - 360;
    nextAbsAngle = absAngles[1];
    catPrev = categoriesToShow[categoriesToShow.length - 1];
    catNext = categoriesToShow[0];
  } else {
    prevAbsAngle = absAngles[idx - 1];
    nextAbsAngle = absAngles[idx + 1];
    catPrev = categoriesToShow[idx - 1];
    catNext = categoriesToShow[idx];
  }

  const minAllowed = prevAbsAngle + minAngle;
  const maxAllowed = nextAbsAngle - minAngle;

  let constrainedAbsAngle = Math.max(minAllowed, Math.min(maxAllowed, targetAbsAngle));

  const W_prev = constrainedAbsAngle - prevAbsAngle;
  const W_next = nextAbsAngle - constrainedAbsAngle;

  const prevRaw = (W_prev / 360) * totalCategoryBudget;
  const nextRaw = (W_next / 360) * totalCategoryBudget;

  // Set unrounded limits during dragging for a perfectly smooth movement
  let roundedPrev = prevRaw;
  let roundedNext = nextRaw;

  // Prevent sub-zero limits
  const minLimitVal = 1000; // 1,000 VND, a tiny fraction of budget
  if (roundedPrev < minLimitVal) roundedPrev = minLimitVal;
  if (roundedNext < minLimitVal) roundedNext = minLimitVal;

  let otherSum = 0;
  categoriesToShow.forEach(cat => {
    if (cat.id !== catPrev.id && cat.id !== catNext.id) {
      otherSum += state.categoryLimits[cat.id] || 0;
    }
  });

  // Balance values
  roundedNext = totalCategoryBudget - otherSum - roundedPrev;
  if (roundedNext < minLimitVal) {
    roundedNext = minLimitVal;
    roundedPrev = totalCategoryBudget - otherSum - roundedNext;
  }

  // Update State limits
  state.categoryLimits[catPrev.id] = roundedPrev;
  state.categoryLimits[catNext.id] = roundedNext;

  if (idx === 0) {
    state.startAngleOffset = (constrainedAbsAngle % 360 + 360) % 360;
  }

  // Redraw SVG wheel and update legend
  renderDashboardCategoryBudgets();
  renderCategoryBudgets();

  if (e.cancelable) e.preventDefault();
}

function endBudgetWheelDrag() {
  if (!isDraggingBudgetWheel) return;
  isDraggingBudgetWheel = false;
  draggedBudgetWheelHandleIndex = -1;
  document.body.style.userSelect = "";

  // Snap all limits to the currency-aware step
  const categoriesToShow = state.categories.filter(c => c.id !== 'salary');
  let totalCategoryBudget = 0;
  categoriesToShow.forEach(cat => {
    totalCategoryBudget += state.categoryLimits[cat.id] || 0;
  });
  if (totalCategoryBudget === 0) {
    renderEmptyBudgetWheel(svg);
    return;
  }

  // Currency-aware rounding steps
  let step = 50000;
  if (state.currency === 'usd') step = 5;
  else if (state.currency === 'jpy') step = 500;

  // Round all categories except the largest one to preserve total budget limit
  let roundedSum = 0;
  let largestCatIdx = 0;
  let maxVal = -1;

  categoriesToShow.forEach((cat, idx) => {
    const val = state.categoryLimits[cat.id] || 0;
    if (val > maxVal) {
      maxVal = val;
      largestCatIdx = idx;
    }
  });

  categoriesToShow.forEach((cat, idx) => {
    if (idx !== largestCatIdx) {
      let roundedVal = Math.round((state.categoryLimits[cat.id] || 0) / step) * step;
      if (roundedVal < step) roundedVal = step;
      state.categoryLimits[cat.id] = roundedVal;
      roundedSum += roundedVal;
    }
  });

  const largestCat = categoriesToShow[largestCatIdx];
  let roundedLargest = totalCategoryBudget - roundedSum;
  if (roundedLargest < step) {
    roundedLargest = step;
  }
  state.categoryLimits[largestCat.id] = roundedLargest;

  // If there's still a tiny rounding difference, adjust the largest category
  let finalSum = 0;
  categoriesToShow.forEach(cat => {
    finalSum += state.categoryLimits[cat.id] || 0;
  });
  if (finalSum !== totalCategoryBudget) {
    state.categoryLimits[largestCat.id] += (totalCategoryBudget - finalSum);
  }

  // Redraw SVG wheel and update legend
  renderDashboardCategoryBudgets();
  renderCategoryBudgets();
}

// --- Dashboard Category Budgets Rendering ---
function renderEmptyBudgetWheel(svg) {
  const emptyGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");

  const ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  ring.setAttribute("cx", "340");
  ring.setAttribute("cy", "200");
  ring.setAttribute("r", "82");
  ring.setAttribute("fill", "none");
  ring.setAttribute("stroke", "#e3e3d5");
  ring.setAttribute("stroke-width", "28");
  ring.setAttribute("opacity", "0.55");
  emptyGroup.appendChild(ring);

  const title = document.createElementNS("http://www.w3.org/2000/svg", "text");
  title.setAttribute("x", "340");
  title.setAttribute("y", "194");
  title.setAttribute("text-anchor", "middle");
  title.setAttribute("class", "font-bold text-[18px] fill-current text-on-surface");
  title.textContent = state.language === 'vi' ? "Chưa có ngân sách" : "No budget yet";
  emptyGroup.appendChild(title);

  const subtitle = document.createElementNS("http://www.w3.org/2000/svg", "text");
  subtitle.setAttribute("x", "340");
  subtitle.setAttribute("y", "218");
  subtitle.setAttribute("text-anchor", "middle");
  subtitle.setAttribute("class", "text-[16px] fill-current text-on-surface-variant");
  subtitle.textContent = state.language === 'vi' ? "Thiết lập hạn mức để bắt đầu" : "Set limits to begin";
  emptyGroup.appendChild(subtitle);

  svg.appendChild(emptyGroup);
}

function renderDashboardCategoryBudgets() {
  const container = document.getElementById("dashboard-category-budgets");
  const svg = document.getElementById("budget-wheel-svg");
  if (!svg) return;

  svg.innerHTML = "";
  if (container) container.innerHTML = "";

  const expenseMap = {};
  state.transactions.forEach(t => {
    if (t.type === 'expense') {
      expenseMap[t.category] = (expenseMap[t.category] || 0) + t.amount;
    }
  });

  const categoriesToShow = state.categories.filter(c => c.id !== 'salary');
  
  let totalCategoryBudget = 0;
  categoriesToShow.forEach(cat => {
    totalCategoryBudget += state.categoryLimits[cat.id] || 0;
  });
  if (totalCategoryBudget === 0) {
    renderEmptyBudgetWheel(svg);
    return;
  }

  const angles = [0];
  let currentAngle = 0;
  categoriesToShow.forEach(cat => {
    const limit = state.categoryLimits[cat.id] || 0;
    const sliceAngle = (limit / totalCategoryBudget) * 360;
    currentAngle += sliceAngle;
    angles.push(currentAngle);
  });
  angles[angles.length - 1] = 360;

  // Render donut slices
  categoriesToShow.forEach((cat, idx) => {
    const startAngle = angles[idx] + (state.startAngleOffset || 0);
    const endAngle = angles[idx + 1] + (state.startAngleOffset || 0);
    const spent = expenseMap[cat.id] || 0;
    const limit = state.categoryLimits[cat.id] || 0;
    const colors = getHexColorsForCategory(cat);
    
    // Background slice (budget limit track)
    const bgPath = getDonutSlicePath(340, 200, 65, 95, startAngle, endAngle);
    const bgElement = document.createElementNS("http://www.w3.org/2000/svg", "path");
    bgElement.setAttribute("d", bgPath);
    bgElement.setAttribute("fill", colors.bg);
    bgElement.setAttribute("class", "transition-all duration-300 ease-out cursor-pointer hover:opacity-95");
    bgElement.setAttribute("data-category", cat.id);
    
    // Hover event listeners on slices
    bgElement.addEventListener("mouseenter", () => {
      if (isDraggingBudgetWheel) return;
      const catName = state.language === 'vi' ? cat.nameVi : cat.nameEn;
      const hoverValue = `${formatCurrency(spent)} / ${formatCurrency(limit)}`;
      const colorClass = spent > limit ? 'text-brand-coral font-bold' : 'text-primary';
      setCenterInfo(catName, hoverValue, colorClass);
      
      document.querySelectorAll("#budget-wheel-svg path").forEach(p => {
        if (p.getAttribute("data-category") === cat.id) {
          p.setAttribute("opacity", "1");
        } else if (p.tagName === "path") {
          p.setAttribute("opacity", "0.6");
        }
      });
    });
    
    bgElement.addEventListener("mouseleave", () => {
      if (isDraggingBudgetWheel) return;
      let totalExpense = 0;
      state.transactions.forEach(t => {
        if (t.type === 'expense') totalExpense += t.amount;
      });
      const remainingBudget = state.budgetLimit - totalExpense;
      setCenterInfo(
        state.language === 'vi' ? 'Còn lại' : 'Remaining',
        formatCurrency(remainingBudget),
        remainingBudget < 0 ? 'text-brand-coral' : 'text-primary'
      );
      
      document.querySelectorAll("#budget-wheel-svg path").forEach(p => {
        p.setAttribute("opacity", "1");
      });
    });

    svg.appendChild(bgElement);

    // Progress slice (spent amount)
    if (spent > 0) {
      const progressRatio = Math.min(1, spent / Math.max(1, limit));
      const progressEndAngle = startAngle + (endAngle - startAngle) * progressRatio;
      const progressColor = spent > limit ? brandColors.coral.saturated : colors.progress;
      
      const spentPath = getDonutSlicePath(340, 200, 71, 89, startAngle, progressEndAngle);
      const spentElement = document.createElementNS("http://www.w3.org/2000/svg", "path");
      spentElement.setAttribute("d", spentPath);
      spentElement.setAttribute("fill", progressColor);
      spentElement.setAttribute("class", "cursor-pointer pointer-events-none");
      spentElement.setAttribute("data-category", cat.id);
      svg.appendChild(spentElement);
    }
  });

  // Render dividers and handles in edit mode
  if (state.isEditingBudgetWheel) {
    const startAngleOffset = state.startAngleOffset || 0;
    for (let idx = 0; idx < angles.length - 1; idx++) {
      const angle = angles[idx] + startAngleOffset;
      const rad = (angle - 90) * Math.PI / 180;
      
      const lineStart = { x: 340 + 65 * Math.cos(rad), y: 200 + 65 * Math.sin(rad) };
      const lineEnd = { x: 340 + 95 * Math.cos(rad), y: 200 + 95 * Math.sin(rad) };
      
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", lineStart.x);
      line.setAttribute("y1", lineStart.y);
      line.setAttribute("x2", lineEnd.x);
      line.setAttribute("y2", lineEnd.y);
      line.setAttribute("stroke", "#ffffff");
      line.setAttribute("stroke-width", "3");
      line.setAttribute("stroke-linecap", "round");
      line.setAttribute("class", "pointer-events-none");
      svg.appendChild(line);

      const knobPos = { x: 340 + 95 * Math.cos(rad), y: 200 + 95 * Math.sin(rad) };
      const knobGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
      knobGroup.setAttribute("class", "cursor-grab active:cursor-grabbing");
      
      const knobBg = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      knobBg.setAttribute("cx", knobPos.x);
      knobBg.setAttribute("cy", knobPos.y);
      knobBg.setAttribute("r", "10");
      knobBg.setAttribute("fill", "#ffffff");
      knobBg.setAttribute("stroke", "#4b626a");
      knobBg.setAttribute("stroke-width", "3");
      knobBg.setAttribute("class", "transition-all duration-150 hover:r-12 hover:fill-primary-fixed");
      
      const knobDot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      knobDot.setAttribute("cx", knobPos.x);
      knobDot.setAttribute("cy", knobPos.y);
      knobDot.setAttribute("r", "3");
      knobDot.setAttribute("fill", "#4b626a");
      knobDot.setAttribute("class", "pointer-events-none");

      knobGroup.appendChild(knobBg);
      knobGroup.appendChild(knobDot);

      const startDrag = (e) => {
        isDraggingBudgetWheel = true;
        draggedBudgetWheelHandleIndex = idx;
        document.body.style.userSelect = "none";
        knobBg.setAttribute("fill", "#cee7f0");
        knobBg.setAttribute("r", "12");
        e.preventDefault();
      };
      knobGroup.addEventListener("mousedown", startDrag);
      knobGroup.addEventListener("touchstart", startDrag, { passive: false });

      svg.appendChild(knobGroup);
    }
  }

  // Render pointer lines and labels around the wheel
  categoriesToShow.forEach((cat, idx) => {
    const startAngle = angles[idx] + (state.startAngleOffset || 0);
    const endAngle = angles[idx + 1] + (state.startAngleOffset || 0);
    const midAngle = startAngle + (endAngle - startAngle) / 2;
    const rad = (midAngle - 90) * Math.PI / 180;

    const spent = expenseMap[cat.id] || 0;
    const limit = state.categoryLimits[cat.id] || 0;
    const percent = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
    const name = state.language === 'vi' ? cat.nameVi : cat.nameEn;
    const colors = getHexColorsForCategory(cat);

    // Anchor points for pointer line starting at outer edge of wheel (radius 95)
    const xStart = 340 + 95 * Math.cos(rad);
    const yStart = 200 + 95 * Math.sin(rad);

    // Elbow point: further out (radius 135)
    const xElbow = 340 + 135 * Math.cos(rad);
    const yElbow = 200 + 135 * Math.sin(rad);

    const normalAngle = (midAngle % 360 + 360) % 360;
    const isRight = (normalAngle < 180);

    // End of horizontal line (connects exactly to outer border of icon circle which has radius 13)
    const horizLength = 15;
    const xEnd = xElbow + (isRight ? horizLength : -horizLength);

    // Create pointer path (elbow connector)
    const pointer = document.createElementNS("http://www.w3.org/2000/svg", "path");
    pointer.setAttribute("d", `M ${xStart} ${yStart} L ${xElbow} ${yElbow} L ${xEnd} ${yElbow}`);
    pointer.setAttribute("fill", "none");
    pointer.setAttribute("stroke", "currentColor");
    pointer.setAttribute("class", "text-outline-variant/30 dark:text-outline-variant/20");
    pointer.setAttribute("stroke-width", "1.5");
    svg.appendChild(pointer);

    // Create Group for Label Content (Icon, Name, Amount)
    const labelGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    labelGroup.setAttribute("class", "cursor-pointer select-none opacity-90 hover:opacity-100 transition-opacity duration-200");
    labelGroup.addEventListener("click", () => openCategoryModal(cat.id));

    // Hover event listeners on labels
    labelGroup.addEventListener("mouseenter", () => {
      if (isDraggingBudgetWheel) return;
      const hoverValue = `${formatCurrency(spent)} / ${formatCurrency(limit)}`;
      const colorClass = spent > limit ? 'text-brand-coral font-bold' : 'text-primary';
      setCenterInfo(name, hoverValue, colorClass);
      
      document.querySelectorAll("#budget-wheel-svg path").forEach(p => {
        if (p.getAttribute("data-category") === cat.id) {
          p.setAttribute("opacity", "1");
        } else if (p.tagName === "path") {
          p.setAttribute("opacity", "0.6");
        }
      });
    });
    
    labelGroup.addEventListener("mouseleave", () => {
      if (isDraggingBudgetWheel) return;
      let totalExpense = 0;
      state.transactions.forEach(t => {
        if (t.type === 'expense') totalExpense += t.amount;
      });
      const remainingBudget = state.budgetLimit - totalExpense;
      setCenterInfo(
        state.language === 'vi' ? 'Còn lại' : 'Remaining',
        formatCurrency(remainingBudget),
        remainingBudget < 0 ? 'text-brand-coral' : 'text-primary'
      );
      
      document.querySelectorAll("#budget-wheel-svg path").forEach(p => {
        p.setAttribute("opacity", "1");
      });
    });

    // Icon Circle Background
    const xIcon = xEnd + (isRight ? 13 : -13);
    const yIcon = yElbow;
    const iconCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    iconCircle.setAttribute("cx", xIcon);
    iconCircle.setAttribute("cy", yIcon);
    iconCircle.setAttribute("r", "13");
    iconCircle.setAttribute("fill", colors.bg);
    labelGroup.appendChild(iconCircle);

    // Icon Character Text
    const iconText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    iconText.setAttribute("x", xIcon);
    iconText.setAttribute("y", yIcon);
    iconText.setAttribute("text-anchor", "middle");
    iconText.setAttribute("dominant-baseline", "central");
    iconText.setAttribute("fill", colors.progress);
    iconText.setAttribute("class", "material-symbols-outlined text-[15px] font-normal");
    iconText.textContent = cat.icon;
    labelGroup.appendChild(iconText);

    // Category Name Text with inline Edit Pencil Icon using tspans
    const xText = xIcon + (isRight ? 18 : -18);
    const nameText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    nameText.setAttribute("x", xText);
    nameText.setAttribute("y", yElbow - 5);
    nameText.setAttribute("text-anchor", isRight ? "start" : "end");
    nameText.setAttribute("class", "fill-on-surface font-bold text-sm");
    nameText.setAttribute("fill", "currentColor");

    if (isRight) {
      const nameSpan = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
      nameSpan.textContent = name;
      nameText.appendChild(nameSpan);

      const editSpan = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
      editSpan.setAttribute("class", "material-symbols-outlined text-[10px] fill-primary/40 text-primary-fixed-dim/40");
      editSpan.setAttribute("dx", "5");
      editSpan.textContent = "edit";
      nameText.appendChild(editSpan);
    } else {
      const editSpan = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
      editSpan.setAttribute("class", "material-symbols-outlined text-[10px] fill-primary/40 text-primary-fixed-dim/40");
      editSpan.textContent = "edit";
      nameText.appendChild(editSpan);

      const nameSpan = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
      nameSpan.setAttribute("dx", "5");
      nameSpan.textContent = name;
      nameText.appendChild(nameSpan);
    }
    labelGroup.appendChild(nameText);

    // Category Budget Limit Value Text
    const valueText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    valueText.setAttribute("x", xText);
    valueText.setAttribute("y", yElbow + 12);
    valueText.setAttribute("text-anchor", isRight ? "start" : "end");
    valueText.setAttribute("class", "fill-on-surface-variant font-medium text-xs");
    valueText.setAttribute("fill", "currentColor");
    valueText.textContent = `${formatCompactCurrency(spent)} / ${formatCompactCurrency(limit)} (${percent}%)`;
    labelGroup.appendChild(valueText);

    svg.appendChild(labelGroup);
  });

  // Render center overlay inside SVG for perfect responsive scaling
  const centerGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
  centerGroup.setAttribute("id", "budget-wheel-center-info");
  centerGroup.setAttribute("class", "pointer-events-none");

  // Center circle background (radius 60 fits inside 65 inner radius)
  const centerBg = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  centerBg.setAttribute("cx", "340");
  centerBg.setAttribute("cy", "200");
  centerBg.setAttribute("r", "60");
  centerBg.setAttribute("fill", "#ffffff");
  centerBg.setAttribute("class", "dark:fill-zinc-900 stroke-outline-variant/10");
  centerBg.setAttribute("stroke-width", "1");
  centerBg.setAttribute("style", "filter: drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.08));");
  centerGroup.appendChild(centerBg);

  // Center label text
  const labelText = document.createElementNS("http://www.w3.org/2000/svg", "text");
  labelText.setAttribute("id", "budget-wheel-center-label");
  labelText.setAttribute("x", "340");
  labelText.setAttribute("y", "190");
  labelText.setAttribute("text-anchor", "middle");
  labelText.setAttribute("dominant-baseline", "central");
  labelText.setAttribute("class", "text-on-surface-variant font-bold text-[9px] uppercase tracking-wider");
  labelText.setAttribute("fill", "currentColor");
  centerGroup.appendChild(labelText);

  // Center value text
  const valueTextEl = document.createElementNS("http://www.w3.org/2000/svg", "text");
  valueTextEl.setAttribute("id", "budget-wheel-center-value");
  valueTextEl.setAttribute("x", "340");
  valueTextEl.setAttribute("y", "212");
  valueTextEl.setAttribute("text-anchor", "middle");
  valueTextEl.setAttribute("dominant-baseline", "central");
  valueTextEl.setAttribute("class", "font-bold text-xs md:text-sm");
  valueTextEl.setAttribute("fill", "currentColor");
  centerGroup.appendChild(valueTextEl);

  svg.appendChild(centerGroup);

  // Render default center text
  let totalExpense = 0;
  state.transactions.forEach(t => {
    if (t.type === 'expense') totalExpense += t.amount;
  });
  const remainingBudget = state.budgetLimit - totalExpense;
  setCenterInfo(
    state.language === 'vi' ? 'Còn lại' : 'Remaining',
    formatCurrency(remainingBudget),
    remainingBudget < 0 ? 'text-brand-coral' : 'text-primary'
  );
}

// --- Virtual Voice Recognition Simulator ---
const voiceBtn = document.getElementById('voiceBtn');
const voiceStatus = document.getElementById('voiceStatus');
const voicePulse = document.getElementById('voicePulse');
let isListening = false;

if (voiceBtn) {
  voiceBtn.addEventListener('click', () => {
    isListening = !isListening;
    if (isListening) {
      voiceStatus.innerText = state.language === 'vi' ? "Đang nghe..." : "Listening...";
      voiceStatus.classList.add('text-secondary');
      voicePulse.classList.remove('hidden');
      voicePulse.classList.add('voice-active');
      voiceBtn.classList.add('scale-110');

      // Mimic AI Speech Recognition Completion after 2.5s
      setTimeout(() => {
        if (!isListening) return; // if user cancelled early

        // Voice command selections
        const commands = [
          {
            text: "Ăn sáng 35 ngàn đồng",
            note: "Ăn sáng",
            amount: 35000,
            category: "dining",
            type: "expense"
          },
          {
            text: "Mua quần áo 500 ngàn",
            note: "Mua quần áo",
            amount: 500000,
            category: "shopping",
            type: "expense"
          },
          {
            text: "Được nhận lương 10 triệu đồng",
            note: "Lương tháng",
            amount: 10000000,
            category: "salary",
            type: "income"
          },
          {
            text: "Nạp xăng xe máy 50 ngàn",
            note: "Nạp xăng xe máy",
            amount: 50000,
            category: "transport",
            type: "expense"
          }
        ];

        const match = commands[Math.floor(Math.random() * commands.length)];

        // Populate inputs
        const val = state.currency === 'usd' ? match.amount / USD_RATE : match.amount;
        document.getElementById("quick-amount").value = Math.round(val);
        document.getElementById("quick-note").value = match.note;
        document.getElementById("quick-category").value = match.category;
        setTransactionType(match.type);

        // Notify user
        alert(state.language === 'vi'
          ? `🎙️ Nhận diện thành công:\n"${match.text}"\n-> Đã tự động nhập vào biểu mẫu!`
          : `🎙️ Recognized successfully:\n"${match.text}"\n-> Pre-filled into the form!`
        );

        // Reset voice states
        isListening = false;
        voiceStatus.innerText = state.language === 'vi' ? "Nhập bằng giọng nói" : "Voice Input";
        voiceStatus.classList.remove('text-secondary');
        voicePulse.classList.add('hidden');
        voicePulse.classList.remove('voice-active');
        voiceBtn.classList.remove('scale-110');
      }, 2500);

    } else {
      voiceStatus.innerText = state.language === 'vi' ? "Nhập bằng giọng nói" : "Voice Input";
      voiceStatus.classList.remove('text-secondary');
      voicePulse.classList.add('hidden');
      voicePulse.classList.remove('voice-active');
      voiceBtn.classList.remove('scale-110');
    }
  });
}

// --- Dynamic Translator Engine ---
function applyTranslations() {
  const lang = state.language;
  const dict = i18n[lang];

  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (dict[key]) {
      el.innerText = dict[key];
    }
  });

  // Update placeholders
  const emailInput = document.getElementById("login-email");
  if (emailInput) {
    emailInput.placeholder = lang === 'vi' ? "example@email.com" : "example@email.com";
  }
  const noteInput = document.getElementById("quick-note");
  if (noteInput) {
    noteInput.placeholder = lang === 'vi' ? "Tên khoản chi..." : "Expense name...";
  }
  const searchInput = document.getElementById("filter-search");
  if (searchInput) {
    searchInput.placeholder = lang === 'vi' ? "Tìm kiếm ghi chú..." : "Search notes...";
  }
}

// Simple toast notification display
function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-primary text-on-primary py-2 px-6 rounded-full font-bold shadow-lg text-sm transition-all duration-300 opacity-0 transform translate-y-2";
  toast.innerText = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.remove("opacity-0", "translate-y-2");
    toast.classList.add("opacity-100", "translate-y-0");
  }, 50);

  setTimeout(() => {
    toast.classList.remove("opacity-100", "translate-y-0");
    toast.classList.add("opacity-0", "translate-y-2");
    setTimeout(() => document.body.removeChild(toast), 300);
  }, 2500);
}
