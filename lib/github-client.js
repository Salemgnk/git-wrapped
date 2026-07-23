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
  user(login:$user){ id
    contributionsCollection(from:$from,to:$to){
      commitContributionsByRepository(maxRepositories:100){
        repository{ name owner{ login } } contributions{ totalCount } } }
    repositories(first:100,ownerAffiliations:OWNER,isFork:false){
      nodes{ languages(first:6){ edges{ size node{ name } } } } } } }`;

const Q_HISTORY = `query($owner:String!,$name:String!,$id:ID!,$since:GitTimestamp!,$until:GitTimestamp!,$cursor:String){
  repository(owner:$owner,name:$name){ defaultBranchRef{ target{ ... on Commit{
    history(author:{id:$id},since:$since,until:$until,first:100,after:$cursor){
      pageInfo{ hasNextPage endCursor }
      nodes{ committedDate messageHeadline additions deletions } } } } } } }`;

const NAME_EXT = { JavaScript:".js", TypeScript:".ts", Python:".py", Rust:".rs", Go:".go",
  Java:".java", "C++":".cpp", C:".c", "C#":".cs", Ruby:".rb", PHP:".php", HTML:".html",
  CSS:".css", SCSS:".scss", Shell:".sh", Markdown:".md", Vue:".vue", Kotlin:".kt",
  Swift:".swift", Dart:".dart", "Jupyter Notebook":".ipynb", Lua:".lua" };

export async function fetchWrapped(user, year, token, fetchImpl = fetch) {
  const from = year + "-01-01T00:00:00Z", to = year + "-12-31T23:59:59Z";
  const data = await graphql(Q_MAIN, { user, from, to }, token, fetchImpl);
  if (!data.user) { const e = new Error("user not found"); e.code = 404; throw e; }
  const u = data.user;
  const reposByCommits = u.contributionsCollection.commitContributionsByRepository
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
      for (const n of hist.nodes) commits.push({ repo: r.name, committedDate: n.committedDate,
        message: n.messageHeadline, additions: n.additions, deletions: n.deletions });
      cursor = hist.pageInfo.hasNextPage ? hist.pageInfo.endCursor : null;
    } while (cursor && ++pages < 5);
  }
  return { user, year, reposByCommits, commits, languages };
}
