// ============================================================
// Tap2Review - Customer Dashboard JS
// Multi-platform links (Google Review, Instagram, WhatsApp, Website)
// ============================================================

let editingCardId = null;

document.addEventListener(click, function (e) {
  const editBtn = e.target.closest(.edit-card-btn);
  if (editBtn) {
    editingCardId = editBtn.dataset.cardId;
    const label = document.getElementById(editCardIdLabel);
    if (label) label.textContent = editingCardId;

    const bName = document.getElementById(editBusinessName);
    if (bName) bName.value = editBtn.dataset.businessName || ";

 const gUrl = document.getElementById(editGoogleReviewUrl);
 if (gUrl) gUrl.value = editBtn.dataset.googleReviewUrl || editBtn.dataset.destination || ;

 const igUrl = document.getElementById(editInstagramUrl);
 if (igUrl) igUrl.value = editBtn.dataset.instagramUrl || ;

 const waNum = document.getElementById(editWhatsappNumber);
 if (waNum) waNum.value = editBtn.dataset.whatsappNumber || ;

 const webUrl = document.getElementById(editWebsiteUrl);
 if (webUrl) webUrl.value = editBtn.dataset.websiteUrl || ;

 const modal = document.getElementById(editCardModal);
 if (modal) modal.style.display = flex;
 }
});

function closeEditModal() {
 const modal = document.getElementById(editCardModal);
 if (modal) modal.style.display = none;
 editingCardId = null;
}

async function saveCardEdit() {
 const businessName = (document.getElementById(editBusinessName)?.value || ).trim();
 const googleReviewUrl = (document.getElementById(editGoogleReviewUrl)?.value || ).trim();
 const instagramUrl = (document.getElementById(editInstagramUrl)?.value || ).trim();
 const whatsappNumber = (document.getElementById(editWhatsappNumber)?.value || ).trim();
 const websiteUrl = (document.getElementById(editWebsiteUrl)?.value || ).trim();

 if (!businessName) {
 alert(Business Name is required.);
 return;
 }

 try {
 const res = await fetch(
 /dashboard/api/card/ + encodeURIComponent(editingCardId) + /details,
 {
 method: POST,
 headers: { Content-Type: application/json },
 body: JSON.stringify({
 businessName,
 googleReviewUrl,
 instagramUrl,
 whatsappNumber,
 websiteUrl,
 destinationUrl: googleReviewUrl || websiteUrl || instagramUrl || (whatsappNumber ? (https://wa.me/ + whatsappNumber.replace(/[^0-9]/g, )) : )
 })
 }
 );

 if (!res.ok) {
 const err = await res.json().catch(() => ({}));
 alert(err.error || Failed to update card details. Please check your URLs.);
 return;
 }
 location.reload();
 } catch (err) {
 alert(Network error:  + err.message);
 }
}

async function applyToAll(e) {
 e.preventDefault();
 const f = new FormData(e.target);
 const data = Object.fromEntries(f);

 try {
 const res = await fetch(/dashboard/api/apply-to-all, {
 method: POST,
 headers: { Content-Type: application/json },
 body: JSON.stringify(data)
 });

 if (!res.ok) {
 const err = await res.json().catch(() => ({}));
 alert(err.error || Failed to apply to all cards. Please check your inputs.);
 return;
 }
 location.reload();
 } catch (err) {
 alert(Network error:  + err.message);
 }
}

async function toggleCardStatus(cardId, status) {
 try {
 await fetch(/dashboard/api/card/ + encodeURIComponent(cardId) + /status, {
 method: POST,
 headers: { Content-Type: application/json },
 body: JSON.stringify({ status })
 });
 location.reload();
 } catch (err) {
 alert(Network error:  + err.message);
 }
}

window.addEventListener(click, function (e) {
 const modal = document.getElementById(editCardModal);
 if (modal && e.target === modal) {
 closeEditModal();
 }
});
