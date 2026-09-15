async function showItemDetail(type, ids, currentStatus) {
  const singularType = type === "shows" ? "tv" : "movies";
  const detail = document.getElementById("itemdetail");
  detail.style.display = "block";
  detail.innerHTML = "Loading…";

  const data = await simklGet(`/${singularType}/${ids.simkl}?extended=full`);
  console.log(`RAW ${singularType.toUpperCase()} DETAIL for ${data.title}:`, data);
  console.log(JSON.stringify(data, null, 2));

  detail.innerHTML = "";

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "Close";
  closeBtn.addEventListener("click", () => { detail.style.display = "none"; });
  detail.appendChild(closeBtn);

  const img = document.createElement("img");
  img.src = posterUrl(data.poster);
  img.width = 150;
  detail.appendChild(img);

  const h2 = document.createElement("h2");
  h2.textContent = data.title;
  detail.appendChild(h2);

  const overview = document.createElement("p");
  overview.textContent = data.overview || "(no overview field found — check console log)";
  detail.appendChild(overview);

  const select = document.createElement("select");
  for (const s of STATUSES) {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    if (s === currentStatus) opt.selected = true;
    select.appendChild(opt);
  }
  select.addEventListener("change", () => changeStatus(type, ids, select.value));
  detail.appendChild(select);

  const castNote = document.createElement("p");
  castNote.textContent = "Cast: not rendered yet — checking whether extended=full includes it (see console log).";
  detail.appendChild(castNote);

  if (type === "shows") {
    const episodesData = await simklGet(`/tv/episodes/${ids.simkl}`);
    const epHeader = document.createElement("h3");
    epHeader.textContent = "Episodes";
    detail.appendChild(epHeader);

    const epList = document.createElement("ul");
    for (const ep of episodesData) {
      const li = document.createElement("li");
      li.textContent = `S${ep.season}E${ep.episode}: ${ep.title}${ep.aired ? "" : " (not aired)"}`;
      epList.appendChild(li);
    }
    detail.appendChild(epList);
  }
}