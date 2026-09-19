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

