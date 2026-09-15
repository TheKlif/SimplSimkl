const SIMKL_API_KEY = CLIENT_ID; // same value, per Simkl's docs the client_id doubles as simkl-api-key

async function simklGet(path) {
  const token = await getToken();
  const res = await fetch(`https://api.simkl.com${path}`, {
    headers: {
      "simkl-api-key": SIMKL_API_KEY,
      "Authorization": `Bearer ${token}`
    }
  });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

async function simklPost(path, body) {
  const token = await getToken();
  const res = await fetch(`https://api.simkl.com${path}`, {
    method: "POST",
    headers: {
      "simkl-api-key": SIMKL_API_KEY,
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
  return res.json();
}

const STATUSES = ["watching", "plantowatch", "completed"];

async function loadAllLists() {
  for (const status of STATUSES) {
    const data = await simklGet(`/sync/all-items?status=${status}`);
    renderList(status, data);
  }
}

function renderList(status, data) {
  const ul = document.getElementById(`list-${status}`);
  ul.innerHTML = "";

  // Simkl's all-items response splits by media type
  const items = [
    ...(data.shows || []),
    ...(data.movies || [])
  ];

  for (const entry of items) {
    const media = entry.show || entry.movie;
    const type = entry.show ? "shows" : "movies";
    const li = document.createElement("li");

    const title = document.createElement("span");
    title.textContent = media.title;

    const select = document.createElement("select");
    for (const s of STATUSES) {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = s;
      if (s === status) opt.selected = true;
      select.appendChild(opt);
    }
    select.addEventListener("change", () => changeStatus(type, media.ids, select.value));

    li.appendChild(title);
    li.appendChild(select);
    ul.appendChild(li);
  }
}

async function changeStatus(type, ids, newStatus) {
  const body = { [type]: [{ ids: ids, to: newStatus }] };
  await simklPost("/sync/add-to-list", body);
  await loadAllLists(); // re-pull to reflect the move; activities-check optimization comes later
}

window.addEventListener("DOMContentLoaded", async () => {
  const token = await getToken();
  if (token) {
    await loadAllLists();
  }
});