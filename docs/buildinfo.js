async function showLastUpdated() {
  const el = document.getElementById("lastUpdated");
  try {
    const res = await fetch("https://api.github.com/repos/TheKlif/SimplSimkl/commits?path=docs&per_page=1");
    const commits = await res.json();
    const commitDate = new Date(commits[0].commit.committer.date);
    el.textContent = `Last updated: ${commitDate.toLocaleString()}`;
  } catch (err) {
    el.textContent = "Last updated: unknown (couldn't reach GitHub)";
  }
}

window.addEventListener("DOMContentLoaded", showLastUpdated);