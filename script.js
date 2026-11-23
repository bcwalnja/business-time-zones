const storageKey = "time-zone-businesses";
const defaultSheetUrl = "https://docs.google.com/spreadsheets/d/1L6n0XqlJyazhemrM69Z-_ovEINMa_fmQL0w1d5fzK4s/edit?usp=sharing";
let businesses = JSON.parse(localStorage.getItem(storageKey) || "[]");
let sheetBusinesses = [];
const zones = ["Pacific", "Mountain", "Central", "Eastern"];
const form = document.querySelector("#add-business");
const formToggle = document.querySelector("#toggle-form");
const sheetForm = document.querySelector("#sheet-form");
const sheetToggle = document.querySelector("#toggle-sheet");
const sheetUrlInput = document.querySelector("#sheet-url");
const sheetStatus = document.querySelector("#sheet-status");
const nameInput = document.querySelector("#business-name");
const zoneInput = document.querySelector("#business-zone");
const map = document.querySelector("#map");

function closeFlyouts() {
  form.hidden = true;
  sheetForm.hidden = true;
  formToggle.textContent = "+";
  formToggle.setAttribute("aria-expanded", "false");
  formToggle.setAttribute("aria-label", "Show add business form");
  sheetToggle.textContent = "▤";
  sheetToggle.setAttribute("aria-expanded", "false");
  sheetToggle.setAttribute("aria-label", "Connect a Google Sheet");
}

function render() {
  document.querySelectorAll(".column").forEach(column => {
    column.querySelector("ul").replaceChildren();
    column.classList.remove("small", "smaller", "tiny");
  });

  [...businesses.map((business, index) => ({ ...business, index })), ...sheetBusinesses].forEach(business => {
    const list = document.querySelector(`[data-zone="${business.zone}"]`);
    if (!list) return;
    const item = document.createElement("li");
    const name = business.index === undefined ? document.createElement("span") : document.createElement("button");
    name.textContent = business.index === undefined
      ? business.name.replace(/\s+\([^)]*$/, "").trim()
      : business.name;
    if (business.index === undefined) {
      name.className = "sheet-business";
    } else {
      name.type = "button";
      name.setAttribute("aria-label", `Remove ${business.name}`);
      name.dataset.index = business.index;
    }
    item.append(name);
    list.append(item);
    const column = list.closest(".column");
    if (list.children.length > 18) column.classList.add("tiny");
    else if (list.children.length > 12) column.classList.add("smaller");
    else if (list.children.length > 6) column.classList.add("small");
  });
}

formToggle.addEventListener("click", () => {
  const open = form.hidden;
  closeFlyouts();
  if (open) {
    form.hidden = false;
    formToggle.textContent = "×";
    formToggle.setAttribute("aria-expanded", "true");
    formToggle.setAttribute("aria-label", "Hide add business form");
  }
  if (open) nameInput.focus();
});

sheetToggle.addEventListener("click", () => {
  const open = sheetForm.hidden;
  closeFlyouts();
  if (open) {
    sheetForm.hidden = false;
    sheetToggle.textContent = "×";
    sheetToggle.setAttribute("aria-expanded", "true");
    sheetToggle.setAttribute("aria-label", "Hide Google Sheet form");
    sheetUrlInput.focus();
  }
});

document.addEventListener("click", event => {
  if (event.target.closest(".tools, #add-business, #sheet-form")) return;
  closeFlyouts();
});

form.addEventListener("submit", event => {
  event.preventDefault();
  const name = nameInput.value.trim();
  if (!name) return;
  businesses.push({ name, zone: zoneInput.value });
  localStorage.setItem(storageKey, JSON.stringify(businesses));
  nameInput.value = "";
  render();
});

map.addEventListener("click", event => {
  const button = event.target.closest("button[data-index]");
  if (!button) return;
  businesses.splice(Number(button.dataset.index), 1);
  localStorage.setItem(storageKey, JSON.stringify(businesses));
  render();
});

async function loadSheet(url) {
  sheetBusinesses = [];
  render();
  sheetToggle.classList.remove("connected", "error");
  if (!url) {
    sheetStatus.textContent = "";
    return;
  }

  sheetStatus.textContent = "Loading…";
  try {
    const sheetId = url.match(/\/d\/([\w-]+)/)?.[1];
    if (!sheetId) throw new Error("The link is not a Google Sheets URL.");
    const response = await fetch(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?headers=1`);
    if (!response.ok) throw new Error(`Google Sheets returned ${response.status}.`);
    const text = await response.text();
    const result = JSON.parse(text.slice(text.indexOf("(") + 1, text.lastIndexOf(")")));
    if (!Array.isArray(result.table?.rows)) throw new Error("The sheet response has no rows.");
    sheetBusinesses = result.table.rows.map(row => ({
      name: String(row.c?.[0]?.v ?? "").trim().replace(/\s+\([^)]*$/, ""),
      zone: String(row.c?.[1]?.v ?? "").trim()
    })).filter(business => business.name && zones.includes(business.zone));
    sheetToggle.classList.add("connected");
    sheetStatus.textContent = `Loaded ${sheetBusinesses.length} businesses.`;
    render();
  } catch (error) {
    console.error("Could not load Google Sheet:", error);
    sheetToggle.classList.add("error");
    sheetStatus.textContent = "Couldn't load the sheet. Check its link, sharing, and columns A (name) / B (zone).";
  }
}

sheetForm.addEventListener("submit", event => {
  event.preventDefault();
  const url = sheetUrlInput.value.trim();
  localStorage.setItem("sheetUrl", url);
  loadSheet(url);
});

document.querySelector("#disconnect-sheet").addEventListener("click", () => {
  localStorage.setItem("sheetUrl", "");
  sheetUrlInput.value = "";
  sheetBusinesses = [];
  sheetStatus.textContent = "Google Sheet disconnected.";
  render();
});

sheetUrlInput.value = localStorage.getItem("sheetUrl") ?? defaultSheetUrl;
render();
loadSheet(sheetUrlInput.value);