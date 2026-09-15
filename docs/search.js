let searchResultsCache = [];

function truncateOverview(text, maxLen = 200) {
  if (!text) return "(no overview available)";
  const clean = String(text).replace(/<br\s*\/?>/gi, " ");
  return clean.length > maxLen ? `${clean.slice(0, maxLen).trim()}…` : clean;
}

async function runSearch(query) {
  const resultsEl = document.getElementById("search-results");
  resultsEl.innerHTML = "Searching…";

  const [movieResults, tvResults] = await Promise.all([
    simklGet(`/search/movie?extended=full&q=${encodeURIComponent(query)}`),
    simklGet(`/search/tv?extended=full&q=${encodeURIComponent(query)}`)
  ]);

  searchResultsCache = [
    ...(movieResults || []).map(item => ({ ...item, _type: "movies" })),
    ...(tvResults || []).map(item => ({ ...item, _type: "shows" }))
  ];

  renderSearchResults();
}

function renderSearchResults() {
  const resultsEl = document.getElementById("search-results");
  resultsEl.innerHTML = "";

  if (searchResultsCache.length === 0) {
    resultsEl.textContent = "No results.";
    return;
  }

  for (const item of searchResultsCache) {
    const li = document.createElement("li");
    li.className = "search-result-item";

    const img = document.createElement("img");
    img.src = posterUrl(item.poster);
    img.alt = item.title;
    img.className = "search-result-banner";
    li.appendChild(img);

    const textCol = document.createElement("div");
    textCol.className = "search-result-text";

    const title = document.createElement("span");
    title.className = "search-result-title";
    title.textContent = item.year ? `${item.title} (${item.year})` : item.title;
    textCol.appendChild(title);

    const overview = document.createElement("p");
    overview.className = "search-result-overview";
    overview.textContent = truncateOverview(item.overview);
    textCol.appendChild(overview);

    const btnGroup = document.createElement("div");
    btnGroup.className = "status-btn-group";
    for (const s of STATUSES) {
      const btn = document.createElement("button");
      btn.className = "status-btn";
      btn.textContent = s;
      btn.addEventListener("click", async () => {
        await changeStatus(item._type, item.ids, s);
        const confirmMsg = document.createElement("span");
        confirmMsg.className = "search-result-confirm";
        confirmMsg.textContent = `Added to ${s}.`;
        btnGroup.appendChild(confirmMsg);
      });
      btnGroup.appendChild(btn);
    }
    textCol.appendChild(btnGroup);

    li.appendChild(textCol);
    resultsEl.appendChild(li);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("search-form");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const query = document.getElementById("search-input").value.trim();
    if (query) runSearch(query);
  });
});