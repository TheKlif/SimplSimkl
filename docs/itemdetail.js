function escapeAndBreak(container, text) {
  // Simkl overview text sometimes contains literal "<br>" strings instead of
  // real line breaks. Split on those and insert actual <br> elements without
  // ever treating the rest of the string as HTML.
  const parts = String(text).split(/<br\s*\/?>/i);
  parts.forEach((part, i) => {
    container.appendChild(document.createTextNode(part));
    if (i < parts.length - 1) container.appendChild(document.createElement("br"));
  });
}

function openOverlay(overlayId) { document.getElementById(overlayId).hidden = false; }
function closeOverlay(overlayId) { document.getElementById(overlayId).hidden = true; }

async function showItemDetail(type, ids, currentStatus) {
  const singularType = type === "shows" ? "tv" : "movies";
  const detail = document.getElementById("itemdetail");
  detail.innerHTML = "Loading…";
  openOverlay("itemdetail-overlay");

  const data = await simklGet(`/${singularType}/${ids.simkl}?extended=full`);
  detail.innerHTML = "";

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "Close";
  closeBtn.className = "modal-close";
  closeBtn.addEventListener("click", () => closeOverlay("itemdetail-overlay"));
  detail.appendChild(closeBtn);

  const img = document.createElement("img");
  img.src = posterUrl(data.poster);
  img.className = "modal-poster";
  detail.appendChild(img);

  const h2 = document.createElement("h2");
  h2.textContent = data.title;
  detail.appendChild(h2);

  const overview = document.createElement("p");
  escapeAndBreak(overview, data.overview || "(no overview field found — check console log)");
  detail.appendChild(overview);

  const select = document.createElement("select");
  for (const s of statusesFor(type)) {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    if (s === currentStatus) opt.selected = true;
    select.appendChild(opt);
  }
  select.addEventListener("change", () => changeStatus(type, ids, select.value));
  detail.appendChild(select);

  if (type === "shows") {
    const episodesData = await simklGet(`/tv/episodes/${ids.simkl}`);
    const epHeader = document.createElement("h3");
    epHeader.textContent = "Episodes";
    detail.appendChild(epHeader);

    const bySeason = {};
    for (const ep of episodesData) {
      (bySeason[ep.season] ||= []).push(ep);
    }

    for (const seasonNum of Object.keys(bySeason).sort((a, b) => a - b)) {
      const seasonBlock = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent = `Season ${seasonNum}`;
      seasonBlock.appendChild(summary);

      const epList = document.createElement("ul");
      for (const ep of bySeason[seasonNum]) {
        const li = document.createElement("li");
        li.textContent = `E${ep.episode}: ${ep.title}${ep.aired ? "" : " (not aired)"}`;
        epList.appendChild(li);
      }
      seasonBlock.appendChild(epList);
      detail.appendChild(seasonBlock);
    }
  }
}

async function showEpisodeDetail(show, seasonEpisodeStr) {
  const match = seasonEpisodeStr.match(/S(\d+)E(\d+)/);
  const seasonNum = parseInt(match[1], 10);
  const episodeNum = parseInt(match[2], 10);

  const detail = document.getElementById("episodedetail");
  detail.innerHTML = "Loading…";
  openOverlay("episodedetail-overlay");

  const episodesData = await simklGet(`/tv/episodes/${show.ids.simkl}`);
  const ep = episodesData.find(e => e.season === seasonNum && e.episode === episodeNum);

  detail.innerHTML = "";

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "Close";
  closeBtn.className = "modal-close";
  closeBtn.addEventListener("click", () => closeOverlay("episodedetail-overlay"));
  detail.appendChild(closeBtn);

  const h3 = document.createElement("h3");
  h3.textContent = show.title;
  detail.appendChild(h3);

  const epLine = document.createElement("p");
  epLine.textContent = ep && ep.title ? `${seasonEpisodeStr}: ${ep.title}` : seasonEpisodeStr;
  detail.appendChild(epLine);

  // ASSUMPTION: field name for episode synopsis is unconfirmed on this
  // endpoint (may be "overview", "description", or absent). Check the
  // console log below if this renders as unavailable.
  console.log("Episode detail raw data:", ep);

  const overview = document.createElement("p");
  escapeAndBreak(overview, (ep && (ep.overview || ep.description)) || "(no episode synopsis available)");
  detail.appendChild(overview);

  if (ep && ep.date) {
    const aired = document.createElement("p");
    aired.textContent = `Aired: ${ep.date}`;
    detail.appendChild(aired);
  }
}