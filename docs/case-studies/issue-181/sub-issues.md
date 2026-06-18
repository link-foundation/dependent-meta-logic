# Sub-issue plan — Issue #181

Issue #181 says:

> Plan sub-issues in this pull request to fully implement our vision, they all
> will be merged to this pull request.

This file is that plan (requirement **R13**). It splits the work into four phases
with self-contained, independently shippable sub-issues, each with a paste-ready
body and acceptance criteria. The phases:

- **Phase MX** — adopt `meta-language` for representation, parsing, manipulation,
  translation (R1–R5). Design: [`meta-language-integration.md`](./meta-language-integration.md).
- **Phase ST** — the strategy/tactic combinator library (R6). Design:
  [`strategy-library.md`](./strategy-library.md).
- **Phase QC** — beat competitors, with evidence in the comparison docs (R7).
- **Phase DOC** — documentation, tutorial, examples.

This case-study PR (#182) delivers the **plan only**. Implementation lands in
per-phase PRs. Following the precedent of [issue #138](../issue-138/) and the
parity epic [issue #95](../issue-95/), the GitHub issues themselves are **not
auto-created here** — creating issues is an outward-facing action; a maintainer
(or an explicitly authorised assistant run) files them from the bodies below.

## Dependency graph

```
MX1 (audit) ──► MX2 (dialect/representation) ──► MX3 (manipulation) ──► MX4 (translation)
                      │                                  │
                      └────────► ST1 (core combinators) ─┴─► ST2 (rewrite strategies)
                                       │                       ST3 (tactic strategies)
                                       └─► ST4 (surface syntax) ─► ST5 (depth/fuel + auto)
ST2,ST3,ST5 ──► QC1 (comparison evidence) ──► QC2 (benchmarks) ──► QC3 (scoreboard update)
all ──► DOC1 (concepts) ─► DOC2 (tutorial) ─► DOC3 (examples + parity audit)
```

Parallelisable once MX2 lands: ST1 can start as soon as MX1's audit confirms the
representation; QC depends on ST; DOC trails everything.

---

## Phase MX — meta-language adoption

### MX1 — Audit: can meta-language represent every RML construct?

**Body.** Map every RML construct to a `meta-language` link shape and list gaps,
to confirm meta-language is "extensible and feature-rich enough" (R3).
- Enumerate constructs from [`lib/self/foundations.lino`](../../../lib/self/foundations.lino),
  the Rust `Node` shapes ([`rust/src/lib.rs:418`](../../../rust/src/lib.rs#L418)),
  proof terms, truth ranges, valence, operators.
- For each, give the meta-language representation (`LinkNetwork` shape) or mark it
  a gap; for each gap pick: extend RML dialect / upstream request / RML overlay.
- Reconcile RML truth ranges with meta-language `ProbabilisticTruthValue`.
**Acceptance:** a construct→representation table committed under
`docs/case-studies/issue-181/`; every gap has a decision; no code change.
**Depends on:** none. **Size:** M.

### MX2 — RML dialect + network-backed representation (R2, R4)

**Body.** Add a `MetaLang` façade and register an RML `LanguageParser` in
meta-language's `ParserRegistry`; parsing RML yields a `LinkNetwork` whose lossless
layer reconstructs the original bytes and whose AbstractSyntax projection equals
today's `Node`/JS-AST. Representation becomes network-backed; the old AST is a
projection. Ships **opt-in** (`--via-meta-language`).
- Rust: `cargo add meta-language` (pin exact 0.45.0), implement the façade.
- JS: implement the façade behind the bridge chosen in §JS-bridge below.
**Acceptance:** round-trip `reconstruct_text(parse(x)) == x` for all `examples/`
and `lib/` files; AbstractSyntax projection equals current parse on the test
corpus; full existing suite green with and without the flag; JS/Rust parity test.
**Depends on:** MX1, JS-bridge decision. **Size:** L.

### MX3 — Manipulation via meta-language query/rewrite (R5)

**Body.** Re-express RML matching/rewriting through meta-language, behind existing
function names (non-breaking):
- `matchProofPattern` → `LinkQuery` + captures.
- assigned-infix + eval-nat rewrites → `SubstitutionRule`/`find`/`replace`.
**Acceptance:** the existing matcher/rewrite tests pass against the meta-language
backend; behaviour identical JS vs Rust; old hand-written matchers removed only
after the new ones pass the same tests. **Depends on:** MX2. **Size:** L.

### MX4 — Translation via projections (R1)

**Body.** Route RML ⇄ host-language conversion through meta-language's network +
tree-sitter grammars + `projected_links()`, converging with the CST converter epic
([issue #138](../issue-138/)). Re-express the existing Lean/Rocq exporters as
projections/printers over the shared network.
**Acceptance:** existing export goldens still pass via the new path; at least one
round-trip demo (host → network → host) with a regression test.
**Depends on:** MX2; coordinate with [issue #138](../issue-138/). **Size:** L.

### JS-bridge (sub-task of MX2) — give JS access to meta-language

**Body.** meta-language has **no npm package** (404). Implement the `MetaLang`
façade for JS via, in priority order: (B) request/await an upstream wasm/napi npm
publish; (A) a wasm façade of the minimal surface; (D) a minimal JS port over
`links-notation` as fallback. Avoid (C) subprocess for the library path. Full
analysis: [`meta-language-integration.md` §5](./meta-language-integration.md#5-js-integration-options).
**Acceptance:** JS façade passes the same conformance corpus as the Rust crate.
**Size:** L (the riskiest task — see risks doc Q1).

---

## Phase ST — strategy/tactic combinator library (R6)

### ST1 — Core combinator algebra (JS + Rust)

**Body.** Implement the kernel from
[`strategy-library.md` §4](./strategy-library.md#4-the-core-combinator-algebra):
`id`, `fail`, `seq`, `lchoice` (`<+`), `choice` (`+`), `rec`, `all`, `one`, `some`
— identically in `js/src/strategy.mjs` and `rust/src/strategy.rs`, with a shared
JSON conformance corpus.
**Acceptance:** conformance corpus passes in both; property tests for the algebraic
laws (`seq(id,s)=s`, `lchoice(fail,s)=s`, etc.). **Depends on:** MX1. **Size:** M.

### ST2 — Term-rewriting strategies over meta-language

**Body.** Add the derived traversal library (`try`, `repeat`, `topdown`,
`bottomup`, `innermost`, `oncetd`, `oncebu`, `alltd`, `outermost`) and the
`apply(rule)` leaf that fires a `SubstitutionRule` via MX3.
**Acceptance:** `innermost(add-zero <+ mul-one)` normalises the worked examples;
JS/Rust parity. **Depends on:** ST1, MX3. **Size:** M.

### ST3 — Proof/tactic strategies

**Body.** Lift existing tactics (`reflexivity`, `rewrite`, `induction`, …,
[`_applyTactic`:3986](../../../js/src/rml-links.mjs#L3986)) to leaf strategies and
add goal combinators `all_goals`, `any_goals`, `first`, `solve`, `progress`,
`do(n,·)`.
**Acceptance:** multi-goal proofs that previously needed manual scripting close
with one combinator expression; soundness unchanged (only schedules certified
steps, N6). **Depends on:** ST1. **Size:** M.

### ST4 — Surface syntax in the RML dialect

**Body.** Parse strategy expressions in the RML dialect (via meta-language, R4),
both the `(seq …)` form and the operator sugar (`;`, `<+`, `try`, `repeat`). A
strategy is itself a meta-language network (so it is queryable/rewritable, R5).
**Acceptance:** strategies can be defined in `.lino`, loaded, and applied via the
CLI. **Depends on:** ST1, MX2. **Size:** M.

### ST5 — Search-depth/fuel controls + `auto`

**Body.** Add fuel/depth bounds to every non-terminating combinator and the CLI
flags (`--max-steps`, `--depth`, `--fuel`); ship a high-leverage `auto` strategy
(`first` + `repeat` + rewrite-DB + fuel). Closes
[`docs/FEATURE-COMPARISON.md:60`](../../FEATURE-COMPARISON.md) ("Search depth
controls = No").
**Acceptance:** bounded strategies terminate deterministically; `auto` solves a
benchmark set; no CI hang possible. **Depends on:** ST2, ST3. **Size:** M.

---

## Phase QC — beat competitors, with evidence (R7)

### QC1 — Upgrade the comparison docs with evidence

**Body.** For each cell the new features change — FC:56/57/58/59/**60**,
CC:179/180/181 — update [`docs/FEATURE-COMPARISON.md`](../../FEATURE-COMPARISON.md)
and [`docs/CONCEPTS-COMPARISON.md`](../../CONCEPTS-COMPARISON.md) from "Part"/"No"
to "Yes", each citing the new feature and its tests.
**Acceptance:** every upgraded cell links to a feature + a test. **Depends on:**
ST5. **Size:** S.

### QC2 — Benchmark vs competitors

**Body.** A small benchmark suite comparing RML's `auto`/`simplify`/rewrite
strategies against equivalent Lean/Rocq/Isabelle tactic scripts on shared problems
(arithmetic normalisation, equational rewriting, simple proof search), recorded
under `docs/case-studies/issue-181/benchmarks/`.
**Acceptance:** reproducible benchmark script + results table. **Depends on:** ST5.
**Size:** M.

### QC3 — "Quality" hardening

**Body.** Fuzz the strategy engine (random rule sets, random terms) for
termination/soundness; add the strategy conformance + benchmark jobs to CI.
**Acceptance:** fuzz job green in CI; conformance + benchmark gates added.
**Depends on:** QC1, QC2. **Size:** M.

---

## Phase DOC — documentation, tutorial, examples

### DOC1 — Concepts page for strategies & meta-language

**Body.** `docs/STRATEGIES.md` (the combinator reference) and a
`docs/META-LANGUAGE.md` (how RML uses meta-language), linked from `README.md`.
**Acceptance:** both pages exist and are linked. **Depends on:** ST4, MX2. **Size:** S.

### DOC2 — Tutorial

**Body.** `docs/tutorials/strategies.md`: from a single rule to `auto`, with
runnable snippets. **Acceptance:** every snippet runs in CI. **Depends on:** DOC1.
**Size:** S.

### DOC3 — Examples + parity audit

**Body.** Add `examples/strategy-*.lino` exercised by tests in both
implementations; extend the [issue #167](../issue-167/)-style parity audit to the
new modules. **Acceptance:** examples run in JS and Rust; parity audit updated.
**Depends on:** ST2–ST5. **Size:** S.

---

## Summary table

| ID | Title | Phase | Depends on | Size |
|----|-------|-------|-----------|------|
| MX1 | meta-language coverage audit | MX | — | M |
| MX2 | RML dialect + network representation | MX | MX1, JS-bridge | L |
| MX3 | Manipulation via query/rewrite | MX | MX2 | L |
| MX4 | Translation via projections | MX | MX2, #138 | L |
| JS-bridge | JS access to meta-language (wasm/port) | MX | MX1 | L |
| ST1 | Core combinator algebra | ST | MX1 | M |
| ST2 | Term-rewriting strategies | ST | ST1, MX3 | M |
| ST3 | Proof/tactic strategies | ST | ST1 | M |
| ST4 | Surface syntax | ST | ST1, MX2 | M |
| ST5 | Depth/fuel + `auto` | ST | ST2, ST3 | M |
| QC1 | Comparison-doc evidence | QC | ST5 | S |
| QC2 | Benchmarks vs competitors | QC | ST5 | M |
| QC3 | Quality hardening (fuzz + CI) | QC | QC1, QC2 | M |
| DOC1 | Concepts pages | DOC | ST4, MX2 | S |
| DOC2 | Tutorial | DOC | DOC1 | S |
| DOC3 | Examples + parity audit | DOC | ST2–ST5 | S |
