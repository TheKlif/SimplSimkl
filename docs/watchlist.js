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

const TYPES = ["shows", "movies"];
const STATUSES = ["watching", "plantowatch", "completed"];

async function loadAllLists() {
  for (const status of STATUSES) {
    document.getElementById(`list-${status}`).innerHTML = "";
  }

  for (const status of STATUSES) {
    for (const type of TYPES) {
      const data = await simklGet(`/sync/all-items/${type}/${status}`);
      console.log(`RAW RESPONSE for ${type}/${status}:`, data);
      renderItems(status, type, data);
    }
  }
}

function renderItems(status, type, data) {
  const ul = document.getElementById(`list-${status}`);
  const items = Array.isArray(data) ? data : (data[type] || data.items || []);

  for (const entry of items) {
    const media = entry.show || entry.movie || entry;
    const li = document.createElement("li");

    const title = document.createElement("span");
    title.textContent = media.title || "(no title found)";

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