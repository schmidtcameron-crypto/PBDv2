(() => {
  "use strict";

  const STORAGE_KEY = "personal-budget-dashboard-v1";
  const WEEKLY_TO_MONTHLY = 52 / 12;
  const VALID_TYPES = ["essential", "variable", "debt", "savings", "discretionary", "other"];
  const TYPE_LABELS = {
    essential: "Essential",
    variable: "Variable",
    debt: "Debt",
    savings: "Savings",
    discretionary: "Fun",
    other: "Other"
  };

  const DEFAULT_BUCKETS = [
    { id: "rent", name: "Rent", budgeted: 0, actual: 0, type: "essential", custom: false },
    { id: "electric", name: "Electric", budgeted: 0, actual: 0, type: "variable", custom: false },
    { id: "internet", name: "Internet", budgeted: 0, actual: 0, type: "essential", custom: false },
    { id: "phone", name: "Phone", budgeted: 0, actual: 0, type: "essential", custom: false },
    { id: "subscriptions", name: "Subscriptions", budgeted: 0, actual: 0, type: "discretionary", custom: false },
    { id: "car-insurance", name: "Car Insurance", budgeted: 0, actual: 0, type: "essential", custom: false },
    { id: "gas", name: "Gas", budgeted: 0, actual: 0, type: "variable", custom: false },
    { id: "groceries", name: "Groceries", budgeted: 0, actual: 0, type: "variable", custom: false },
    { id: "truck-payment", name: "Truck Payment", budgeted: 0, actual: 0, type: "debt", custom: false },
    { id: "student-loan", name: "Student Loan", budgeted: 0, actual: 0, type: "debt", custom: false },
    { id: "snap-on-loan", name: "Snap-on Loan", budgeted: 0, actual: 0, type: "debt", custom: false },
    { id: "other-debt", name: "Other Debt", budgeted: 0, actual: 0, type: "debt", custom: false },
    { id: "fun-money", name: "Fun Money", budgeted: 0, actual: 0, type: "discretionary", custom: false },
    { id: "emergency-savings", name: "Emergency Savings", budgeted: 0, actual: 0, type: "savings", custom: false },
    { id: "house-down-payment-savings", name: "House Down Payment Savings", budgeted: 0, actual: 0, type: "savings", custom: false }
  ];

  const DEFAULT_BUCKET_IDS = new Set(DEFAULT_BUCKETS.map((bucket) => bucket.id));

  let state = createDefaultState();
  let toastTimer = 0;

  const elements = {};

  document.addEventListener("DOMContentLoaded", () => {
    cacheElements();
    state = loadState();
    renderIncomeFields();
    renderBuckets();
    wireEvents();
    updateDerivedViews();
  });

  function cacheElements() {
    elements.saveStatus = document.getElementById("saveStatus");
    elements.toast = document.getElementById("toast");
    elements.monthlyIncome = document.getElementById("monthlyIncome");
    elements.weeklyIncome = document.getElementById("weeklyIncome");
    elements.extraIncome = document.getElementById("extraIncome");
    elements.totalIncome = document.getElementById("totalIncome");
    elements.summaryIncome = document.getElementById("summaryIncome");
    elements.summaryBudgeted = document.getElementById("summaryBudgeted");
    elements.summaryActual = document.getElementById("summaryActual");
    elements.summaryRemaining = document.getElementById("summaryRemaining");
    elements.summaryOver = document.getElementById("summaryOver");
    elements.summaryDebt = document.getElementById("summaryDebt");
    elements.summarySavings = document.getElementById("summarySavings");
    elements.moneyRemainingCard = document.getElementById("moneyRemainingCard");
    elements.overBudgetCard = document.getElementById("overBudgetCard");
    elements.bucketCount = document.getElementById("bucketCount");
    elements.bucketList = document.getElementById("bucketList");
    elements.addBucket = document.getElementById("addBucket");
    elements.exportData = document.getElementById("exportData");
    elements.copyData = document.getElementById("copyData");
    elements.resetDefaults = document.getElementById("resetDefaults");
    elements.importJson = document.getElementById("importJson");
    elements.importData = document.getElementById("importData");
    elements.clearImport = document.getElementById("clearImport");
  }

  function wireEvents() {
    elements.monthlyIncome.addEventListener("input", () => updateIncome("monthly", elements.monthlyIncome.value));
    elements.weeklyIncome.addEventListener("input", () => updateIncome("weekly", elements.weeklyIncome.value));
    elements.extraIncome.addEventListener("input", () => updateIncome("extra", elements.extraIncome.value));

    elements.bucketList.addEventListener("input", handleBucketFieldChange);
    elements.bucketList.addEventListener("change", handleBucketFieldChange);
    elements.bucketList.addEventListener("click", handleBucketClick);

    elements.addBucket.addEventListener("click", addBucket);
    elements.exportData.addEventListener("click", exportData);
    elements.copyData.addEventListener("click", copyData);
    elements.resetDefaults.addEventListener("click", resetDefaults);
    elements.importData.addEventListener("click", importData);
    elements.clearImport.addEventListener("click", () => {
      elements.importJson.value = "";
      showToast("Import box cleared");
    });
  }

  function updateIncome(field, value) {
    state.income[field] = moneyValue(value);
    persist();
    updateDerivedViews();
  }

  function handleBucketFieldChange(event) {
    const field = event.target.dataset.field;
    if (!field) {
      return;
    }

    const card = event.target.closest(".bucket-card");
    if (!card) {
      return;
    }

    const bucket = state.buckets.find((item) => item.id === card.dataset.id);
    if (!bucket) {
      return;
    }

    if (field === "name") {
      bucket.name = event.target.value;
    } else if (field === "type") {
      bucket.type = VALID_TYPES.includes(event.target.value) ? event.target.value : "other";
      const chip = card.querySelector("[data-role='typeChip']");
      if (chip) {
        chip.textContent = TYPE_LABELS[bucket.type];
      }
    } else if (field === "budgeted" || field === "actual") {
      bucket[field] = moneyValue(event.target.value);
    }

    persist();
    updateDerivedViews();
  }

  function handleBucketClick(event) {
    const deleteButton = event.target.closest("[data-action='delete']");
    if (!deleteButton) {
      return;
    }

    const card = deleteButton.closest(".bucket-card");
    const bucket = state.buckets.find((item) => item.id === card.dataset.id);

    if (!bucket || !bucket.custom) {
      return;
    }

    const name = bucket.name.trim() || "this bucket";
    if (!window.confirm(`Delete ${name}?`)) {
      return;
    }

    state.buckets = state.buckets.filter((item) => item.id !== bucket.id);
    persist("Custom bucket deleted");
    renderBuckets();
    updateDerivedViews();
  }

  function addBucket() {
    const bucket = {
      id: makeId(),
      name: "New Bucket",
      budgeted: 0,
      actual: 0,
      type: "other",
      custom: true
    };

    state.buckets.push(bucket);
    persist("Bucket added");
    renderBuckets();
    updateDerivedViews();

    const newCard = elements.bucketList.querySelector(`[data-id="${bucket.id}"]`);
    const nameInput = newCard ? newCard.querySelector("[data-field='name']") : null;
    if (nameInput) {
      nameInput.focus();
      nameInput.select();
    }
  }

  function resetDefaults() {
    if (!window.confirm("Reset income and buckets to defaults?")) {
      return;
    }

    state = createDefaultState();
    persist("Defaults restored");
    renderIncomeFields();
    renderBuckets();
    updateDerivedViews();
  }

  function exportData() {
    const json = buildExportJson();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `budget-dashboard-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    copyText(json).then(
      () => showToast("Export downloaded and JSON copied"),
      () => showToast("Export downloaded")
    );
  }

  function copyData() {
    copyText(buildExportJson()).then(
      () => showToast("JSON copied"),
      () => showToast("Copy blocked by browser")
    );
  }

  function importData() {
    const text = elements.importJson.value.trim();
    if (!text) {
      showToast("Paste JSON before importing");
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      showToast("That JSON could not be read");
      return;
    }

    const imported = normalizeState(parsed.state || parsed);
    if (!imported.buckets.length) {
      showToast("No budget buckets found");
      return;
    }

    if (!window.confirm("Replace current budget with imported data?")) {
      return;
    }

    state = imported;
    persist("Budget imported");
    renderIncomeFields();
    renderBuckets();
    updateDerivedViews();
    elements.importJson.value = "";
  }

  function renderIncomeFields() {
    elements.monthlyIncome.value = inputNumber(state.income.monthly);
    elements.weeklyIncome.value = inputNumber(state.income.weekly);
    elements.extraIncome.value = inputNumber(state.income.extra);
  }

  function renderBuckets() {
    const fragment = document.createDocumentFragment();
    elements.bucketList.textContent = "";

    state.buckets.forEach((bucket) => {
      fragment.appendChild(createBucketCard(bucket));
    });

    elements.bucketList.appendChild(fragment);
  }

  function createBucketCard(bucket) {
    const card = document.createElement("article");
    card.className = "bucket-card";
    card.dataset.id = bucket.id;
    card.dataset.tone = "neutral";

    const header = document.createElement("div");
    header.className = "bucket-header";

    const dot = document.createElement("span");
    dot.className = "status-dot";
    dot.setAttribute("aria-hidden", "true");

    const nameLabel = document.createElement("label");
    nameLabel.className = "bucket-name-field";

    const hiddenName = document.createElement("span");
    hiddenName.className = "sr-only";
    hiddenName.textContent = "Bucket name";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = bucket.name;
    nameInput.dataset.field = "name";
    nameInput.setAttribute("aria-label", "Bucket name");

    nameLabel.append(hiddenName, nameInput);
    header.append(dot, nameLabel);

    const actions = document.createElement("div");
    actions.className = "bucket-actions";

    const typeChip = document.createElement("span");
    typeChip.className = "bucket-type";
    typeChip.dataset.role = "typeChip";
    typeChip.textContent = TYPE_LABELS[bucket.type] || TYPE_LABELS.other;
    actions.appendChild(typeChip);

    if (bucket.custom) {
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "button delete-button";
      deleteButton.dataset.action = "delete";
      deleteButton.textContent = "Delete";
      actions.appendChild(deleteButton);
    }

    const grid = document.createElement("div");
    grid.className = "bucket-grid";
    grid.append(
      createMoneyField("Budgeted amount", "budgeted", bucket.budgeted),
      createMoneyField("Actual/spent amount", "actual", bucket.actual),
      createTypeField(bucket.type)
    );

    const stats = document.createElement("div");
    stats.className = "bucket-stats";
    stats.append(
      createMiniStat("Remaining amount", "remaining", "remaining-value"),
      createMiniStat("Over/under status", "statusLabel", "status-value"),
      createMiniStat("Planned vs spent", "plannedSpent", "")
    );

    const track = document.createElement("div");
    track.className = "progress-track";
    track.setAttribute("aria-hidden", "true");

    const fill = document.createElement("span");
    fill.className = "progress-fill";
    fill.dataset.role = "progressFill";
    track.appendChild(fill);

    const message = document.createElement("p");
    message.className = "bucket-message";
    message.dataset.role = "statusText";

    card.append(header, actions, grid, stats, track, message);
    return card;
  }

  function createMoneyField(label, field, value) {
    const wrapper = document.createElement("label");
    wrapper.className = "money-field";

    const text = document.createElement("span");
    text.textContent = label;

    const inputWrap = document.createElement("span");
    inputWrap.className = "input-wrap";

    const dollar = document.createElement("span");
    dollar.setAttribute("aria-hidden", "true");
    dollar.textContent = "$";

    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.step = "0.01";
    input.inputMode = "decimal";
    input.placeholder = "0.00";
    input.value = inputNumber(value);
    input.dataset.field = field;

    inputWrap.append(dollar, input);
    wrapper.append(text, inputWrap);
    return wrapper;
  }

  function createTypeField(type) {
    const label = document.createElement("label");
    label.className = "select-field";

    const text = document.createElement("span");
    text.textContent = "Bucket type";

    const select = document.createElement("select");
    select.dataset.field = "type";

    VALID_TYPES.forEach((typeName) => {
      const option = document.createElement("option");
      option.value = typeName;
      option.textContent = TYPE_LABELS[typeName];
      option.selected = typeName === type;
      select.appendChild(option);
    });

    label.append(text, select);
    return label;
  }

  function createMiniStat(label, role, valueClass) {
    const stat = document.createElement("div");
    stat.className = "mini-stat";

    const text = document.createElement("span");
    text.textContent = label;

    const value = document.createElement("strong");
    value.dataset.role = role;
    if (valueClass) {
      value.className = valueClass;
    }
    value.textContent = "$0.00";

    stat.append(text, value);
    return stat;
  }

  function updateDerivedViews() {
    const totals = calculateTotals();

    setText(elements.totalIncome, formatMoney(totals.income));
    setText(elements.summaryIncome, formatMoney(totals.income));
    setText(elements.summaryBudgeted, formatMoney(totals.budgeted));
    setText(elements.summaryActual, formatMoney(totals.actual));
    setText(elements.summaryRemaining, formatMoney(totals.remaining));
    setText(elements.summaryOver, formatMoney(totals.over));
    setText(elements.summaryDebt, formatMoney(totals.debt));
    setText(elements.summarySavings, formatMoney(totals.savings));
    setText(elements.bucketCount, `${state.buckets.length} ${state.buckets.length === 1 ? "bucket" : "buckets"}`);

    setTone(elements.moneyRemainingCard, totals.remaining < 0 ? "danger" : "good");
    setTone(elements.overBudgetCard, totals.over > 0 ? "danger" : "good");

    const cards = elements.bucketList.querySelectorAll(".bucket-card");
    cards.forEach((card) => {
      const bucket = state.buckets.find((item) => item.id === card.dataset.id);
      if (!bucket) {
        return;
      }
      updateBucketCard(card, bucket);
    });
  }

  function updateBucketCard(card, bucket) {
    const status = getBucketStatus(bucket);
    card.dataset.tone = status.tone;

    setText(card.querySelector("[data-role='remaining']"), formatMoney(status.remaining));
    setText(card.querySelector("[data-role='statusLabel']"), status.label);
    setText(card.querySelector("[data-role='plannedSpent']"), `${formatMoney(bucket.actual)} / ${formatMoney(bucket.budgeted)}`);
    setText(card.querySelector("[data-role='statusText']"), status.message);

    const fill = card.querySelector("[data-role='progressFill']");
    if (fill) {
      fill.style.width = `${status.progress}%`;
    }
  }

  function calculateTotals() {
    const income = moneyValue(state.income.monthly) + (moneyValue(state.income.weekly) * WEEKLY_TO_MONTHLY) + moneyValue(state.income.extra);
    const totals = state.buckets.reduce((sum, bucket) => {
      const budgeted = moneyValue(bucket.budgeted);
      const actual = moneyValue(bucket.actual);
      sum.budgeted += budgeted;
      sum.actual += actual;
      sum.over += Math.max(actual - budgeted, 0);
      if (bucket.type === "debt") {
        sum.debt += budgeted;
      }
      if (bucket.type === "savings") {
        sum.savings += budgeted;
      }
      return sum;
    }, { budgeted: 0, actual: 0, over: 0, debt: 0, savings: 0 });

    return {
      income,
      budgeted: totals.budgeted,
      actual: totals.actual,
      remaining: income - totals.actual,
      over: totals.over,
      debt: totals.debt,
      savings: totals.savings
    };
  }

  function getBucketStatus(bucket) {
    const budgeted = moneyValue(bucket.budgeted);
    const actual = moneyValue(bucket.actual);
    const remaining = budgeted - actual;
    const ratio = budgeted > 0 ? actual / budgeted : actual > 0 ? 1 : 0;
    const progress = budgeted > 0 ? Math.min(ratio * 100, 100) : actual > 0 ? 100 : 0;

    if (actual > budgeted) {
      const overage = actual - budgeted;
      return {
        tone: "danger",
        label: "Over budget",
        message: `Over by ${formatMoney(overage)}`,
        remaining,
        progress
      };
    }

    if (budgeted === 0 && actual === 0) {
      return {
        tone: "neutral",
        label: "Ready",
        message: `${formatMoney(0)} remaining`,
        remaining,
        progress
      };
    }

    if (ratio >= 0.85) {
      return {
        tone: "warning",
        label: actual === budgeted ? "On budget" : "Close",
        message: `${formatMoney(remaining)} remaining`,
        remaining,
        progress
      };
    }

    return {
      tone: "good",
      label: "Under budget",
      message: `${formatMoney(remaining)} remaining`,
      remaining,
      progress
    };
  }

  function createDefaultState() {
    return {
      income: { monthly: 0, weekly: 0, extra: 0 },
      buckets: DEFAULT_BUCKETS.map((bucket) => ({ ...bucket }))
    };
  }

  function loadState() {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (!saved) {
        return createDefaultState();
      }
      return normalizeState(JSON.parse(saved));
    } catch (error) {
      showToast("Saved data could not be loaded");
      return createDefaultState();
    }
  }

  function normalizeState(raw) {
    const base = createDefaultState();
    const income = raw && raw.income ? raw.income : {};
    base.income = {
      monthly: moneyValue(income.monthly),
      weekly: moneyValue(income.weekly),
      extra: moneyValue(income.extra)
    };

    const incomingBuckets = Array.isArray(raw && raw.buckets) ? raw.buckets : [];
    const incomingById = new Map();
    incomingBuckets.forEach((bucket) => {
      const normalized = normalizeBucket(bucket);
      if (normalized) {
        incomingById.set(normalized.id, normalized);
      }
    });

    const mergedDefaults = DEFAULT_BUCKETS.map((defaultBucket) => {
      const incoming = incomingById.get(defaultBucket.id);
      if (!incoming) {
        return { ...defaultBucket };
      }
      return {
        ...defaultBucket,
        ...incoming,
        custom: false
      };
    });

    const customBuckets = incomingBuckets
      .map((bucket) => normalizeBucket(bucket))
      .filter((bucket) => bucket && !DEFAULT_BUCKET_IDS.has(bucket.id))
      .map((bucket) => ({ ...bucket, custom: true }));

    base.buckets = [...mergedDefaults, ...customBuckets];
    return base;
  }

  function normalizeBucket(bucket) {
    if (!bucket || typeof bucket !== "object") {
      return null;
    }

    const id = typeof bucket.id === "string" && bucket.id.trim() ? bucket.id.trim() : makeId();
    const type = VALID_TYPES.includes(bucket.type) ? bucket.type : "other";

    return {
      id,
      name: typeof bucket.name === "string" && bucket.name.trim() ? bucket.name : "Untitled Bucket",
      budgeted: moneyValue(bucket.budgeted),
      actual: moneyValue(bucket.actual),
      type,
      custom: Boolean(bucket.custom)
    };
  }

  function persist(toastMessage) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      const time = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      elements.saveStatus.textContent = `Saved ${time}`;
      if (toastMessage) {
        showToast(toastMessage);
      }
    } catch (error) {
      elements.saveStatus.textContent = "Storage unavailable";
      showToast("Browser storage is unavailable");
    }
  }

  function buildExportJson() {
    return JSON.stringify({
      app: "Personal Budget Dashboard",
      version: 1,
      exportedAt: new Date().toISOString(),
      state
    }, null, 2);
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }

    return new Promise((resolve, reject) => {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.setAttribute("readonly", "");
      textArea.style.position = "fixed";
      textArea.style.top = "-1000px";
      document.body.appendChild(textArea);
      textArea.select();

      try {
        const successful = document.execCommand("copy");
        textArea.remove();
        successful ? resolve() : reject(new Error("Copy failed"));
      } catch (error) {
        textArea.remove();
        reject(error);
      }
    });
  }

  function showToast(message) {
    if (!elements.toast) {
      return;
    }

    window.clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add("show");
    toastTimer = window.setTimeout(() => {
      elements.toast.classList.remove("show");
    }, 2400);
  }

  function setText(element, text) {
    if (element) {
      element.textContent = text;
    }
  }

  function setTone(element, tone) {
    if (element) {
      element.dataset.tone = tone;
    }
  }

  function moneyValue(value) {
    const number = Number.parseFloat(String(value ?? "").replace(/,/g, ""));
    return Number.isFinite(number) && number > 0 ? number : 0;
  }

  function inputNumber(value) {
    const number = moneyValue(value);
    return number === 0 ? "" : String(Number(number.toFixed(2)));
  }

  function formatMoney(value) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }

  function makeId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return `custom-${window.crypto.randomUUID()}`;
    }
    return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
})();
