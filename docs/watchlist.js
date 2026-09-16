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

const watchlistCache = { watching: [], plantowatch: [], completed: [] };

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

function renderStatusList(status) {
  const ul = document.getElementById(`list-${status}`);
  ul.innerHTML = "";

  const sortSelect = document.getElementById(`sort-${status}`);
  const sorted = applySort(watchlistCache[status], sortSelect.value);

  for (const entry of sorted) {
    const media = entry.show || entry.movie || entry;
    const li = document.createElement("li");

    const title = document.createElement("span");
    title.className = "item-title";
    title.textContent = media.title || "(no title found)";
    title.addEventListener("click", () => showItemDetail(entry._type, media.ids, status));

    const badge = document.createElement("span");
    badge.className = "type-badge";
    badge.textContent = TYPE_LABELS[entry._type] || entry._type;

    const btnGroup = document.createElement("div");
    btnGroup.className = "status-btn-group";
    for (const s of STATUSES) {
      const btn = document.createElement("button");
      btn.className = "status-btn";
      if (s === status) btn.classList.add("status-btn-active");
      btn.textContent = s;
      btn.addEventListener("click", () => changeStatus(entry._type, media.ids, s));
      btnGroup.appendChild(btn);
    }

    li.appendChild(title);
    li.appendChild(badge);
    li.appendChild(btnGroup);
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
    populateSortSelect(sel);
    sel.addEventListener("change", () => renderStatusList(status));
  }

  const token = await getToken();
  if (token) await loadAllLists();
});