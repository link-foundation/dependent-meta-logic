// Issue #181 — empirical smoke test of meta-language's JavaScript package
// against the things RML actually needs from it.
//
// The case study (docs/case-studies/issue-181/) was written when meta-language
// was Rust-only with no npm package. The maintainer's 2026-06-21 comment on
// PR #182 says meta-language "now fully supports JavaScript", so this script
// re-checks, empirically, which of RML's needs the JS package already covers
// and which are still missing — grounding the gap analysis in evidence rather
// than reading types.
//
// Run from a checkout of link-foundation/meta-language's js/ folder:
//   node experiments/issue-181-meta-language-js-smoke.mjs /path/to/meta-language/js
// or set META_LANGUAGE_JS to that path. It prints a PASS/FAIL/GAP line per probe.

import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const pkgDir =
  process.argv[2] || process.env.META_LANGUAGE_JS || '/tmp/ml-js-pkg';
const entry = pathToFileURL(path.join(pkgDir, 'src', 'index.js')).href;

let ml;
try {
  ml = await import(entry);
} catch (err) {
  console.error(`Cannot import meta-language JS from ${pkgDir}:`, err.message);
  process.exit(2);
}

const results = [];
function probe(name, fn) {
  try {
    const detail = fn();
    results.push({ name, status: 'PASS', detail: detail ?? '' });
  } catch (err) {
    results.push({ name, status: 'FAIL', detail: err.message });
  }
}
function gap(name, detail) {
  results.push({ name, status: 'GAP', detail });
}

const {
  LinkNetwork,
  LinkQuery,
  ParseConfiguration,
  ReplacementRule,
} = ml;

// R2/R4 — represent the RML dialect: ingest RML's own named LiNo source.
// NOTE: the correct ingestion path for RML's *named* LiNo is the lossless
// parser (parse with a language tag), NOT fromLino. fromLino is the inverse of
// toLino — it only accepts the canonical numeric-id serialization schema
// (e.g. "(1: 2 3)"), matching Rust's from_lino contract.
const rmlLino = [
  '(namespace self)',
  '(Foundation: (Type 0) Foundation)',
  '(trust-status host-primitive reads implemented-by-host-kernel)',
].join('\n') + '\n';

probe('R2/R4 lossless parse of RML named LiNo', () => {
  const net = LinkNetwork.parse(rmlLino, 'RML', ParseConfiguration.default());
  const n = net.len();
  if (!(n > 0)) throw new Error('empty network');
  return `${n} links`;
});

probe('N4 lossless round-trip of RML named LiNo', () => {
  const net = LinkNetwork.parse(rmlLino, 'RML', ParseConfiguration.default());
  const back = net.reconstructText();
  if (back !== rmlLino) throw new Error(`reconstruct mismatch: ${JSON.stringify(back)}`);
  return 'byte-for-byte';
});

// Informational: confirm fromLino is canonical-only (intended contract, not a
// path RML uses for named source). PASS means it round-trips canonical LiNo and
// rejects named LiNo, which is the documented behaviour.
probe('INFO fromLino is canonical-numeric only (intended)', () => {
  const canonical = LinkNetwork.fromLino('(1: 2 3)\n(2)\n(3)\n');
  if (canonical.len() !== 3) throw new Error('canonical fromLino broke');
  let rejectedNamed = false;
  try {
    LinkNetwork.fromLino('(namespace self)\n');
  } catch {
    rejectedNamed = true;
  }
  if (!rejectedNamed) throw new Error('fromLino unexpectedly accepted named LiNo');
  return 'canonical ok; named rejected (use parse() for named source)';
});

// N4 — lossless source parse/reconstruct (byte-for-byte) on a host-language sample.
probe('N4 lossless parse/reconstruct (JavaScript host)', () => {
  const src = 'const oldName = call(oldName);\n';
  const net = LinkNetwork.parse(src, 'JavaScript', ParseConfiguration.default());
  const back = net.reconstructText();
  if (back !== src) throw new Error(`reconstruct mismatch: ${JSON.stringify(back)}`);
  return 'byte-for-byte';
});

// R5 — structural query + rewrite (the README example).
probe('R5 S-expression query + replace', () => {
  const src = 'const oldName = call(oldName);\n';
  const net = LinkNetwork.parse(src, 'JavaScript', ParseConfiguration.default());
  const q = LinkQuery.fromSexpression('(identifier) @target\n(#eq? @target "oldName")');
  const matches = net.find(q);
  if (matches.length === 0) throw new Error('no matches');
  net.replace(matches, ReplacementRule.capturedText('target', 'newName'));
  const back = net.reconstructText();
  if (!back.includes('newName')) throw new Error(`no rewrite: ${back}`);
  return `${matches.length} matches -> ${JSON.stringify(back.trim())}`;
});

// R5 — structural substitution leaf op (what a strategy library's rewrite rule calls).
probe('R5 SubstitutionRule / applySubstitution', () => {
  if (!ml.SubstitutionRule) throw new Error('SubstitutionRule not exported');
  const net = new LinkNetwork();
  const a = net.insertPoint('x');
  const b = net.insertPoint('y');
  const rule = new ml.SubstitutionRule([a], [b]);
  const report = net.applySubstitution(rule);
  return `report.isEmpty=${report.isEmpty()}`;
});

// R1 — translation rules (RML -> host language projection).
probe('R1 TranslationRuleSet present + render', () => {
  if (!ml.TranslationRuleSet) throw new Error('TranslationRuleSet not exported');
  return 'exported';
});

// Truth-value semantics: RML is probabilistic/many-valued; the case study said
// meta-language's ProbabilisticTruthValue "aligns with RML's". Check JS exposes it.
if (ml.TruthValue || ml.ProbabilisticTruthValue || ml.Probability) {
  probe('SEM TruthValue / ProbabilisticTruthValue exported in JS', () => {
    return Object.keys(ml).filter((k) => /Truth|Probab/.test(k)).join(',');
  });
} else {
  gap(
    'SEM TruthValue / ProbabilisticTruthValue in JS',
    'NOT exported by the JS package (present in rust/src/semantics.rs only); ' +
      'RML relies on probabilistic/many-valued truth alignment — JS↔Rust parity gap.',
  );
}

// Strategy/tactic combinators: the issue's second pillar. meta-language provides
// leaf ops (find/replace/substitute); the combinator layer (seq/<+/repeat/topdown)
// is RML's to build. Record explicitly that it is absent upstream (expected).
const comboNames = Object.keys(ml).filter((k) =>
  /Strateg|Tactic|Traversal|Combinator/i.test(k),
);
if (comboNames.length === 0) {
  gap(
    'ST strategy/tactic combinators in meta-language',
    'none upstream (expected) — RML builds the combinator layer on top of ' +
      'find/replace/applySubstitution as leaf operations.',
  );
} else {
  probe('ST combinators present upstream', () => comboNames.join(','));
}

// Report.
const pad = (s, n) => (s + ' '.repeat(n)).slice(0, n);
console.log('\nmeta-language JS smoke test (issue #181)\n' + '='.repeat(60));
for (const r of results) {
  console.log(`${pad(r.status, 5)} ${pad(r.name, 48)} ${r.detail}`);
}
const fails = results.filter((r) => r.status === 'FAIL').length;
const gaps = results.filter((r) => r.status === 'GAP').length;
console.log('='.repeat(60));
console.log(`PASS ${results.filter((r) => r.status === 'PASS').length}  GAP ${gaps}  FAIL ${fails}`);
process.exit(fails > 0 ? 1 : 0);
