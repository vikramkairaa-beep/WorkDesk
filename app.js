const STORAGE_KEY = "novaWorkDeskTasksV2Fresh";
const $ = (id) => document.getElementById(id);
const today = new Date();
const localDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};
const prettyDate = (value) => {
  if (!value) return "";
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};
let tasks = loadTasks();

function loadTasks() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch (error) {
    console.warn("Could not read saved tasks", error);
  }
  return []; // Start fresh: no sample tasks.

}
function saveTasks() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); }
  catch (error) { alert("Browser storage is unavailable. Your changes may not stay after closing this page."); }
}
function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}
function taskCard(task) {
  return `<article class="task-card">
    <div><p class="task-title">${escapeHtml(task.name)}</p><div class="task-meta">${escapeHtml(task.category)} · ${prettyDate(task.dateFrom || task.date)}${(task.dateTo || task.dateFrom || task.date) !== (task.dateFrom || task.date) ? ` to ${prettyDate(task.dateTo)}` : ""}${task.notes ? `<br>${escapeHtml(task.notes)}` : ""}</div></div>
    <div class="task-right">
      <select class="status-select" aria-label="Status for ${escapeHtml(task.name)}" data-status-id="${task.id}">
        ${["In Progress", "Completed", "Pending"].map(s => `<option ${task.status === s ? "selected" : ""}>${s}</option>`).join("")}
      </select>
      <button class="delete-btn" data-delete-id="${task.id}" aria-label="Delete ${escapeHtml(task.name)}">Delete</button>
    </div>
  </article>`;
}
function renderTasks() {
  const total = tasks.length;
  const done = tasks.filter(t => t.status === "Completed").length;
  const progress = tasks.filter(t => t.status === "In Progress").length;
  const rate = total ? Math.round(done / total * 100) : 0;
  $("totalCount").textContent = total;
  $("doneCount").textContent = done;
  $("progressCount").textContent = progress;
  $("completionRate").textContent = `${rate}%`;
  $("completionBar").style.width = `${rate}%`;

  const recent = [...tasks].slice(-4).reverse();
  $("dashboardTasks").innerHTML = recent.length ? recent.map(taskCard).join("") : `<div class="empty-state">No tasks yet. Add your first office task.</div>`;
  const query = $("taskSearch").value.trim().toLowerCase();
  const status = $("statusFilter").value;
  const filtered = [...tasks].reverse().filter(t => (status === "All" || t.status === status) && `${t.name} ${t.category} ${t.notes}`.toLowerCase().includes(query));
  $("allTasks").innerHTML = filtered.length ? filtered.map(taskCard).join("") : `<div class="empty-state">No matching tasks found.</div>`;
  bindTaskActions();
}
function bindTaskActions() {
  document.querySelectorAll("[data-status-id]").forEach(select => {
    select.onchange = () => {
      const task = tasks.find(t => t.id === select.dataset.statusId);
      if (task) { task.status = select.value; saveTasks(); renderTasks(); }
    };
  });
  document.querySelectorAll("[data-delete-id]").forEach(button => {
    button.onclick = () => {
      const task = tasks.find(t => t.id === button.dataset.deleteId);
      if (task && confirm(`Delete "${task.name}"?`)) {
        tasks = tasks.filter(t => t.id !== task.id);
        saveTasks(); renderTasks();
      }
    };
  });
}
function showView(viewName) {
  document.querySelectorAll(".view").forEach(view => view.classList.remove("active"));
  $(`${viewName}View`).classList.add("active");
  document.querySelectorAll(".nav-item").forEach(btn => btn.classList.toggle("active", btn.dataset.view === viewName));
  $("pageTitle").textContent = ({ dashboard: "Dashboard", tasks: "Office Tasks", report: "EOD Report" })[viewName];
  if (viewName === "report") generateReport();
}
document.querySelectorAll(".nav-item").forEach(button => button.addEventListener("click", () => showView(button.dataset.view)));
$("goTasks").onclick = () => showView("tasks");
$("viewAllTasks").onclick = () => showView("tasks");
$("taskForm").addEventListener("submit", event => {
  event.preventDefault();
  const name = $("taskName").value.trim();
  if (!name) return;
  tasks.push({
    id: crypto.randomUUID(),
    name,
    category: $("taskCategory").value,
    status: $("taskStatus").value,
    notes: $("taskNotes").value.trim(),
    dateFrom: $("taskDateFrom").value || localDate(new Date()),
    dateTo: $("taskDateTo").value || $("taskDateFrom").value || localDate(new Date())
  });
  const addedTask = tasks[tasks.length - 1];
  if (addedTask.dateFrom > addedTask.dateTo) {
    tasks.pop();
    alert("Task To Date must be on or after Task From Date.");
    return;
  }
  saveTasks();
  $("taskForm").reset();
  renderTasks();
  $("taskName").focus();
});
$("taskSearch").addEventListener("input", renderTasks);
$("statusFilter").addEventListener("change", renderTasks);

function generateReport() {
  const from = $("reportFrom").value || localDate(new Date());
  const to = $("reportTo").value || from;
  const project = $("projectName").value.trim() || "Project";
  const preparedBy = $("preparedBy").value.trim() || "Team Member";
  if (from > to) {
    $("reportOutput").textContent = "Please select a valid date range: From date must be on or before To date.";
    $("copyFeedback").textContent = "";
    return;
  }
  const reportTasks = tasks.filter(t => {
    const taskFrom = t.dateFrom || t.date || "";
    const taskTo = t.dateTo || t.dateFrom || t.date || "";
    return taskFrom <= to && taskTo >= from;
  }).sort((a, b) => (a.dateFrom || a.date || "").localeCompare(b.dateFrom || b.date || ""));
  const rangeText = from === to ? prettyDate(from) : `${prettyDate(from)} to ${prettyDate(to)}`;
  const lines = [
    `DATE: ${rangeText}`,
    "",
    `PROJECT: ${project}`,
    "",
    "KEY ACTIVITIES",
    ""
  ];
  if (!reportTasks.length) {
    lines.push("No tasks recorded for this date range.");
  } else {
    const categories = [...new Set(reportTasks.map(t => t.category))];
    categories.forEach(category => {
      const grouped = reportTasks.filter(t => t.category === category);
      lines.push(category.toUpperCase());
      grouped.forEach(t => {
        const taskFrom = t.dateFrom || t.date || from;
        const taskTo = t.dateTo || t.dateFrom || t.date || taskFrom;
        lines.push(`Date: ${prettyDate(taskFrom)}${taskTo !== taskFrom ? ` to ${prettyDate(taskTo)}` : ""}`);
        if (t.notes) lines.push(`• ${t.notes}`);
        lines.push(`Status: ${t.status}.`);
      });
      lines.push("");
    });
  }
  const extra = $("extraNotes").value.trim();
  if (extra) lines.push("ADDITIONAL NOTES", extra, "");
  lines.push(`Report Prepared by: ${preparedBy}`);
  $("reportOutput").textContent = lines.join("\n");
  $("copyFeedback").textContent = "";
}
$("generateReport").onclick = generateReport;
["reportFrom", "reportTo", "projectName", "preparedBy", "extraNotes"].forEach(id => $(id).addEventListener("input", generateReport));
$("copyReport").onclick = async () => {
  const text = $("reportOutput").textContent;
  try {
    await navigator.clipboard.writeText(text);
    $("copyFeedback").textContent = "Report copied. Paste it into your work chat or document.";
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand("copy");
    area.remove();
    $("copyFeedback").textContent = copied ? "Report copied." : "Copy failed. Select the report text and copy it manually.";
  }
};
$("todayPill").textContent = today.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" });
$("reportFrom").value = localDate(today);
$("reportTo").value = localDate(today);
$("taskDateFrom").value = localDate(today);
$("taskDateTo").value = localDate(today);
$("taskDateFrom").addEventListener("change", () => { if ($("taskDateTo").value < $("taskDateFrom").value) $("taskDateTo").value = $("taskDateFrom").value; });
renderTasks();
