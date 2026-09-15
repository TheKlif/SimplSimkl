// Client-side sorting only. Simkl's /sync/all-items endpoint takes no sort
// parameter, so everything here operates on the full list already fetched.

const TYPE_LABELS = { shows: "TV", movies: "Movie" };

function getEntryTitle(entry) {
  const media = entry.show || entry.movie || entry;
  return (media.title || "").toLowerCase();
}

// ASSUMPTION: media.year is unconfirmed against a live response for this
// project. Standard on Simkl show/movie objects, but check console output
// if year sorting comes back wrong.
function getEntryYear(entry) {
  const media = entry.show || entry.movie || entry;
  return media.year || 0;
}

// ASSUMPTION, unverified: candidate field names for "most recent" activity.
// There's no single documented field for this on all-items entries. This
// checks a few likely names and falls back to 0 if none are present.
// Log an entry to console and confirm which field is actually populated,
// then trim this list to just that one.
function getEntryRecency(entry) {
  const candidates = [
    entry.last_watched_at,
    entry.watched_at,
    entry.added_to_watchlist_at,
    entry.last_updated,
    entry.updated_at
  ];
  const found = candidates.find(v => v);
  return found ? new Date(found).getTime() : 0;
}

const SORT_OPTIONS = {
  default:    { label: "Default (as returned by Simkl)", cmp: null },
  titleAsc:   { label: "Title (A to Z)", cmp: (a, b) => getEntryTitle(a).localeCompare(getEntryTitle(b)) },
  titleDesc:  { label: "Title (Z to A)", cmp: (a, b) => getEntryTitle(b).localeCompare(getEntryTitle(a)) },
  yearNewest: { label: "Year (newest first)", cmp: (a, b) => getEntryYear(b) - getEntryYear(a) },
  yearOldest: { label: "Year (oldest first)", cmp: (a, b) => getEntryYear(a) - getEntryYear(b) },
  recent:     { label: "Most recently updated", cmp: (a, b) => getEntryRecency(b) - getEntryRecency(a) }
};

function populateSortSelect(selectEl, savedKey) {
  selectEl.innerHTML = "";
  for (const [key, opt] of Object.entries(SORT_OPTIONS)) {
    const o = document.createElement("option");
    o.value = key;
    o.textContent = opt.label;
    selectEl.appendChild(o);
  }
  selectEl.value = savedKey || "default";
}

function applySort(items, sortKey) {
  const opt = SORT_OPTIONS[sortKey];
  if (!opt || !opt.cmp) return items; // "default" leaves API order untouched
  return [...items].sort(opt.cmp);
}