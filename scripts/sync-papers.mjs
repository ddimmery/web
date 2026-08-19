#!/usr/bin/env node
/**
 * Sync src/data/papers.yaml with Semantic Scholar.
 *
 * A Node port of the Python that used to run inside research.qmd on every
 * Quarto build. Differences by design: this runs on a schedule (or on demand)
 * rather than during the site build, and it never touches entries that already
 * exist — it only *appends* papers whose `ssid` is not yet in the file.
 *
 * New entries are written with `visible: false`; flip that flag by hand once
 * the metadata has been checked and the paper should appear on /research/.
 *
 * Idempotent: running twice in a row makes no changes the second time.
 *
 * Usage:  npm run sync-papers  [-- --dry-run]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'yaml';

const AUTHOR_ID = '90810256';
const FIELDS = 'paperId,title,authors,year,venue,publicationDate,externalIds,openAccessPdf,url';
const API = `https://api.semanticscholar.org/graph/v1/author/${AUTHOR_ID}/papers`;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const yamlPath = join(root, 'src', 'data', 'papers.yaml');
const dryRun = process.argv.includes('--dry-run');

/** Field order for new entries — matches the hand-written ones in the file. */
const FIELD_ORDER = [
  'title',
  'authors',
  'year',
  'preprint',
  'published_url',
  'venue',
  'github',
  'data',
  'pdf_url',
  'visible',
  'ssid',
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchPapers() {
  const url = `${API}?fields=${encodeURIComponent(FIELDS)}&limit=1000`;
  const headers = {
    Accept: 'application/json',
    'User-Agent': 'ddimmery.com paper sync',
  };
  // Optional; the unauthenticated endpoint is aggressively rate limited.
  if (process.env.SEMANTIC_SCHOLAR_API_KEY) {
    headers['x-api-key'] = process.env.SEMANTIC_SCHOLAR_API_KEY;
  }

  let response;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    response = await fetch(url, { headers });
    if (response.ok) break;
    // 429/5xx are transient: back off and try again.
    if (response.status !== 429 && response.status < 500) break;
    if (attempt < 5) {
      const wait = 2 ** attempt * 1500;
      console.log(`  ${response.status} from Semantic Scholar; retrying in ${wait / 1000}s…`);
      await sleep(wait);
    }
  }

  if (!response.ok) {
    throw new Error(`Semantic Scholar returned ${response.status} ${response.statusText}`);
  }
  const body = await response.json();
  if (!Array.isArray(body?.data)) {
    throw new Error('Unexpected response shape from Semantic Scholar (no `data` array)');
  }
  return body.data;
}

function toEntry(paper) {
  const authors = (paper.authors ?? []).map((author) => {
    const name = author?.name ?? '';
    return name.includes('Dimmery') ? 'me' : name;
  });

  const externalIds = paper.externalIds ?? {};
  const entry = {
    title: paper.title ?? 'Untitled',
    authors: authors.length > 0 ? authors : ['me'],
    year: paper.year ?? null,
    venue: paper.venue ? paper.venue : null,
    visible: false,
    ssid: paper.paperId,
  };

  if (externalIds.DOI) entry.published_url = `https://doi.org/${externalIds.DOI}`;
  if (externalIds.ArXiv) entry.preprint = `https://arxiv.org/abs/${externalIds.ArXiv}`;
  if (paper.openAccessPdf?.url) entry.pdf_url = paper.openAccessPdf.url;

  // Reorder to the canonical field order for readability of the diff.
  const ordered = {};
  for (const key of FIELD_ORDER) {
    if (key in entry) ordered[key] = entry[key];
  }
  return ordered;
}

/** Same key scheme the Python version used, so keys stay predictable. */
function makeKey(paper, taken) {
  const titleKey = (paper.title ?? '')
    .toLowerCase()
    .replaceAll(' ', '_')
    .replaceAll(',', '')
    .replaceAll(':', '')
    .slice(0, 20);
  const year = paper.year ?? 'unknown';
  const base = `${titleKey}_${year}`;
  let key = base;
  let counter = 1;
  while (taken.has(key)) {
    key = `${base}_${counter}`;
    counter += 1;
  }
  return key;
}

async function main() {
  const original = await readFile(yamlPath, 'utf8');
  // parseDocument (rather than parse) keeps the existing nodes' formatting,
  // quoting and comments intact, so a sync only ever *adds* lines.
  const doc = parseDocument(original);
  const data = doc.toJS() ?? {};

  const existingIds = new Set(
    Object.values(data)
      .map((entry) => entry?.ssid)
      .filter(Boolean),
  );
  const keys = new Set(Object.keys(data));

  const papers = await fetchPapers();
  const added = [];

  for (const paper of papers) {
    if (!paper?.paperId || existingIds.has(paper.paperId)) continue;
    const key = makeKey(paper, keys);
    keys.add(key);
    existingIds.add(paper.paperId);
    doc.set(key, toEntry(paper));
    added.push({ key, title: paper.title, year: paper.year });
  }

  console.log(`Semantic Scholar returned ${papers.length} papers.`);

  if (added.length === 0) {
    console.log('No new papers. papers.yaml is unchanged.');
    return;
  }

  const output = doc.toString({
    lineWidth: 0, // never fold long titles or URLs
    indentSeq: false, // sequences sit flush with their key, as in the existing file
    nullStr: 'null',
  });

  if (dryRun) {
    console.log(`--dry-run: would add ${added.length} paper(s).`);
  } else {
    await writeFile(yamlPath, output);
  }

  console.log(`\nAdded ${added.length} paper(s) with visible: false —`);
  for (const item of added) {
    console.log(`  • [${item.year ?? 'n.d.'}] ${item.title}  (key: ${item.key})`);
  }
  console.log('\nReview each entry and set `visible: true` to publish it on /research/.');
}

main().catch((error) => {
  console.error(`sync-papers failed: ${error.message}`);
  process.exitCode = 1;
});
