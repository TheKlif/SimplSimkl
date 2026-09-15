const TAB_IDS = ["nextup", "watching", "plantowatch", "completed"];

function activateTab(tabId) {
  for (const id of TAB_IDS) {
    document.getElementById(`tabpanel-${id}`).hidden = id !== tabId;
  }
  for (const btn of document.querySelectorAll(".tab-btn")) {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  for (const btn of document.querySelectorAll(".tab-btn")) {
    btn.addEventListener("click", () => activateTab(btn.dataset.tab));
  }
});