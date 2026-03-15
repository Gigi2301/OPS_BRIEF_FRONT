const requestIdInput = document.getElementById("requestId");
const generateBtn = document.getElementById("generateBtn");

const statusBadge = document.getElementById("statusBadge");
const priorityBadge = document.getElementById("priorityBadge");
const sourceBadge = document.getElementById("sourceBadge");

const heroTitle = document.getElementById("heroTitle");
const heroSubtitle = document.getElementById("heroSubtitle");

const summaryBox = document.getElementById("summaryBox");
const risksList = document.getElementById("risksList");
const actionsList = document.getElementById("actionsList");

const clientValue = document.getElementById("clientValue");
const routeValue = document.getElementById("routeValue");
const aircraftValue = document.getElementById("aircraftValue");
const alternateValue = document.getElementById("alternateValue");
const currentStatusValue = document.getElementById("currentStatusValue");
const updatedAtValue = document.getElementById("updatedAtValue");

const API_BASE = "https://api.pierluigicherchi.com";

function setBadge(element, value) {
  element.textContent = value || "--";
  element.className = "badge";

  const lower = String(value).toLowerCase();

  if (lower.includes("critical")) {
    element.classList.add("critical");
  } else if (lower.includes("high")) {
    element.classList.add("high");
  } else if (lower.includes("medium")) {
    element.classList.add("medium");
  } else if (lower.includes("low")) {
    element.classList.add("low");
  } else {
    element.classList.add("neutral");
  }
}

function resetLists() {
  risksList.className = "item-list empty";
  risksList.innerHTML = "<li>No risks loaded.</li>";

  actionsList.className = "item-list empty";
  actionsList.innerHTML = "<li>No actions loaded.</li>";
}

function resetDetails() {
  clientValue.textContent = "--";
  routeValue.textContent = "--";
  aircraftValue.textContent = "--";
  alternateValue.textContent = "--";
  currentStatusValue.textContent = "--";
  updatedAtValue.textContent = "--";
}

function renderList(target, items) {
  target.innerHTML = "";

  if (!items || items.length === 0) {
    target.className = "item-list empty";
    target.innerHTML = "<li>No items available.</li>";
    return;
  }

  target.className = "item-list";

  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;

    const lower = item.toLowerCase();

    if (lower.includes("[critical]")) li.classList.add("risk-critical");
    else if (lower.includes("[high]")) li.classList.add("risk-high");
    else if (lower.includes("[medium]")) li.classList.add("risk-medium");
    else if (lower.includes("[low]")) li.classList.add("risk-low");

    target.appendChild(li);
  });
}

function renderDetails(data) {
  clientValue.textContent = data.client || "--";
  routeValue.textContent = data.route || "--";
  aircraftValue.textContent = data.aircraft || "--";
  alternateValue.textContent = data.alternate || "--";
  currentStatusValue.textContent = data.current_status || "--";
  updatedAtValue.textContent = new Date().toLocaleString();
}

function renderBrief(data, requestId) {
  heroTitle.textContent = `Operational Brief • ${requestId}`;
  heroSubtitle.textContent = "Generated from current request data.";

  summaryBox.textContent = data.summary || "No summary available.";
  summaryBox.classList.remove("muted");

  setBadge(statusBadge, data.status || "unknown");
  setBadge(priorityBadge, data.priority || "--");
  setBadge(sourceBadge, data.source || "--");

  renderDetails(data);
  renderList(risksList, data.risks || []);
  renderList(actionsList, data.next_actions || []);
}

function renderError(message, requestId) {
  heroTitle.textContent = `Operational Brief • ${requestId}`;
  heroSubtitle.textContent = "Request could not be processed.";

  summaryBox.textContent = message || "Unknown error.";
  summaryBox.classList.remove("muted");

  setBadge(statusBadge, "error");
  setBadge(priorityBadge, "--");
  setBadge(sourceBadge, "--");

  resetDetails();
  resetLists();
}

function renderLoading(requestId) {
  heroTitle.textContent = `Operational Brief • ${requestId}`;
  heroSubtitle.textContent = "Fetching operational data...";

  summaryBox.textContent = "Loading brief...";
  summaryBox.classList.remove("muted");

  setBadge(statusBadge, "loading");
  setBadge(priorityBadge, "--");
  setBadge(sourceBadge, "--");

  clientValue.textContent = "Loading...";
  routeValue.textContent = "Loading...";
  aircraftValue.textContent = "Loading...";
  alternateValue.textContent = "Loading...";
  currentStatusValue.textContent = "Loading...";
  updatedAtValue.textContent = "Loading...";

  risksList.className = "item-list empty";
  risksList.innerHTML = "<li>Loading...</li>";

  actionsList.className = "item-list empty";
  actionsList.innerHTML = "<li>Loading...</li>";
}

async function fetchBrief(requestId) {
  const response = await fetch(`${API_BASE}/api/brief`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      request_id: requestId
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || `HTTP ${response.status}`);
  }

  return data;
}

async function handleGenerateBrief() {
  const requestId = requestIdInput.value.trim() || "REQ-2026-003";

  renderLoading(requestId);

  try {
    const data = await fetchBrief(requestId);

    if (data.status === "error") {
      renderError(data.message || "Unknown backend error.", requestId);
      return;
    }

    renderBrief(data, requestId);
  } catch (error) {
    renderError(error.message || "Backend not reachable.", requestId);
  }
}

generateBtn.addEventListener("click", handleGenerateBrief);

requestIdInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    handleGenerateBrief();
  }
});

summaryBox.textContent = "Enter a request ID and generate an operational brief.";
summaryBox.classList.add("muted");
resetDetails();
resetLists();
setBadge(statusBadge, "idle");
setBadge(priorityBadge, "--");
setBadge(sourceBadge, "--");
