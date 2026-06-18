# meta-language integration design — Issue #181

This document designs how RML adopts
[`link-foundation/meta-language`](https://github.com/link-foundation/meta-language)
for **(R1)** language-translation logic, **(R2)** representation of meta-logic
expressions, **(R4)** parsing in the RML dialect, and **(R5)** doing all
expression manipulation through it. It is implemented by Phase **MX** in
[`sub-issues.md`](./sub-issues.md). All package facts are verified in
[`data/online-research.md`](./data/online-research.md) (2026-06-18).

## Table of contents

1. [The two pillars the issue asks for](#1-the-two-pillars)
2. [What meta-language gives us](#2-what-meta-language-gives-us)
3. [What RML uses today (the starting point)](#3-what-rml-uses-today)
4. [The central constraint: no npm package](#4-the-central-constraint-no-npm-package)
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

## 3. What RML uses today

- JS: `import { Parser } from 'links-notation'`
  ([`js/src/rml-links.mjs:17`](../../../js/src/rml-links.mjs#L17)); expressions are
  nested JS arrays/objects from the LiNo parser.
- Rust: `links_notation::parse_lino_to_links` → `pub enum Node { Leaf(String),
  List(Vec<Node>) }` ([`rust/src/lib.rs:418`](../../../rust/src/lib.rs#L418));
  `links-notation = "0.13.0"` ([`rust/Cargo.toml:25`](../../../rust/Cargo.toml#L25)).
- Manipulation is hand-written over those structures: `matchProofPattern`
  ([:2214](../../../js/src/rml-links.mjs#L2214)), `instantiateProofPattern`
  (:2347), eval-nat rules (:2317), `_applyTactic` (:3986).
- meta-language appears **nowhere** in the codebase (verified by `grep`).

So integration means inserting meta-language *under* RML's `Node`/AST as the
representation and *beside* the hand-written matchers as the manipulation engine.

## 4. The central constraint: no npm package

`meta-language` is **Rust-only**: `registry.npmjs.org/meta-language` returns
**404** (verified 2026-06-18). RML must keep its JS and Rust implementations at
parity (N1; the discipline audited in [issue #167](../issue-167/)). Therefore the
Rust side can `cargo add meta-language` directly, but **the JS side cannot
`import` it**. Every integration plan below is dominated by this fact.

## 5. JS integration options

Four ways to give the JS implementation access to meta-language's capabilities,
with a recommendation:

| Option | How | Pros | Cons |
|--------|-----|------|------|
| **A. WASM build** | Compile meta-language (or a thin façade crate) to `wasm32` and ship an npm wrapper that loads the `.wasm`. | Single source of truth (the Rust crate); true parity; runs in Node and browser. | Build pipeline; `tree-sitter`/`doublets` may not be `wasm`-friendly → may need a reduced feature set; binary size. |
| **B. Upstream npm publish** | Ask `link-foundation/meta-language` to publish an napi-rs/wasm npm package. | Cleanest for consumers; mirrors `links-notation`'s dual crate+npm story (0.13 on both). | Out of RML's control; depends on upstream roadmap. |
| **C. Subprocess/CLI bridge** | JS shells out to a `meta-language` CLI binary for parse/query/rewrite. | Easy; full feature set. | Process overhead; binary must be installed; awkward in browser; breaks pure-JS deployments. |
| **D. JS port of the needed subset** | Re-implement the *needed* meta-language surface (network + LinkQuery + substitution) in JS on top of `links-notation` (which **is** on npm). | No native dep; pure JS; full parity control. | Duplicates upstream; risk of drift; most work. |

**Recommendation (staged):**

1. **Short term — Option B then A.** First, open an upstream request to publish a
   wasm/napi npm package (B); it mirrors how `links-notation` already ships on both
   crates.io and npm at 0.13. In parallel, prototype a **wasm façade** (A) of the
   minimal surface (`parse`, `projected_links`, `LinkQuery`, `find/replace`,
   `SubstitutionRule`) so RML is not blocked on upstream.
2. **Fallback — Option D for the kernel only.** If neither wasm nor an npm publish
   is viable in time, port *only* the small kernel the strategy library needs
   (network handle + query + substitution) to JS over `links-notation`, behind the
   exact same interface as the wasm wrapper, so the two are swappable.
3. **Avoid Option C** for the library path (keep it only as a dev/diagnostic
   escape hatch), because subprocess dependence breaks browser and pure-JS use.

The interface RML codes against is defined once (a `MetaLang` façade:
`parse(text) -> Network`, `query(net, q) -> captures`, `replace(net, q, f) -> Network`,
`substitute(net, rule) -> Network`, `project(net, mode) -> Network`,
`reconstruct(net) -> text`) so the *implementation* behind it (wasm vs port) can
change without touching RML.

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

1. Land the **`MetaLang` façade interface** + the Rust crate dependency first,
   with the JS side behind the wasm/port wrapper, both no-ops until wired.
2. Make the network representation **opt-in** (`rml … --via-meta-language`) and run
   the full suite both ways in CI until parity is proven, then flip the default.
3. Keep `Node`/JS-AST as the AbstractSyntax projection so all existing code paths
   keep compiling; delete hand-written matchers only after `LinkQuery`-based ones
   pass the same tests.
4. Pin `meta-language` to an exact version (it is young: 0.45.0, 0 stars) and bump
   deliberately in dedicated PRs, like RML already pins `links-notation 0.13.0`.

## 10. Risks

The integration-specific risks (full register in
[`risks-and-open-questions.md`](./risks-and-open-questions.md)):

- **No npm package** → the dominant risk; mitigated by §5 (wasm/upstream/port).
- **meta-language maturity** (young, 0 stars, 694 downloads) → MX1 audit gates
  adoption; pin exact version; keep the façade so we can swap implementations.
- **Semantic mismatch** between meta-language `ProbabilisticTruthValue` and RML's
  truth ranges → reconciled in MX1; both are many-valued/probabilistic so the
  surface area is small, but it must be checked construct-by-construct.
- **Double maintenance** if Option D (JS port) is chosen → mitigated by porting
  only the minimal kernel behind the shared façade and a conformance test against
  the Rust crate.
