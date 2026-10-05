import { readFile, readdir, lstat, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { resolve, dirname, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = async path => readFile(resolve(root, path), 'utf8');
const allow = JSON.parse(await read('provenance/public-allowlist.json'));
async function filesAt(base, path = '', skip = []) {
  const files = [];
  for (const name of await readdir(resolve(base, path))) {
    if (skip.includes(name)) continue;
    const rel = posix.join(path, name);
    const info = await lstat(resolve(base, rel));
    assert(!info.isSymbolicLink(), `Symlink is outside export boundary: ${rel}`);
    if (info.isDirectory()) files.push(...await filesAt(base, rel));
    else { assert(info.isFile(), `Non-file: ${rel}`); files.push(rel); }
  }
  return files.sort();
}
assert.deepEqual(await filesAt(root, '', ['.git','dist','node_modules']), [...allow.repositoryFiles].sort(), 'Repository contains unlisted files');
assert.deepEqual(await filesAt(resolve(root, 'dist')), [...allow.deployedFiles].sort(), 'Deploy contains unlisted files');

const privatePatterns = [
  /gh[pousr]_[A-Za-z0-9_]{20,}/,
  /github_pat_[A-Za-z0-9_]{20,}/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{30,}/,
  /\/(?:home|Users|tmp|var\/run|proc)\/[A-Za-z0-9._-]/,
  /https?:\/\/(?:127\.0\.0\.1|localhost|10\.\d+\.\d+\.\d+)(?::|\/)/
];
for (const path of [...allow.repositoryFiles, ...allow.deployedFiles.map(path => `dist/${path}`)]) {
  const text = await read(path);
  for (const pattern of privatePatterns) assert(!pattern.test(text), `Private data pattern in ${path}`);
}

const materialProvenance = JSON.parse(await read('public/materials/provenance.json'));
for (const [path, expected] of Object.entries(materialProvenance.publicFileHashes)) assert.equal(sha(await readFile(resolve(root, 'public/materials', path))), expected, `Changed approved material: ${path}`);
for (const [path, expected] of Object.entries(allow.importedMaterialHashes)) assert.equal(sha(await readFile(resolve(root, path))), expected, `Imported allowlist mismatch: ${path}`);
const manifest = JSON.parse(await read('dist/provenance/site.json'));
for (const [path, expected] of Object.entries(manifest.publicFileHashes)) assert.equal(sha(await readFile(resolve(root, 'dist', path))), expected, `Public hash mismatch: ${path}`);

let linkCount=0;
for(const page of ['index.html','status.html']){
 const html=await read(`dist/${page}`);
 assert(html.includes('<html lang="ja">'));
 assert(html.includes('name="viewport"'));
 assert(html.includes('Content-Security-Policy'));
 assert(!/<(?:script|form|iframe)\b/i.test(html),'Static site contains executable/collection embeds');
 assert.equal((html.match(/<h1\b/g)||[]).length,1);
 assert(html.includes('class="skip-link"'));
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(new Set(ids).size,ids.length,'Duplicate HTML IDs');
 for(const [,target]of html.matchAll(/\b(?:href|src)="([^"]+)"/g)){
  linkCount++;
  if(/^https:\/\//.test(target)){assert.equal(target,'https://github.com/masayukisobe/mathlang-web');continue;}
  assert(!target.startsWith('/'),'Project links must be relative');
  const [file,fragment]=target.split('#');
  if(file)await access(resolve(root,'dist',file));
  if(fragment){const targetHtml=file?await read(`dist/${file}`):html;assert(targetHtml.includes(`id="${fragment}"`),`Missing fragment ${target}`);}
 }
 for(const tag of html.match(/<img\b[^>]*>/g)||[]){assert(/\balt="[^"]*"/.test(tag));assert(/\bwidth="\d+"/.test(tag)&&/\bheight="\d+"/.test(tag));}
}
for (const [source,destination] of Object.entries(allow.staticCopies)) if (destination.endsWith('.md')) {
  const text = await read(source);
  for (const [,target] of text.matchAll(/\]\(([^)#]+)\)/g)) if (!/^https?:/.test(target)) await access(resolve(root,'dist',dirname(destination),target));
}

const input = JSON.parse(await read('public/demos/d01/start-data.json'));
const example = JSON.parse(await read('public/results/d01-explanation.json'));
const [[a,b],[c,d]] = input.matrix, [r,s] = input.rhs;
const determinant = a*d-b*c;
assert.notEqual(determinant,0);
assert.equal((r*d-b*s)/determinant,example.solution.x);
assert.equal((a*s-r*c)/determinant,example.solution.y);
const residual = input.matrix.map((row,i)=>row[0]*example.solution.x+row[1]*example.solution.y-input.rhs[i]);
assert.deepEqual(residual,example.residual);
assert.equal(Math.hypot(...residual),example.euclideanNorm);
assert.equal(3*(9/5)+(8/5),7);
assert.equal((9/5)+2*(8/5),5);
const csv = (await read('public/materials/d02-start.csv')).trim().split('\n').slice(1).map(line=>line.split(','));
assert.equal(csv.length,8);
const mean = group => { const rows = csv.filter(row=>row[1]===group); return rows.reduce((sum,row)=>sum+Number(row[2]),0)/rows.length; };
assert.equal(mean('old'),3.5); assert.equal(mean('new'),4.5);
const observations = (await read('public/materials/d04-observations.tsv')).trim().split('\n').slice(1).map(line=>line.split('\t').map(Number));
assert.equal(observations.length,13);
for (const [t,x] of observations) assert(Math.abs(Math.exp(-t/2)*Math.cos(t)-x)<1e-15);
const status = JSON.parse(await read('content/site.json'));
assert.equal(status.demos.find(demo=>demo.id==='D02').developmentStage,'検証中');
assert(status.demos.every(demo=>demo.media===null && demo.verificationKind.includes('読取照合')));
console.log(`Checked ${allow.repositoryFiles.length} source files, ${allow.deployedFiles.length} deploy files, ${linkCount} HTML links, selected material hashes and independent arithmetic. No private patterns found.`);

const numericProvenance=JSON.parse(await read('public/results/v1/provenance.json'));
for(const [path,expected]of Object.entries(numericProvenance.publicFileHashes))assert.equal(sha(await readFile(resolve(root,'public/results/v1',path))),expected);
const linearInputs=JSON.parse(await read('public/results/v1/d01-inputs.json'));
const linearResults=JSON.parse(await read('public/results/v1/d01-results.json'));
for(const input of linearInputs.cases){const result=linearResults.cases.find(r=>r.case===input.case);const [x,y]=result.solution;const residual=input.matrix.map((row,i)=>row[0]*x+row[1]*y-input.rhs[i]);assert(residual.every(v=>Math.abs(v)<1e-14));assert.equal(result.residualL2Norm,0);}
const sdof=JSON.parse(await read('public/results/v1/d04-results.json'));
const sdofInput=JSON.parse(await read('public/results/v1/d04-inputs.json'));
const series=(await read('public/results/v1/d04-series.csv')).trim().split('\n').slice(1).map(line=>{const [series,t,x]=line.split(',');return {series,t:Number(t),x:Number(x)};});
assert.equal(series.length,52);assert.equal(new Set(series.map(r=>r.series)).size,4);
for(const candidate of sdof.comparison.candidates){const rows=series.filter(r=>r.series===candidate.candidateId);assert.equal(rows.length,13);assert.equal(Math.max(...rows.map(r=>Math.abs(r.x))),candidate.sampledMaxAbsDisplacementM);}
const obs=series.filter(r=>r.series==='synthetic-observation');const fit=series.filter(r=>r.series==='identified-response');
assert.equal(obs.length,13);for(let i=0;i<13;i++){assert.equal(obs[i].t,fit[i].t);assert.equal(obs[i].x,sdofInput.identification.observations.displacementM[i]);}
const rmse=Math.sqrt(obs.reduce((sum,r,i)=>sum+(fit[i].x-r.x)**2,0)/13);assert(Math.abs(rmse-sdof.identification.rmseM)<1e-25);
const defs=JSON.parse(await read('content/capabilities.json')).groups.flatMap(g=>g.definitions);
assert.equal(defs.length,22);assert.equal(new Set(defs.map(d=>d.ref)).size,22);
const acceptance=JSON.parse(await read('public/results/v1/acceptance.json'));assert.equal(acceptance.ordinaryAiChatConnectedForTheseInputsAtCollection,false);assert.equal(acceptance.KBasePublicKnowledge,'concept');
console.log('Verified 52 selected waveform points, exact reported sampled maxima/RMSE and 22 unique declarations.');
