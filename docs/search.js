let searchResultsCache = [];
let searchCorrectionNote = null;

// TMDB was assumed to have real typo tolerance; live testing showed that's
// mostly false — its search API behaves close to exact/prefix matching and
// often finds nothing for a genuinely misspelled query (e.g. "mairo",
// "brakeing bad" both came back empty). It's kept only as a best-effort
// fallback for when Simkl's own search (zero typo tolerance) finds nothing
// at all — see the fallback logic in runSearch below, not here. This
// function itself just asks TMDB and returns whatever it finds, or the
// original query unchanged if TMDB has nothing or the request fails.
async function correctQueryViaTmdb(query) {
  try {
    const res = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error(`TMDB search failed: ${res.status}`);
    const data = await res.json();
    const top = (data.results || []).find(r => r.media_type === "movie" || r.media_type === "tv");
    if (!top) return query;
    return top.title || top.name || query;
  } catch (e) {
    console.error("TMDB fuzzy-correction failed, using raw query instead:", e);
    return query;
  }
}

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

function normalizedIds(item) {
  // Search results use ids.simkl_id; every other endpoint in this app
  // (detail fetch, sync/add-to-list) expects ids.simkl.
  if (item.ids && item.ids.simkl_id && !item.ids.simkl) {
    return { ...item.ids, simkl: item.ids.simkl_id };
  }
  return item.ids;
}

async function fetchOverview(item) {
  // Search results key the Simkl ID as ids.simkl_id, not ids.simkl like every
  // other endpoint in this app. Confirmed from a live response.
  const simklId = item.ids && (item.ids.simkl_id || item.ids.simkl);
  if (!simklId) {
    console.warn("Search result has no simkl id, cannot fetch overview:", item);
    return null;
  }
  try {
    const singularType = item._type === "shows" ? "tv" : "movies";
    const detail = await simklGet(`/${singularType}/${simklId}?extended=full`);
    return detail.overview || null;
  } catch (e) {
    console.error(`Overview fetch failed for "${item.title}":`, e);
    return null;
  }
}

async function runSearch(query) {
  const resultsEl = document.getElementById("search-results");
  resultsEl.innerHTML = "Searching…";
  searchCorrectionNote = null;

  let [movieResults, tvResults] = await Promise.all([
    simklGet(`/search/movie?extended=full&q=${encodeURIComponent(query)}`),
    simklGet(`/search/tv?extended=full&q=${encodeURIComponent(query)}`)
  ]);

  // Simkl's own search has zero typo tolerance, but always routing every
  // query through TMDB first — even a query that already gets good direct
  // hits — was collapsing broad results down to TMDB's single top match
  // (e.g. "mario" narrowed to one specific title). Only try TMDB as a
  // fallback when the direct search comes back completely empty, so a
  // valid broad query keeps its full breadth.
  if ((movieResults || []).length === 0 && (tvResults || []).length === 0) {
    const correctedQuery = await correctQueryViaTmdb(query);
    if (correctedQuery.toLowerCase() !== query.toLowerCase()) {
      [movieResults, tvResults] = await Promise.all([
        simklGet(`/search/movie?extended=full&q=${encodeURIComponent(correctedQuery)}`),
        simklGet(`/search/tv?extended=full&q=${encodeURIComponent(correctedQuery)}`)
      ]);
      searchCorrectionNote = correctedQuery;
    }
  }

  console.log("Raw movie search result sample:", movieResults && movieResults[0]);
  console.log("Raw tv search result sample:", tvResults && tvResults[0]);

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

  if (searchCorrectionNote) {
    const note = document.createElement("li");
    note.className = "search-correction-note";
    note.textContent = `Showing results for "${searchCorrectionNote}"`;
    resultsEl.appendChild(note);
  }

  if (searchResultsCache.length === 0) {
    const empty = document.createElement("li");
    empty.textContent = "No results.";
    resultsEl.appendChild(empty);
    return;
  }

  for (const item of searchResultsCache) {
    const li = document.createElement("li");
    li.className = "search-result-item";

    const img = document.createElement("img");
    img.src = posterUrl(item.poster);
    img.alt = item.title;
    img.className = "search-result-banner";
    img.addEventListener("click", () => showItemDetail(item._type, normalizedIds(item), null));
    li.appendChild(img);

    const textCol = document.createElement("div");
    textCol.className = "search-result-text";

    const titleRow = document.createElement("span");
    titleRow.className = "search-result-title-row";

    const title = document.createElement("span");
    title.className = "search-result-title";
    title.textContent = item.year ? `${item.title} (${item.year})` : item.title;
    title.addEventListener("click", () => showItemDetail(item._type, normalizedIds(item), null));
    titleRow.appendChild(title);

    const badge = document.createElement("span");
    badge.className = "type-badge";
    badge.textContent = TYPE_LABELS[item._type] || item._type;
    titleRow.appendChild(badge);

    textCol.appendChild(titleRow);

    const overview = document.createElement("p");
    overview.className = "search-result-overview";
    overview.textContent = firstSentence(item.overview) || "(no overview available)";
    textCol.appendChild(overview);

    const btnGroup = document.createElement("div");
    btnGroup.className = "status-btn-group";
    for (const s of statusesFor(item._type)) {
      const btn = document.createElement("button");
      btn.className = "status-btn";
      btn.textContent = s;
      btn.addEventListener("click", async () => {
        await changeStatus(item._type, normalizedIds(item), s);
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

const form = document.getElementById("search-form");
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const query = document.getElementById("search-input").value.trim();
  if (query) runSearch(query);
});

ready(() => {
  const form = document.getElementById("search-form");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const query = document.getElementById("search-input").value.trim();
    if (query) runSearch(query);
  });
});