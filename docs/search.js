let searchResultsCache = [];

function firstSentence(text, maxLen = 140) {
  if (!text) return null;
  const clean = String(text).replace(/<br\s*\/?>/gi, " ").trim();
  const match = clean.match(/^.*?[.!?](?=\s|$)/);
  let sentence = match ? match[0] : clean;
  if (sentence.length > maxLen) {
    sentence = `${sentence.slice(0, maxLen).trim()}…`;
  }
  return sentence;
}

async function fetchOverview(item) {
  // /search/{type} does not reliably return overview, even with extended=full.
  // Fall back to the per-item detail endpoint, the same call the item-detail
  // popup already uses successfully.
  try {
    const singularType = item._type === "shows" ? "tv" : "movies";
    const detail = await simklGet(`/${singularType}/${item.ids.simkl}?extended=full`);
    return detail.overview || null;
  } catch (e) {
    return null;
  }
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

  await Promise.all(searchResultsCache.map(async item => {
    if (!item.overview) item.overview = await fetchOverview(item);
  }));

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
    img.addEventListener("click", () => showItemDetail(item._type, item.ids, null));
    li.appendChild(img);

    const textCol = document.createElement("div");
    textCol.className = "search-result-text";

    const title = document.createElement("span");
    title.className = "search-result-title";
    title.textContent = item.year ? `${item.title} (${item.year})` : item.title;
    title.addEventListener("click", () => showItemDetail(item._type, item.ids, null));
    textCol.appendChild(title);

    const overview = document.createElement("p");
    overview.className = "search-result-overview";
    overview.textContent = firstSentence(item.overview) || "(no overview available)";
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