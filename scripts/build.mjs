import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = async path => readFile(resolve(root, path), 'utf8');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const escape = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const data = JSON.parse(await read('content/site.json'));
const allowlist = JSON.parse(await read('provenance/public-allowlist.json'));
const refs = JSON.parse(await read('public/materials/provenance.json'));
const stage = demo => `<span class="card-stage${demo.developmentStage === '検証中' ? ' testing' : ''}">${escape(demo.developmentStage)}</span>`;
const demoCards = data.demos.map(demo => `<article class="demo-card" aria-labelledby="title-${demo.id}">
  <div class="card-topline"><span class="card-number" aria-hidden="true">${demo.number}</span>${stage(demo)}</div>
  <p class="card-stage-scope">${escape(demo.stageQualifier)}</p>
  <figure><img src="${escape(demo.diagram)}" width="600" height="360" loading="lazy" alt="${escape(demo.diagramAlt)}"><figcaption>${escape(demo.diagramCaption)}</figcaption></figure>
  <p class="card-category">${escape(demo.category)}</p><h3 id="title-${demo.id}">${escape(demo.title)}</h3>
  <p class="card-question">${escape(demo.question)}</p><p class="card-description">${escape(demo.description)}</p>
  <p class="card-decision"><span>この問いで判断すること</span>${escape(demo.decision)}</p>
  <a class="card-scope-link" href="#scope-${demo.id}">確かめた範囲と、次の検証を読む</a>
</article>`).join('\n');
const scopeRows = data.demos.map(demo => `<article class="scope-row" id="scope-${demo.id}" aria-labelledby="scope-title-${demo.id}">
  <div class="scope-title"><h3 id="scope-title-${demo.id}">${escape(demo.category)}</h3>${stage(demo)}<p class="scope-qualifier">${escape(demo.stageQualifier)}</p></div>
  <div class="scope-body"><div class="scope-evidence" aria-label="根拠の層">${demo.evidenceLevel.map(level => `<span>${escape(level)}</span>`).join('')}</div>
  <p><strong>確かめた範囲：</strong>${escape(demo.acceptanceScope)}</p><p><strong>次の検証・適用の限界：</strong>${escape(demo.limits)}</p>
  <p class="scope-date">資料照合 ${escape(demo.lastVerifiedAt)} / 表示更新 ${escape(demo.lastUpdatedAt)}</p></div>
</article>`).join('\n');
const nextCards = data.next.map(item => `<article class="next-card"><span class="card-stage">${escape(item.status)}</span><h4>${escape(item.title)}</h4><p>${escape(item.text)}</p></article>`).join('\n');
const repo = data.repositoryUrl ? `<a href="${escape(data.repositoryUrl)}" rel="noopener noreferrer">公開用ソースと更新履歴（GitHub）</a>` : '公開用ソースは準備中';
let html = await read('src/index.html');
for (const [key, value] of Object.entries({DEMO_CARDS:demoCards,SCOPE_ROWS:scopeRows,NEXT_CARDS:nextCards,UPDATED_AT:escape(data.updatedAt),REPO_LINK:repo,RELEASE:escape(data.release)})) html = html.replaceAll(`__${key}__`, value);
if (/__[A-Z_]+__/.test(html)) throw new Error('Unresolved HTML placeholder');

const dist = resolve(root, 'dist');
await rm(dist, {recursive:true, force:true});
await mkdir(dist, {recursive:true});
await writeFile(resolve(dist, 'index.html'), html);
for (const [source, destination] of Object.entries(allowlist.staticCopies)) {
  await mkdir(dirname(resolve(dist, destination)), {recursive:true});
  await cp(resolve(root, source), resolve(dist, destination));
}
await writeFile(resolve(dist, '.nojekyll'), '');
const publicFiles = {};
for (const path of allowlist.deployedFiles.filter(path => path !== 'provenance/site.json')) publicFiles[path] = sha(await readFile(resolve(dist, path)));
const authoredSourceHashes = {};
for (const path of allowlist.newAuthoredContent) authoredSourceHashes[path] = sha(await readFile(resolve(root, path)));
const provenance = {
  schemaVersion:'mathlang.website_public_provenance.v1',
  release:data.release,
  asOf:data.updatedAt,
  presentation:'静的な紹介と計算の読み方。新規SVGは説明図。製品の実行画面・収録済み実演ではない。',
  referenceSnapshotHashes:refs.referenceSnapshots,
  referenceHashMeaning:refs.referenceHashMeaning,
  newAuthoredSourceHashes:authoredSourceHashes,
  newMaterialOrigin:'新規本文・SVG・架空入力。公開用に個別選定された7点は元の公開素材hashを保持。',
  publicFileHashes:publicFiles,
  selfHashNote:'このmanifest自身のhashは循環を避けて含めない。公開sourceのcommitで版を固定する。',
  demos:data.demos.map(({id,developmentStage,stageQualifier,evidenceLevel,acceptanceScope,limits,lastVerifiedAt,verificationKind,lastUpdatedAt,media}) => ({id,developmentStage,stageQualifier,evidenceLevel,acceptanceScope,limits,lastVerifiedAt,verificationKind,lastUpdatedAt,media})),
  futureMediaRule:'対応する本人一巡が受入済みになり、公開素材の許可とhashが確定した後にmediaと説明を更新する。',
  containsProductSource:false,
  productExecutionPerformedByWebsiteTask:false
};
await mkdir(resolve(dist, 'provenance'), {recursive:true});
await writeFile(resolve(dist, 'provenance/site.json'), JSON.stringify(provenance, null, 2) + '\n');
console.log(`Built ${allowlist.deployedFiles.length} explicitly allowed static files.`);
