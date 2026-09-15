async function loadNextUp() {
  const ul = document.getElementById("list-nextup");
  ul.innerHTML = "";

  const watchingData = await simklGet("/sync/all-items/shows/watching");
  const watchingShows = watchingData.shows || [];

  for (const entry of watchingShows) {
    const show = entry.show;
    const episodesData = await simklGet(`/tv/episodes/${show.ids.simkl}`);
    console.log(`RAW EPISODES for ${show.title}:`, episodesData);
    console.log(`WATCHED-EPISODE DATA for ${show.title}:`, entry);
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  const token = await getToken();
  if (token) {
    await loadNextUp();
  }
});