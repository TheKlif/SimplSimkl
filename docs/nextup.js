function posterUrl(path) {
  if (!path) return "https://wsrv.nl/?url=https://simkl.in/poster_no_pic_c.png";
  return `https://wsrv.nl/?url=https://simkl.in/posters/${path}_m.webp&q=90`;
}

async function loadNextUp() {
  const ul = document.getElementById("list-nextup");
  ul.innerHTML = "";

  const watchingData = await simklGet("/sync/all-items/shows/watching");
  const watchingShows = watchingData.shows || [];

  for (const entry of watchingShows) {
    if (!entry.next_to_watch) continue; // fully caught up, nothing to show

    const show = entry.show;
    const li = document.createElement("li");

    const img = document.createElement("img");
    img.src = posterUrl(show.poster);
    img.alt = show.title;
    img.width = 60;

    const title = document.createElement("span");
    title.textContent = ` ${show.title} — ${entry.next_to_watch} `;

    const markBtn = document.createElement("button");
    markBtn.textContent = "Mark watched";
    markBtn.addEventListener("click", () => markEpisodeWatched(show, entry.next_to_watch));

    li.appendChild(img);
    li.appendChild(title);
    li.appendChild(markBtn);
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
      seasons: [{
        number: season,
        episodes: [{ number: episode }]
      }]
    }]
  });

  await loadNextUp(); // refresh to show the new next_to_watch
}

window.addEventListener("DOMContentLoaded", async () => {
  const token = await getToken();
  if (token) {
    await loadNextUp();
  }
});