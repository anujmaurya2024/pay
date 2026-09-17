// ============================================================
// Tap2Review — Scroll Reveal Animation
// Extracted from layout.js REVEAL_SCRIPT
// ============================================================
document.addEventListener("DOMContentLoaded", function () {
  var els = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    els.forEach(function (e) { e.classList.add("in"); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add("in");
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  els.forEach(function (e) { io.observe(e); });
});
