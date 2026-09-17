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

// Clicking the dimmed backdrop itself (not the modal content sitting on
// top of it) should close the overlay, same as the close button.
ready(() => {
  for (const overlayId of ["itemdetail-overlay", "episodedetail-overlay"]) {
    const overlayEl = document.getElementById(overlayId);
    overlayEl.addEventListener("click", (e) => {
      if (e.target === overlayEl) closeOverlay(overlayId);
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    for (const overlayId of ["episodedetail-overlay", "itemdetail-overlay"]) {
      const overlayEl = document.getElementById(overlayId);
      if (!overlayEl.hidden) {
        closeOverlay(overlayId);
        break; // close only the topmost (episode detail can sit over item detail)
      }
    }
  });
});

// Simkl has no confirmed per-episode watched-history endpoint. This
// approximates "watched" the same way episodes-remaining does: everything
// before the "watching" entry's next_to_watch marker counts as watched,
// everything at/after doesn't. Completed = everything watched, Plan to
// Watch = nothing watched. Specials (undefined season) and an unknown
// status (e.g. opened from Search, which doesn't know the real status)
// are left unmarked rather than guessed.
function getWatchedThreshold(currentStatus, nextToWatch) {
  if (currentStatus == null) return null;
  if (currentStatus === "completed") return { season: Infinity, episode: Infinity };
  if (currentStatus === "plantowatch") return { season: -Infinity, episode: -Infinity };
  if (nextToWatch) {
    const match = nextToWatch.match(/S(\d+)E(\d+)/);
    if (match) return { season: parseInt(match[1], 10), episode: parseInt(match[2], 10) };
  }
  return { season: Infinity, episode: Infinity }; // watching, fully caught up
}

function isEpisodeWatched(ep, threshold) {
  if (!threshold) return null;
  if (ep.season === undefined || ep.season === null) return null; // specials: unknown
  return ep.season < threshold.season || (ep.season === threshold.season && ep.episode < threshold.episode);
}

async function showItemDetail(type, ids, currentStatus, nextToWatch) {
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

  const btnGroup = document.createElement("div");
  btnGroup.className = "status-btn-group";
  for (const s of statusesFor(type)) {
    const btn = document.createElement("button");
    btn.className = "status-btn";
    if (s === currentStatus) btn.classList.add("status-btn-active");
    btn.textContent = STATUS_LABELS[s] || s;
    btn.addEventListener("click", async () => {
      await changeStatus(type, ids, s);
      for (const sibling of btnGroup.children) sibling.classList.remove("status-btn-active");
      btn.classList.add("status-btn-active");
    });
    btnGroup.appendChild(btn);
  }
  detail.appendChild(btnGroup);

  if (type === "shows") {
    const episodesData = await simklGet(`/tv/episodes/${ids.simkl}`);
    const watchedThreshold = getWatchedThreshold(currentStatus, nextToWatch);
    const epHeader = document.createElement("h3");
    epHeader.textContent = "Episodes";
    detail.appendChild(epHeader);

    const bySeason = {};
    for (const ep of episodesData) {
      (bySeason[ep.season] ||= []).push(ep);
    }

    const seasonKeys = Object.keys(bySeason).sort((a, b) => {
      if (a === "undefined") return 1;
      if (b === "undefined") return -1;
      return a - b;
    });

    for (const seasonNum of seasonKeys) {
      const seasonBlock = document.createElement("details");
      const summary = document.createElement("summary");
      const allWatched = seasonNum !== "undefined" &&
        bySeason[seasonNum].every(ep => isEpisodeWatched(ep, watchedThreshold) === true);
      summary.textContent = seasonNum === "undefined"
        ? "Specials"
        : `${allWatched ? "✓ " : ""}Season ${seasonNum}`;
      seasonBlock.appendChild(summary);

      const epList = document.createElement("ul");
      for (const ep of bySeason[seasonNum]) {
        const li = document.createElement("li");
        const epLabel = ep.episode !== undefined && ep.episode !== null ? `E${ep.episode}: ` : "";
        const watched = isEpisodeWatched(ep, watchedThreshold);
        li.textContent = `${watched === true ? "✓ " : ""}${epLabel}${ep.title}${ep.aired ? "" : " (not aired)"}`;
        if (watched === true) li.classList.add("episode-watched");
        if (ep.season !== undefined && ep.season !== null && ep.episode !== undefined && ep.episode !== null) {
          li.classList.add("episode-link");
          li.addEventListener("click", () => showEpisodeDetail(data, `S${ep.season}E${ep.episode}`));
        }
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