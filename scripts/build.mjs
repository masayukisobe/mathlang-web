import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=async path=>readFile(resolve(root,path),'utf8');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const data=JSON.parse(await read('content/site.json'));
const capabilities=JSON.parse(await read('content/capabilities.json'));
const allow=JSON.parse(await read('provenance/public-allowlist.json'));
const initialRefs=JSON.parse(await read('public/materials/provenance.json'));
const numericRefs=JSON.parse(await read('public/results/v1/provenance.json'));
const capabilitiesHtml=capabilities.groups.map(group=>`<article class="capability-card"><div class="capability-title"><h3>${escape(group.title)}</h3><span>${group.definitions.length} 定義</span></div><p>${escape(group.summary)}</p></article>`).join('\n');
const scopeRows=data.demos.map(demo=>`<article class="scope-row" id="${demo.id.toLowerCase()}" aria-labelledby="scope-${demo.id}"><h2 id="scope-${demo.id}">${escape(demo.category)}</h2><span class="state${demo.developmentStage==='検証中'?' pending':''}">${escape(demo.developmentStage)} · ${escape(demo.stageQualifier)}</span><div class="scope-body"><p><strong>確かめた範囲：</strong>${escape(demo.acceptanceScope)}</p><p><strong>次の検証・適用の限界：</strong>${escape(demo.limits)}</p><p class="scope-date">状態資料 ${escape(demo.lastVerifiedAt)} / 表示更新 ${escape(demo.lastUpdatedAt)}</p></div></article>`).join('\n');
const values={CAPABILITIES:capabilitiesHtml,SCOPE_ROWS:scopeRows,UPDATED_AT:escape(data.updatedAt),RELEASE:escape(data.release),REPO_LINK:`<a href="${escape(data.repositoryUrl)}" rel="noopener noreferrer">公開用ソース（GitHub）</a>`};
const dist=resolve(root,'dist');await rm(dist,{recursive:true,force:true});await mkdir(dist,{recursive:true});
for(const page of ['index.html','status.html']){let html=await read(`src/${page}`);for(const [key,value]of Object.entries(values))html=html.replaceAll(`__${key}__`,value);if(/__[A-Z_]+__/.test(html))throw Error('Unresolved HTML placeholder');await writeFile(resolve(dist,page),html);}
for(const [source,destination]of Object.entries(allow.staticCopies)){await mkdir(dirname(resolve(dist,destination)),{recursive:true});await cp(resolve(root,source),resolve(dist,destination));}
// The saved SVG plots render only selected recorded CSV values.
await writeFile(resolve(dist,'.nojekyll'),'');
const publicFiles={};for(const path of allow.deployedFiles.filter(p=>p!=='provenance/site.json'))publicFiles[path]=sha(await readFile(resolve(dist,path)));
const authored={};for(const path of allow.newAuthoredContent)authored[path]=sha(await readFile(resolve(root,path)));
const provenance={schemaVersion:'mathlang.website_public_provenance.v2',release:data.release,asOf:data.updatedAt,presentation:'静的紹介。新規構成図と、選別した保存済みProcessor数値出力の波形。製品UI画像ではない。',referenceSnapshotHashes:initialRefs.referenceSnapshots,numericSourceSnapshotSha256:numericRefs.sourceSnapshot.sha256,operationCatalogSnapshotSha256:capabilities.sourceSnapshotSha256,systemScope:JSON.parse(await read('content/system.json')),referenceHashMeaning:'採用根拠の版を指すhash。公開ファイルのhashとは別。元資料とsourceの一覧は非公開。',newAuthoredSourceHashes:authored,selectedImportHashes:allow.importedMaterialHashes,initialMaterials:'materials/は初版の説明資料。現在の実数値はresults/v1/。',publicFileHashes:publicFiles,selfHashNote:'このmanifest自身は循環を避けて含めない。公開source commitで固定。',numericAcceptance:JSON.parse(await read('public/results/v1/acceptance.json')),demos:data.demos.map(({id,developmentStage,stageQualifier,acceptanceScope,limits,lastUpdatedAt,media})=>({id,developmentStage,stageQualifier,acceptanceScope,limits,lastUpdatedAt,media})),futureMediaRule:'個別公開許可と対応する本人一巡の確認後に版を更新。',containsProductSource:false,productExecutionPerformedByWebsiteTask:false};
await mkdir(resolve(dist,'provenance'),{recursive:true});await writeFile(resolve(dist,'provenance/site.json'),JSON.stringify(provenance,null,2)+'\n');
console.log(`Built ${allow.deployedFiles.length} explicitly allowed static files.`);
