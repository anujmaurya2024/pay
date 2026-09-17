// ============================================================
// Tap2Review — Admin Panel JS
// Extracted from server.js /admin route inline script
// ============================================================

async function confirmPayment(orderId) {
  if (!confirm("Confirm payment received for order " + orderId + "? This will create the customer account, business, and cards immediately.")) return;
  const res = await fetch("/admin/api/order/" + encodeURIComponent(orderId) + "/confirm-payment", { method: "POST" });
  if (!res.ok) { const err = await res.json().catch(() => ({})); alert(err.error || "Could not confirm payment."); return; }
  alert("Payment confirmed — cards generated and customer account is now active.");
  location.reload();
}

async function createBusiness(e) {
  e.preventDefault();
  const f = new FormData(e.target);
  await fetch("/admin/api/business", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(f)) });
  location.reload();
}

async function createCard(e) {
  e.preventDefault();
  const f = new FormData(e.target);
  await fetch("/admin/api/card", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(f)) });
  location.reload();
}

async function updateProfile(e) {
  e.preventDefault();
  const f = new FormData(e.target);
  await fetch("/admin/api/business/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(f)) });
  location.reload();
}

async function toggleStatus(cardId, status) {
  await fetch("/admin/api/card/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cardId, status }) });
  location.reload();
}

async function setPrimary(cardId) {
  await fetch("/admin/api/card/primary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cardId }) });
  location.reload();
}

async function updateCardDestination(e) {
  e.preventDefault();
  const f = new FormData(e.target);
  const res = await fetch("/admin/api/card/destination", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(f)) });
  if (!res.ok) { alert("Invalid URL — please enter a valid http/https link."); return; }
  location.reload();
}

function copyRedirectUrl(url) {
  navigator.clipboard.writeText(url).then(() => alert("Redirect URL copied!"));
}

function jumpToCard() {
  const sel = document.getElementById("cardJumpSelect");
  if (sel.value) window.location.href = "/card/" + sel.value;
}

async function toggleAdminSuggestions(cardId, enabled) {
  const res = await fetch("/admin/api/card/" + encodeURIComponent(cardId) + "/suggestions", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled })
  });
  if (!res.ok) { const err = await res.json().catch(() => ({})); alert(err.error || "Could not update."); return; }
  location.reload();
}

let adminPromptsCardId = null;

document.addEventListener("click", function (e) {
  const btn = e.target.closest(".edit-admin-prompts-btn");
  if (!btn) return;
  adminPromptsCardId = btn.dataset.cardId;
  document.getElementById("adminPromptsCardIdLabel").textContent = adminPromptsCardId;
  let prompts = [];
  try { prompts = JSON.parse(btn.dataset.prompts || "[]"); } catch (err) {}
  for (let i = 0; i < 5; i++) {
    document.getElementById("adminPrompt" + i).value = prompts[i] || "";
  }
  document.getElementById("adminPromptsModal").style.display = "flex";
});

function closeAdminPromptsModal() {
  document.getElementById("adminPromptsModal").style.display = "none";
  adminPromptsCardId = null;
}

async function saveAdminPrompts() {
  const prompts = [];
  for (let i = 0; i < 5; i++) {
    prompts.push(document.getElementById("adminPrompt" + i).value.trim());
  }
  if (prompts.some(p => !p)) { alert("All 5 prompts are required."); return; }
  const res = await fetch("/admin/api/card/" + encodeURIComponent(adminPromptsCardId) + "/prompts", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompts })
  });
  if (!res.ok) { const err = await res.json().catch(() => ({})); alert(err.error || "Could not save prompts."); return; }
  location.reload();
}
