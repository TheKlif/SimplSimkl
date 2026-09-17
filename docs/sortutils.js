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
  recent:     { label: "Most recently updated", cmp: (a, b) => getEntryRecency(b) - getEntryRecency(a) },
  episodesRemaining:     { label: "Episodes remaining (fewest first)", cmp: (a, b) => episodesRemainingCompare(a, b, true) },
  episodesRemainingDesc: { label: "Episodes remaining (most first)", cmp: (a, b) => episodesRemainingCompare(a, b, false) }
};

// Cache of show id -> remaining aired-episode count, so re-selecting this
// sort or switching tabs doesn't refetch shows already looked up this
// session. Simkl has no "watched count" field on sync/all-items entries as
// far as we've confirmed, so this fetches each show's full episode list and
// counts aired episodes before the "watching" entry's next_to_watch marker.
// ASSUMPTION: unverified against a live response — if a show's count looks
// wrong, check the console for the per-show error/log below.
const EPISODES_REMAINING_KEYS = ["episodesRemaining", "episodesRemainingDesc"];

const episodesRemainingCache = new Map();

async function ensureEpisodesRemaining(items) {
  const toFetch = items.filter(entry => {
    const show = entry.show;
    return show && !episodesRemainingCache.has(show.ids.simkl);
  });

  await Promise.all(toFetch.map(async entry => {
    const show = entry.show;
    try {
      const episodesData = await simklGet(`/tv/episodes/${show.ids.simkl}`);
      // Specials/extras have no season number at all (not season 0 — just
      // missing). They can never be matched against next_to_watch's
      // season/episode numbers below, so leaving them in would make any
      // unwatched special count as a "remaining" real episode forever.
      // Excluded from this calculation entirely per Klif's request.
      const aired = episodesData.filter(ep => ep.aired && ep.season !== undefined && ep.season !== null);

      let watchedCount = aired.length; // no next_to_watch = fully caught up
      const match = entry.next_to_watch && entry.next_to_watch.match(/S(\d+)E(\d+)/);
      if (match) {
        const season = parseInt(match[1], 10);
        const episode = parseInt(match[2], 10);
        watchedCount = aired.filter(ep =>
          ep.season < season || (ep.season === season && ep.episode < episode)
        ).length;
      }

      episodesRemainingCache.set(show.ids.simkl, Math.max(0, aired.length - watchedCount));
    } catch (e) {
      console.error(`Episode count fetch failed for "${show.title}":`, e);
      episodesRemainingCache.set(show.ids.simkl, null);
    }
  }));
}

function getEntryEpisodesRemaining(entry) {
  if (!entry.show) return Infinity; // movies don't have episodes; sort last
  const val = episodesRemainingCache.get(entry.show.ids.simkl);
  return typeof val === "number" ? val : Infinity; // unfetched/failed sorts last
}

// Movies and anything not yet fetched use Infinity as a "put this last"
// sentinel. A plain b-a for the descending option would instead put them
// FIRST, so this handles the sentinel explicitly in both directions.
function episodesRemainingCompare(a, b, ascending) {
  const av = getEntryEpisodesRemaining(a);
  const bv = getEntryEpisodesRemaining(b);
  if (av === Infinity && bv === Infinity) return 0;
  if (av === Infinity) return 1;
  if (bv === Infinity) return -1;
  return ascending ? av - bv : bv - av;
}

function populateSortSelect(selectEl, savedKey, excludeKeys = []) {
  selectEl.innerHTML = "";
  for (const [key, opt] of Object.entries(SORT_OPTIONS)) {
    if (excludeKeys.includes(key)) continue;
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