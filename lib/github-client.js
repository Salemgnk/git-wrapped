const API = "https://api.github.com/graphql";

export async function graphql(query, variables, token, fetchImpl = fetch) {
  const r = await fetchImpl(API, { method: "POST",
    headers: { Authorization: "bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }) });
  if (!r.ok) throw new Error("github http " + r.status);
  const j = await r.json();
  if (j.errors) throw new Error("github graphql: " + JSON.stringify(j.errors));
  return j.data;
}

const Q_MAIN = `query($user:String!,$from:DateTime!,$to:DateTime!){
  user(login:$user){ id avatarUrl
    contributionsCollection(from:$from,to:$to){
      commitContributionsByRepository(maxRepositories:100){
        repository{ name owner{ login } isPrivate } contributions{ totalCount } } }
    repositories(first:100,ownerAffiliations:OWNER,isFork:false,privacy:PUBLIC){
      nodes{ languages(first:6){ edges{ size node{ name } } } } } } }`;

const Q_HISTORY = `query($owner:String!,$name:String!,$id:ID!,$since:GitTimestamp!,$until:GitTimestamp!,$cursor:String){
  repository(owner:$owner,name:$name){ defaultBranchRef{ target{ ... on Commit{
    history(author:{id:$id},since:$since,until:$until,first:100,after:$cursor){
      pageInfo{ hasNextPage endCursor }
      nodes{ committedDate messageHeadline additions deletions } } } } } } }`;

const Q_REPO_LANGS = `query($owner:String!,$name:String!){
  repository(owner:$owner,name:$name){ languages(first:6){ edges{ size node{ name } } } } }`;

const NAME_EXT = { JavaScript:".js", TypeScript:".ts", Python:".py", Rust:".rs", Go:".go",
  Java:".java", "C++":".cpp", C:".c", "C#":".cs", Ruby:".rb", PHP:".php", HTML:".html",
  CSS:".css", SCSS:".scss", Shell:".sh", Markdown:".md", Vue:".vue", Kotlin:".kt",
  Swift:".swift", Dart:".dart", "Jupyter Notebook":".ipynb", Lua:".lua" };

// Normalise une période (nombre = année, ou { from, to }) en dates + timestamps ISO.
export function bounds(period) {
  let fromD, toD;
  if (period && typeof period === "object" && period.from && period.to) {
    fromD = String(period.from).slice(0, 10); toD = String(period.to).slice(0, 10);
  } else {
    const y = period || new Date().getUTCFullYear();
    fromD = y + "-01-01"; toD = y + "-12-31";
  }
  return { fromD, toD, from: fromD + "T00:00:00Z", to: toD + "T23:59:59Z" };
}

export async function fetchWrapped(user, period, token, fetchImpl = fetch) {
  const { fromD, toD, from, to } = bounds(period);
  const data = await graphql(Q_MAIN, { user, from, to }, token, fetchImpl);
  if (!data.user) { const e = new Error("user not found"); e.code = 404; throw e; }
  const u = data.user;
  // Ne jamais exposer les repos privés : le classement et les wrapped (/?u=…)
  // sont publics, et le token interroge nos propres contributions (privées incluses).
  const reposByCommits = u.contributionsCollection.commitContributionsByRepository
    .filter(x => !x.repository.isPrivate)
    .map(x => ({ name: x.repository.name, owner: x.repository.owner.login,
      count: x.contributions.totalCount }))
    .sort((a, b) => b.count - a.count);
  const langAgg = new Map();
  for (const repo of u.repositories.nodes)
    for (const e of (repo.languages ? repo.languages.edges : [])) {
      const ext = NAME_EXT[e.node.name] || ("." + e.node.name.toLowerCase().replace(/\W+/g, ""));
      langAgg.set(ext, (langAgg.get(ext) || 0) + e.size);
    }
  const languages = [...langAgg.entries()].map(([ext, count]) => ({ ext, count }));
  const commits = [];
  for (const r of reposByCommits.slice(0, 10)) {
    let cursor = null, pages = 0;
    do {
      const h = await graphql(Q_HISTORY,
        { owner: r.owner, name: r.name, id: u.id, since: from, until: to, cursor }, token, fetchImpl);
      const hist = h.repository && h.repository.defaultBranchRef
        && h.repository.defaultBranchRef.target && h.repository.defaultBranchRef.target.history;
      if (!hist) break;
      for (const n of hist.nodes) commits.push({ repo: r.name, private: false,
        committedDate: n.committedDate, message: n.messageHeadline,
        additions: n.additions, deletions: n.deletions });
      cursor = hist.pageInfo.hasNextPage ? hist.pageInfo.endCursor : null;
    } while (cursor && ++pages < 5);
  }
  return { user, from: fromD, to: toD, id: u.id, avatar: u.avatarUrl, reposByCommits, commits, languages };
}

// Commits privés de l'utilisateur (par node id) sur une liste de repos, via un
// installation token. Réutilise Q_HISTORY (auteur = id) + langages par repo.
export async function fetchPrivateCommits({ userId, repos, period, token, fetchImpl = fetch }) {
  const { from, to } = bounds(period);
  const commits = [], langAgg = new Map(), reposByCommits = [];
  for (const r of repos) {
    const ld = await graphql(Q_REPO_LANGS, { owner: r.owner, name: r.name }, token, fetchImpl);
    const edges = ld.repository && ld.repository.languages ? ld.repository.languages.edges : [];
    for (const e of edges) {
      const ext = NAME_EXT[e.node.name] || ("." + e.node.name.toLowerCase().replace(/\W+/g, ""));
      langAgg.set(ext, (langAgg.get(ext) || 0) + e.size);
    }
    let cursor = null, pages = 0, count = 0;
    do {
      const h = await graphql(Q_HISTORY,
        { owner: r.owner, name: r.name, id: userId, since: from, until: to, cursor }, token, fetchImpl);
      const hist = h.repository && h.repository.defaultBranchRef
        && h.repository.defaultBranchRef.target && h.repository.defaultBranchRef.target.history;
      if (!hist) break;
      for (const n of hist.nodes) { commits.push({ repo: r.name, private: true,
        committedDate: n.committedDate, message: n.messageHeadline,
        additions: n.additions, deletions: n.deletions }); count++; }
      cursor = hist.pageInfo.hasNextPage ? hist.pageInfo.endCursor : null;
    } while (cursor && ++pages < 5);
    if (count) reposByCommits.push({ name: r.name, owner: r.owner, count });
  }
  const languages = [...langAgg.entries()].map(([ext, count]) => ({ ext, count }));
  return { commits, languages, reposByCommits };
}
