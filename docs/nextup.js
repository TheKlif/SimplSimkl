function posterUrl(path) {
  if (!path) return "https://wsrv.nl/?url=https://simkl.in/poster_no_pic_c.png";
  return `https://wsrv.nl/?url=https://simkl.in/posters/${path}_m.webp&q=90`;
}

let nextUpCache = [];

async function loadNextUp() {
  const watchingData = await simklGet("/sync/all-items/shows/watching");
  const watchingShows = watchingData.shows || [];
  nextUpCache = watchingShows.filter(entry => entry.next_to_watch);
  renderNextUp();
}

async function renderNextUp() {
  const ul = document.getElementById("list-nextup");
  const sortSelect = document.getElementById("sort-nextup");

  if (EPISODES_REMAINING_KEYS.includes(sortSelect.value)) {
    ul.innerHTML = "Loading episode counts…";
    await ensureEpisodesRemaining(nextUpCache);
  }

  ul.innerHTML = "";
  const sorted = applySort(nextUpCache, sortSelect.value);

  for (const entry of sorted) {
    const show = entry.show;
    const li = document.createElement("li");
    li.className = "nextup-item";

    const img = document.createElement("img");
    img.src = posterUrl(show.poster);
    img.alt = show.title;
    img.className = "nextup-banner";
    img.addEventListener("click", () => showItemDetail("shows", show.ids, "watching", entry.next_to_watch));

    const textCol = document.createElement("div");
    textCol.className = "nextup-text";

    const title = document.createElement("span");
    title.className = "nextup-title";
    title.textContent = show.title;
    title.addEventListener("click", () => showItemDetail("shows", show.ids, "watching", entry.next_to_watch));

    const episode = document.createElement("span");
    episode.className = "nextup-episode";
    episode.textContent = entry.next_to_watch;
    episode.addEventListener("click", () => showEpisodeDetail(show, entry.next_to_watch));

    const markBtn = document.createElement("button");
    markBtn.className = "mark-watched-btn";
    markBtn.textContent = "Mark watched";
    markBtn.addEventListener("click", () => markEpisodeWatched(show, entry.next_to_watch));

    textCol.appendChild(title);
    textCol.appendChild(episode);
    textCol.appendChild(markBtn);

    li.appendChild(img);
    li.appendChild(textCol);
    ul.appendChild(li);
  }
}

async function markEpisodeWatched(show, seasonEpisodeStr) {
  const match = seasonEpisodeStr.match(/S(\d+)E(\d+)/);
  const season = parseInt(match[1], 10);
  const episode = parseInt(match[2], 10);

  await simklPost("/sync/history", {
    shows: [{
      ids: show.ids,
      seasons: [{ number: season, episodes: [{ number: episode }] }]
    }]
  });

  await loadNextUp();
}

ready(async () => {
  const sel = document.getElementById("sort-nextup");
  populateSortSelect(sel);
  sel.addEventListener("change", renderNextUp);

  const token = await getToken();
  if (token) await loadNextUp();
});