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

const html = await read('dist/index.html');
assert(html.includes('<html lang="ja">'));
assert(html.includes('name="viewport"'));
assert(html.includes('Content-Security-Policy'));
assert(!/<(?:script|form|iframe)\b/i.test(html), 'Static site contains executable/collection embeds');
assert.equal((html.match(/<h1\b/g)||[]).length, 1);
assert(html.includes('class="skip-link"'));
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(ids).size, ids.length, 'Duplicate HTML IDs');
const hrefs = [...html.matchAll(/\b(?:href|src)="([^"]+)"/g)].map(match => match[1]);
for (const target of hrefs) {
  if (/^https:\/\//.test(target)) { assert.equal(target, 'https://github.com/masayukisobe/mathlang-web', 'Unexpected external link'); continue; }
  if (target.startsWith('#')) { assert(ids.includes(target.slice(1)), `Missing anchor ${target}`); continue; }
  assert(!target.startsWith('/'), `Project Pages link must be relative: ${target}`);
  await access(resolve(root, 'dist', target));
}
for (const tag of html.match(/<img\b[^>]*>/g)||[]) {
  assert(/\balt="[^"]*"/.test(tag), 'Missing image alternative');
  assert(/\bwidth="\d+"/.test(tag) && /\bheight="\d+"/.test(tag), 'Image dimensions missing');
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
console.log(`Checked ${allow.repositoryFiles.length} source files, ${allow.deployedFiles.length} deploy files, ${hrefs.length} HTML links, 7 selected materials and independent arithmetic. No private patterns found.`);
