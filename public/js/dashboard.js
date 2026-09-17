// ============================================================
// Tap2Review — Customer Dashboard JS
// Extracted from server.js /dashboard route inline script
// ============================================================

let editingCardId = null;

document.addEventListener("click", function (e) {
  const editBtn = e.target.closest(".edit-card-btn");
  if (editBtn) {
    editingCardId = editBtn.dataset.cardId;
    document.getElementById("editCardIdLabel").textContent = editingCardId;
    document.getElementById("editBusinessName").value = editBtn.dataset.businessName || "";
    document.getElementById("editDestinationUrl").value = editBtn.dataset.destination || "";
    document.getElementById("editCardModal").style.display = "flex";
  }
});

function closeEditModal() {
  document.getElementById("editCardModal").style.display = "none";
  editingCardId = null;
}

async function saveCardEdit() {
  const businessName = document.getElementById("editBusinessName").value.trim();
  const destinationUrl = document.getElementById("editDestinationUrl").value.trim();
  if (!businessName || !destinationUrl) { alert("Both fields are required."); return; }
  const res = await fetch(
    "/dashboard/api/card/" + encodeURIComponent(editingCardId) + "/details",
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessName, destinationUrl }) }
  );
  if (!res.ok) { alert("Invalid destination URL."); return; }
  location.reload();
}

async function applyToAll(e) {
  e.preventDefault();
  const f = new FormData(e.target);
  const res = await fetch("/dashboard/api/apply-to-all", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(Object.fromEntries(f))
  });
  if (!res.ok) { alert("Invalid destination URL."); return; }
  location.reload();
}

async function toggleCardStatus(cardId, status) {
  await fetch("/dashboard/api/card/" + cardId + "/status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status })
  });
  location.reload();
}
