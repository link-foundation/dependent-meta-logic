# meta-language integration design — Issue #181

This document designs how RML adopts
[`link-foundation/meta-language`](https://github.com/link-foundation/meta-language)
for **(R1)** language-translation logic, **(R2)** representation of meta-logic
expressions, **(R4)** parsing in the RML dialect, and **(R5)** doing all
expression manipulation through it. It is implemented by Phase **MX** in
[`sub-issues.md`](./sub-issues.md). All package facts are verified in
[`data/online-research.md`](./data/online-research.md) (latest update:
2026-06-28).

## Table of contents

1. [The two pillars the issue asks for](#1-the-two-pillars)
2. [What meta-language gives us](#2-what-meta-language-gives-us)
3. [What RML uses today (the starting point)](#3-what-rml-uses-today)
4. [Current package state and residual upstream gaps](#4-current-package-state-and-residual-upstream-gaps)
5. [JS integration options (decision)](#5-js-integration-options)
6. [Representation: the RML dialect as a meta-language network](#6-representation)
7. [Manipulation: query and rewrite through meta-language](#7-manipulation)
8. [Translation: host languages via projections](#8-translation)
9. [Migration strategy (non-breaking)](#9-migration-strategy)
10. [Risks specific to integration](#10-risks)

---

## 1. The two pillars

The issue's first paragraph asks for two distinct things, often conflated:

- **Representation (R2):** "representation of the meta logic expressions
  themselves … use meta-language". RML's *internal data structure* for an
  expression should be (or be backed by) a meta-language `LinkNetwork`.
- **Translation (R1):** "for language translation logic … use meta-language".
  Converting RML ⇄ other languages should go through meta-language's lossless
  network + projections, not a bespoke exporter stack.

Plus two process clauses:

- **Dialect (R4):** "prefer parsing in our dialect of meta language" — RML's
  surface syntax becomes a *registered dialect/parser* feeding the same network.
- **Manipulation (R5):** "do all expressions manipulation in that way" — matching
  and rewriting go through meta-language's query/codemod API.

## 2. What meta-language gives us

From the verified README/crate (see [`data/online-research.md`](./data/online-research.md) §1):

| Capability | API surface | Serves |
|------------|-------------|--------|
| Lossless representation | `LinkNetwork`, `parse()` (lossless default), `parse_lossless_text()`, `reconstruct_text()` (byte-for-byte) | R2, N4 |
| Projections | `projected_links()`, `NetworkProjection::{AbstractSyntax, …}` ("concrete syntax, abstract syntax, or semantic-only") | R1, R5 |
| Structural query | `LinkQuery` (tree-sitter-query-style S-expressions, captures, host predicates) | R5 |
| Codemod | `find()` / `replace()` (preserve unchanged bytes); `SubstitutionRule` / `apply_substitution()` | R5, R6 substrate |
| Many-valued truth | `TruthValue`, fixed-point `ProbabilisticTruthValue` | matches RML semantics |
| LiNo parsing | doublets, triplets, named links, indented defs, self-references; built on `links-notation 0.13` | R4 |
| Host grammars | `tree-sitter 0.25.8` + grammar crates | R1 |
| Optional storage | `doublets 0.4` backend (feature-gated) | scale |

Crucially, meta-language sits on **the same `links-notation 0.13`** RML already
uses, and its `ProbabilisticTruthValue` matches RML's probabilistic truth model —
so adoption is an *overlay*, not a rewrite of RML's semantics.

## 3. What RML used before this overlay

- JS: `import { Parser } from 'links-notation'`
  ([`js/src/rml-links.mjs:17`](../../../js/src/rml-links.mjs#L17)); expressions are
  nested JS arrays/objects from the LiNo parser.
- Rust: `links_notation::parse_lino_to_links` → `pub enum Node { Leaf(String),
  List(Vec<Node>) }` ([`rust/src/lib.rs:418`](../../../rust/src/lib.rs#L418));
  `links-notation = "0.13.0"` ([`rust/Cargo.toml:25`](../../../rust/Cargo.toml#L25)).
- Manipulation is hand-written over those structures: `matchProofPattern`
  ([:2214](../../../js/src/rml-links.mjs#L2214)), `instantiateProofPattern`
  (:2347), eval-nat rules (:2317), `_applyTactic` (:3986).
- Before PR #182's overlay, meta-language appeared **nowhere** in the codebase.
  This PR adds the first JS/Rust façade modules and parity tests, while the old
  AST and matchers remain the compatibility path until MX2/MX3.

So integration means inserting meta-language *under* RML's `Node`/AST as the
representation and *beside* the hand-written matchers as the manipulation engine.

## 4. Current package state and residual upstream gaps

> **Updated 2026-06-28.** This section originally read: "`meta-language` is
> **Rust-only**: `registry.npmjs.org/meta-language` returns **404** … the JS side
> cannot `import` it. Every integration plan below is dominated by this fact."
> **That is no longer true.**

meta-language now ships a **first-class JavaScript implementation with enforced
Rust↔JS parity** and is published to npm as `meta-language` v0.46.0. The current
Rust crate is v0.49.0. Both are built (like RML) on **`links-notation 0.13`**,
with a `check:parity` gate run by both `js.yml` and `rust.yml` (upstream issue
[#163](https://github.com/link-foundation/meta-language/issues/163), closed
2026-06-21). An empirical readiness check
([`experiments/issue-181-meta-language-js-smoke.mjs`](../../../experiments/issue-181-meta-language-js-smoke.mjs),
**9 PASS / 2 GAP / 0 FAIL**) confirms the package covers RML's representation,
lossless round-trip, structural query/replace, substitution, translation-rule
rendering, and many-valued/probabilistic truth needs. Full evidence is in
[`data/online-research.md` §5](./data/online-research.md#5-update-2026-06-21--meta-language-now-has-a-javascript-implementation).

Three upstream items remain, **none a blocker for the two pillars** (all filed as
requested by the maintainer):

- **Release lockstep:** Rust is at v0.49.0 while npm latest is v0.46.0 →
  upstream [#171](https://github.com/link-foundation/meta-language/issues/171).
- **Translation-rule serialization parity:** Rust `TranslationRuleSet::to_lino`
  uses canonical LiNo networks while JS `toLino()` currently serializes JSON →
  upstream [#172](https://github.com/link-foundation/meta-language/issues/172).
- **Token naming parity:** Rust names the lossless token link type `Token`, while
  JavaScript names it `SourceToken` → upstream
  [#173](https://github.com/link-foundation/meta-language/issues/173).

The earlier packaging and truth-value blockers are resolved: upstream
[#165](https://github.com/link-foundation/meta-language/issues/165) is closed by
the npm publication, and [#166](https://github.com/link-foundation/meta-language/issues/166)
is closed by JavaScript `TruthValue` / `ProbabilisticTruthValue` support.

## 5. JS integration: the chosen path

With a real JS implementation upstream, the four-way bridge analysis below is now
mostly historical — **Option D's goal (a pure-JS surface over `links-notation`)
has been realised upstream**, so RML neither builds a wasm façade nor ports a
kernel itself. RML now **depends on the npm `meta-language` package directly**,
behind a thin `MetaLang` façade so upstream version skew or naming aliases can be
isolated from call sites.

| Option | Status as of 2026-06-28 |
|--------|--------------------------|
| **A. WASM build** of the Rust crate | **Not needed** — a native JS implementation exists; no wasm pipeline / `tree-sitter`/`doublets` wasm concerns. |
| **B. Upstream npm publish** | **Done** — RML depends on `meta-language` from npm. Release lockstep is tracked separately by upstream [#171](https://github.com/link-foundation/meta-language/issues/171). |
| **C. Subprocess/CLI bridge** | **Avoided** (as before) — breaks browser/pure-JS use; keep only as a diagnostic escape hatch. |
| **D. JS port of the needed subset** | **Realised upstream** — meta-language now *is* a JS package over `links-notation`, with a `check:parity` gate guarding drift, so RML does not maintain its own port. |

The interface RML codes against is still defined once (a `MetaLang` façade:
`parse(text, language) -> Network`, `query(net, q) -> matches`,
`replace(net, matches, rule) -> Network`, `substitute(net, rule) -> Network`,
`reconstruct(net) -> text`) so release skew, token naming parity, or future
translation-rule serialization changes never touch RML call sites.

**Ingestion detail (verified empirically).** RML's *named* LiNo is ingested with
the lossless parser `LinkNetwork.parse(text, language, config)` (byte-for-byte
`reconstructText()`), **not** `fromLino()`. `fromLino()` is the inverse of
`toLino()` and only accepts the canonical numeric-id schema (`(1: 2 3)`), matching
Rust's `from_lino` contract — documented behaviour, not a limitation for RML.

## 6. Representation: the RML dialect as a meta-language network

- **MX1 (audit):** map every RML construct (root constructs / foundations in
  [`lib/self/foundations.lino`](../../../lib/self/foundations.lino), the `Node`
  shapes, proof terms, truth ranges, valence, operators) to a meta-language link
  shape, and record any construct meta-language cannot yet represent. This decides
  whether meta-language is truly "feature-rich enough" (the issue's own hedge) or
  needs upstream extensions.
- **MX2 (dialect):** register an RML `LanguageParser` in meta-language's
  `ParserRegistry` so that parsing RML source yields a meta-language network whose
  lossless layer reconstructs the original bytes (`reconstruct_text()`), and whose
  AbstractSyntax projection equals today's `Node` tree. ("Prefer parsing in our
  dialect", R4.)
- The RML `Node`/JS-AST becomes a **projection** of the network, not the source of
  truth — giving RML losslessness and CST-compatibility (N4, converging with
  [issue #138](../issue-138/)) for free.

## 7. Manipulation: query and rewrite through meta-language

- **MX3:** re-express RML's matching/rewriting in terms of meta-language:
  - `matchProofPattern` → `LinkQuery` with captures.
  - assigned-infix rewrite + eval-nat rules → `SubstitutionRule` /
    `apply_substitution` (or `find`/`replace`).
  - the strategy library (Phase ST) calls these as its leaf operations
    ([`strategy-library.md` §6](./strategy-library.md#6-two-domains)).
- This is the literal reading of "do all expressions manipulation in that way"
  (R5). It is done behind RML's existing function names first (keep `matchProofPattern`
  as a thin wrapper) so the change is non-breaking (N2).

## 8. Translation: host languages via projections

- **MX4:** route RML ⇄ host-language conversion through meta-language's lossless
  network + tree-sitter grammars + projections, **converging with the CST
  converter epic** ([issue #138](../issue-138/)) rather than building a second
  stack (N4). RML's existing one-way exporters (`docs/LEAN_EXPORT.md`,
  `docs/ROCQ-EXPORT.md`) become projections/printers over the shared network.
- This is "language translation logic … use meta-language" (R1).

## 9. Migration strategy (non-breaking)

To protect the existing test suite and dual-implementation parity (N1, N2):

1. Land the **`MetaLang` façade interface** + both dependencies first — the Rust
   crate (`meta-language` v0.49.0 on crates.io) and the JS package
   (`meta-language` v0.46.0 on npm) — both no-ops until wired.
2. Make the network representation **opt-in** (`rml … --via-meta-language`) and run
   the full suite both ways in CI until parity is proven, then flip the default.
3. Keep `Node`/JS-AST as the AbstractSyntax projection so all existing code paths
   keep compiling; delete hand-written matchers only after `LinkQuery`-based ones
   pass the same tests.
4. Pin/bump `meta-language` deliberately on both sides (Rust v0.49.0, JS
   `^0.46.0` in this PR), like RML already pins `links-notation 0.13.0`; track
   upstream release lockstep in [#171](https://github.com/link-foundation/meta-language/issues/171).

## 10. Risks

The integration-specific risks (full register in
[`risks-and-open-questions.md`](./risks-and-open-questions.md)):

- **No npm package** (was the dominant risk) → **resolved 2026-06-28**:
  `meta-language` is available from npm and RML depends on it directly.
- **meta-language maturity** (young, 1 star) → MX1 audit gates adoption; pin exact
  versions (crate + JS) and keep the façade so we can swap implementations.
- **Release skew and API naming gaps** — upstream [#171](https://github.com/link-foundation/meta-language/issues/171),
  [#172](https://github.com/link-foundation/meta-language/issues/172), and
  [#173](https://github.com/link-foundation/meta-language/issues/173) are tracked
  as non-blocking façade concerns.
- **Truth semantic reconciliation** — meta-language now exposes
  `ProbabilisticTruthValue` in Rust and JS, but MX1 still decides exactly how RML
  maps its truth ranges before delegating semantics.
- **Double maintenance** is **no longer a concern** — RML does not maintain a JS
  port; the upstream `check:parity` gate guards Rust↔JS drift for us.
