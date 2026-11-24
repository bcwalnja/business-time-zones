const storageKey = "time-zone-businesses";
const sheetStorageKey = "business-time-zones-sheet-url";
const zones = ["Pacific", "Mountain", "Central", "Eastern"];
const timeZones = {
    Pacific: "America/Los_Angeles",
    Mountain: "America/Denver",
    Central: "America/Chicago",
    Eastern: "America/New_York"
};

function readBusinesses() {
    try {
        const stored = JSON.parse(localStorage.getItem(storageKey) || "[]");
        return Array.isArray(stored) ? stored.filter(business =>
            business && typeof business.name === "string" && typeof business.zone === "string" && zones.includes(business.zone)
        ) : [];
    } catch {
        localStorage.removeItem(storageKey);
        return [];
    }
}

let businesses = readBusinesses();
let sheetBusinesses = [];
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
        const list = document.querySelector(`ul[data-zone="${business.zone}"]`);
        if (!list) return;
        const item = document.createElement("li");
        if (business.index === undefined) {
            const name = document.createElement("span");
            name.className = "sheet-business";
            name.textContent = business.name.replace(/\s+\([^)]*$/, "").trim();
            item.append(name);
        } else {
            const removeButton = document.createElement("button");
            removeButton.type = "button";
            removeButton.className = "remove-business";
            removeButton.setAttribute("aria-label", `Remove ${business.name}`);
            removeButton.title = `Remove ${business.name}`;
            removeButton.dataset.index = business.index;
            const name = document.createElement("span");
            name.textContent = business.name;
            const icon = document.createElement("span");
            icon.className = "remove-icon";
            icon.setAttribute("aria-hidden", "true");
            icon.textContent = "×";
            removeButton.append(name, icon);
            item.append(removeButton);
        }
        list.append(item);
        const column = list.closest(".column");
        if (list.children.length > 18) column.classList.add("tiny");
        else if (list.children.length > 12) column.classList.add("smaller");
        else if (list.children.length > 6) column.classList.add("small");
    });
}

function updateClocks() {
    document.querySelectorAll(".zone-clock").forEach(clock => {
        const formatter = new Intl.DateTimeFormat("en-US", {
            timeZone: timeZones[clock.dataset.zone],
            hour: "numeric",
            minute: "2-digit",
            hourCycle: "h12"
        });
        const parts = formatter.formatToParts(new Date());
        clock.firstElementChild.textContent = `${parts.find(part => part.type === "hour").value}:${parts.find(part => part.type === "minute").value}`;
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
    sheetForm.removeAttribute("aria-busy");
    if (!url) {
        sheetStatus.textContent = "";
        return;
    }

    sheetStatus.textContent = "Loading…";
    sheetForm.setAttribute("aria-busy", "true");
    try {
        const sheetId = url.match(/\/d\/([\w-]+)/)?.[1];
        if (!sheetId) throw new Error("The link is not a Google Sheets URL.");
        const response = await fetch(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?headers=1`);
        if (!response.ok) throw new Error(`Google Sheets returned ${response.status}.`);
        const text = await response.text();
        const result = JSON.parse(text.slice(text.indexOf("(") + 1, text.lastIndexOf(")")));
        if (!Array.isArray(result.table?.rows)) throw new Error("The sheet response has no rows.");
        sheetBusinesses = result.table.rows.map(row => {
            const name = String(row.c?.[0]?.v ?? "").trim().replace(/\s+\([^)]*$/, "");
            const zone = String(row.c?.[1]?.v ?? "").trim();
            const normalizedZone = zones.find(value => value.toLowerCase() === zone.toLowerCase());
            return { name, zone: normalizedZone };
        }).filter(business => business.name && business.zone);
        sheetToggle.classList.add("connected");
        sheetStatus.textContent = `Loaded ${sheetBusinesses.length} businesses.`;
        localStorage.setItem(sheetStorageKey, url);
        sheetForm.removeAttribute("aria-busy");
        render();
    } catch (error) {
        console.error("Could not load Google Sheet:", error);
        sheetToggle.classList.add("error");
        sheetStatus.textContent = "Couldn't load the sheet. Check its link, sharing, and columns A (name) / B (zone).";
        sheetForm.removeAttribute("aria-busy");
    }
}

sheetForm.addEventListener("submit", event => {
    event.preventDefault();
    loadSheet(sheetUrlInput.value.trim());
});

document.querySelector("#disconnect-sheet").addEventListener("click", () => {
    localStorage.setItem(sheetStorageKey, "");
    sheetUrlInput.value = "";
    sheetBusinesses = [];
    sheetToggle.classList.remove("connected", "error");
    sheetForm.removeAttribute("aria-busy");
    sheetStatus.textContent = "Google Sheet disconnected.";
    render();
});

sheetUrlInput.value = localStorage.getItem(sheetStorageKey) ?? "";
render();
updateClocks();
setInterval(updateClocks, 15_000);
loadSheet(sheetUrlInput.value);