// ============================================================
// Tap2Review � Admin Panel JS
// Extracted from server.js /admin route inline script
// ============================================================

async function confirmPayment(orderId) {
  if (!confirm("Confirm payment received for order " + orderId + "? This will create the customer account, business, and cards immediately.")) return;
  const res = await fetch("/admin/api/order/" + encodeURIComponent(orderId) + "/confirm-payment", { method: "POST" });
  if (!res.ok) { const err = await res.json().catch(() => ({})); alert(err.error || "Could not confirm payment."); return; }
  alert("Payment confirmed � cards generated and customer account is now active.");
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
  if (!res.ok) { alert("Invalid URL � please enter a valid http/https link."); return; }
  location.reload();
}

function copyRedirectUrl(url) {
  navigator.clipboard.writeText(url).then(() => alert("Redirect URL copied!"));
}

function jumpToCard() {
  const sel = document.getElementById("cardJumpSelect");
  if (sel.value) window.location.href = "/card/" + sel.value;
}



async function adminResetPassword(customerId, email) {
  const newPassword = prompt("Set a new password for " + email + " (min 6 characters):");
  if (!newPassword) return;
  if (newPassword.length < 6) { alert("Password must be at least 6 characters."); return; }
  const res = await fetch("/admin/api/customer/" + encodeURIComponent(customerId) + "/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ newPassword }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { alert(data.error || "Could not reset password."); return; }
  alert("Password reset successfully for " + data.email + ". They can now log in with the new password.");
}

// ============================================================
// Review Suggestions (Admin Controls)
// ============================================================
const DEFAULT_REVIEW_PROMPTS = [
  'Amazing service and wonderful experience! Highly recommend to everyone.',
  'Great experience, friendly hospitality, and will definitely visit again.',
  'Very polite, helpful, and professional staff. Truly impressed with the service!',
  'Top-notch quality and prompt attention. Exceeded all my expectations!',
  'Loved everything about this place — fantastic vibe and five-star service!',
  'Quick, hassle-free, and super reliable. Keep up the phenomenal work!',
  'One of the best experiences around. Truly worth every penny and five stars!',
  'Warm hospitality, great ambiance, and excellent attention to detail.',
  'Clean, welcoming atmosphere with a dedicated team that genuinely cares.',
  'Absolutely fantastic! Smooth experience from start to finish. Highly satisfied!',
];

async function toggleAdminSuggestions(cardId, enabled) {
  const res = await fetch("/admin/api/card/" + encodeURIComponent(cardId) + "/suggestions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    alert(err.error || "Could not update review suggestions.");
    return;
  }
  location.reload();
}

let adminPromptsCardId = null;

document.addEventListener("click", function (e) {
  const btn = e.target.closest(".edit-admin-prompts-btn");
  if (!btn) return;
  adminPromptsCardId = btn.dataset.cardId;
  const bizName = btn.dataset.businessName || "";
  const labelEl = document.getElementById("adminPromptsCardIdLabel");
  if (labelEl) {
    labelEl.textContent = adminPromptsCardId + (bizName ? " (" + bizName + ")" : "");
  }
  let prompts = [];
  try { prompts = JSON.parse(btn.dataset.prompts || "[]"); } catch (err) {}
  if (!prompts.length) prompts = DEFAULT_REVIEW_PROMPTS.slice();
  for (let i = 0; i < 10; i++) {
    const inp = document.getElementById("adminPrompt" + i);
    if (inp) inp.value = prompts[i] || "";
  }
  const modal = document.getElementById("adminPromptsModal");
  if (modal) modal.style.display = "flex";
});

function closeAdminPromptsModal() {
  const modal = document.getElementById("adminPromptsModal");
  if (modal) modal.style.display = "none";
  adminPromptsCardId = null;
}

function resetAdminPromptsToDefault() {
  for (let i = 0; i < 10; i++) {
    const inp = document.getElementById("adminPrompt" + i);
    if (inp) inp.value = DEFAULT_REVIEW_PROMPTS[i] || "";
  }
}

async function saveAdminPrompts() {
  if (!adminPromptsCardId) return;
  const prompts = [];
  for (let i = 0; i < 10; i++) {
    const inp = document.getElementById("adminPrompt" + i);
    if (inp && inp.value.trim()) {
      prompts.push(inp.value.trim());
    }
  }
  if (prompts.length < 1) {
    alert("Please provide at least 1 review suggestion.");
    return;
  }
  const res = await fetch("/admin/api/card/" + encodeURIComponent(adminPromptsCardId) + "/prompts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompts })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    alert(data.error || "Could not save review prompts.");
    return;
  }
  alert("Review suggestions saved successfully!");
  location.reload();
}

window.addEventListener("click", function(e) {
  const modal = document.getElementById("adminPromptsModal");
  if (modal && e.target === modal) {
    closeAdminPromptsModal();
  }
});


