function withAppParams(path) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}client_id=${CLIENT_ID}&app-name=${APP_NAME}&app-version=${APP_VERSION}`;
}

async function simklGet(path) {
  const token = await getToken();
  const res = await fetch(`https://api.simkl.com${withAppParams(path)}`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

async function simklPost(path, body) {
  const token = await getToken();
  const res = await fetch(`https://api.simkl.com${withAppParams(path)}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
  return res.json();
}

const TYPES = ["shows", "movies"];
const STATUSES = ["watching", "plantowatch", "completed"];

// Movies don't carry a "watching" status on Simkl; setting it silently
// no-ops server-side. Any status control should offer only the statuses
// valid for the item's type.
function statusesFor(type) {
  return type === "movies" ? STATUSES.filter(s => s !== "watching") : STATUSES;
}

const watchlistCache = { watching: [], plantowatch: [], completed: [] };

// Lets Search show an item's real current status (if any) without its own
// separate lookup — reuses whatever's already loaded into the Watchlist tabs.
function getCurrentStatusForSimklId(simklId) {
  for (const status of STATUSES) {
    for (const entry of watchlistCache[status]) {
      const media = entry.show || entry.movie || entry;
      if (media.ids && media.ids.simkl === simklId) return status;
    }
  }
  return null;
}

async function loadAllLists() {
  for (const status of STATUSES) watchlistCache[status] = [];

  for (const status of STATUSES) {
    for (const type of TYPES) {
      const data = await simklGet(`/sync/all-items/${type}/${status}`);
      const items = Array.isArray(data) ? data : (data[type] || data.items || []);
      for (const entry of items) {
        watchlistCache[status].push({ ...entry, _type: type });
      }
    }
  }

  for (const status of STATUSES) renderStatusList(status);
}

async function renderStatusList(status) {
  const ul = document.getElementById(`list-${status}`);
  const sortSelect = document.getElementById(`sort-${status}`);
  const hideCaughtUpEl = status === "watching" ? document.getElementById("hide-caughtup") : null;
  const hidingCaughtUp = hideCaughtUpEl ? hideCaughtUpEl.checked : false;

  if (EPISODES_REMAINING_KEYS.includes(sortSelect.value) || hidingCaughtUp) {
    ul.innerHTML = "Loading episode counts…";
    await ensureEpisodesRemaining(watchlistCache[status]);
  }

  ul.innerHTML = "";
  let sorted = applySort(watchlistCache[status], sortSelect.value);

  if (hidingCaughtUp) {
    sorted = sorted.filter(entry => getEntryEpisodesRemaining(entry) !== 0);
  }

  for (const entry of sorted) {
    const media = entry.show || entry.movie || entry;
    const li = document.createElement("li");

    const title = document.createElement("span");
    title.className = "item-title";
    title.textContent = media.title || "(no title found)";
    title.addEventListener("click", () => showItemDetail(entry._type, media.ids, status, entry.next_to_watch));

    const badge = document.createElement("span");
    badge.className = "type-badge";
    badge.textContent = `[${TYPE_LABELS[entry._type] || entry._type}]`;
    title.appendChild(badge);

    const btnGroup = document.createElement("div");
    btnGroup.className = "status-btn-group";
    for (const s of STATUSES) {
      const btn = document.createElement("button");
      btn.className = "status-btn";
      btn.textContent = STATUS_LABELS[s] || s;
      if (s === "watching" && entry._type === "movies") {
        // Movies don't have a "watching" status, but rendering nothing here
        // (rather than an invisible placeholder of the same size) makes
        // titles in mixed movie/show lists drift out of vertical alignment.
        btn.classList.add("status-btn-placeholder");
        btn.disabled = true;
      } else {
        if (s === status) btn.classList.add("status-btn-active");
        btn.addEventListener("click", () => changeStatus(entry._type, media.ids, s));
      }
      btnGroup.appendChild(btn);
    }

    li.appendChild(btnGroup);
    li.appendChild(title);
    ul.appendChild(li);
  }
}

async function changeStatus(type, ids, newStatus) {
  const body = { [type]: [{ ids: ids, to: newStatus }] };
  await simklPost("/sync/add-to-list", body);
  await loadAllLists();
}

ready(async () => {
  for (const status of STATUSES) {
    const sel = document.getElementById(`sort-${status}`);
    populateSortSelect(sel, null, status === "watching" ? [] : EPISODES_REMAINING_KEYS);
    sel.addEventListener("change", () => renderStatusList(status));
  }

  document.getElementById("hide-caughtup").addEventListener("change", () => renderStatusList("watching"));

  const token = await getToken();
  if (token) await loadAllLists();
});