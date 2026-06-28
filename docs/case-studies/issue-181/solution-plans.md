# Solution plans — Issue #181

This document proposes one or more solution plans **per requirement**
(satisfying **R11**). Requirements are defined in [`requirements.md`](./requirements.md);
designs they reference live in
[`meta-language-integration.md`](./meta-language-integration.md) and
[`strategy-library.md`](./strategy-library.md); the work is split into filable
sub-issues in [`sub-issues.md`](./sub-issues.md). Existing components considered
are in [`existing-tools.md`](./existing-tools.md).

Each plan lists the **option(s)**, a **recommendation**, and the **sub-issue**
that carries it.

---

## R1 — Use meta-language for language-translation logic

- **Option 1 (recommended):** Route RML ⇄ host-language conversion through
  meta-language's lossless `LinkNetwork` + `tree-sitter` grammars + `projected_links()`,
  **converging with the CST converter epic** ([issue #138](../issue-138/)). RML's
  existing one-way exporters become printers/projections over the shared network.
- **Option 2:** Keep the current bespoke exporters and only *additionally* offer a
  meta-language path. Rejected as the default — it creates two parallel translation
  stacks (violates N4) — but acceptable as the transition state.
- **Carried by:** MX4. **Depends on:** MX1, MX2.

## R2 — Use meta-language to represent meta-logic expressions

- **Option 1 (recommended):** Make the meta-language `LinkNetwork` the backing
  representation; keep RML's `Node`/JS-AST as the **AbstractSyntax projection** so
  existing code keeps compiling. Lossless + CST-ready for free.
- **Option 2:** Adopt only meta-language's *data model* shape inside RML's own
  structures without depending on the crate. Lower risk, but forfeits the lossless
  parser, query and codemod APIs — i.e. forfeits most of R3/R5. Not recommended.
- **Carried by:** MX2. **Depends on:** MX1 (the JS side depends directly on
  meta-language's native JS package — see N1 below).

## R3 — meta-language must be extensible/feature-rich enough for all our features

- **Option 1 (recommended):** **Audit first.** MX1 maps every RML construct to a
  meta-language link shape and lists gaps. If gaps exist, decide per gap:
  (a) extend RML's dialect within meta-language's existing extensibility
  (`ParserRegistry`/`LanguageParser`), or (b) file an upstream feature request, or
  (c) keep that construct in an RML-side overlay until upstream catches up.
- **Why an audit, not a leap:** the issue itself hedges ("it *should be* …
  enough"), and meta-language is young (Rust v0.49.0 / JS npm v0.46.0). The audit
  converts a hope into a checklist with evidence.
- **Carried by:** MX1.

## R4 — Prefer parsing in our dialect of meta-language

- **Option 1 (recommended):** Register an RML `LanguageParser` in meta-language's
  `ParserRegistry`; parsing RML source yields a network whose lossless layer
  reconstructs the bytes and whose AbstractSyntax projection equals today's tree.
- **Option 2:** Pre-process RML → canonical LiNo → `meta_language::parse()`.
  Simpler, but loses RML-specific surface niceties and round-trip fidelity for
  RML-only syntax. Acceptable bootstrap; not the end state.
- **Carried by:** MX2.

## R5 — Do all expression manipulation through meta-language

- **Option 1 (recommended):** Re-express `matchProofPattern` via `LinkQuery`, and
  the assigned-infix/eval-nat rewrites via `SubstitutionRule`/`find`/`replace`,
  behind RML's existing function names (thin wrappers) so the change is
  non-breaking. The strategy library (R6) then schedules these as leaf operations.
- **Option 2:** Keep hand-written matchers and only use meta-language for new code.
  Rejected as the end state (partial R5) but fine during migration.
- **Carried by:** MX3. **Depends on:** MX2; consumed by ST2/ST3.

## R6 — Library of strategies & tactics ("patterns for iterating patterns")

- **Option 1 (recommended):** Build the **Visser/Stratego + LCF common core**
  (`id`, `fail`, `seq`, `lchoice`, `choice`, `rec`, `all`/`one`/`some`) plus the
  derived library (`try`, `repeat`, `topdown`, `bottomup`, `innermost`,
  `oncetd`, …, and goal combinators `all_goals`/`first`/`solve`/`progress`),
  implemented identically in JS and Rust with a shared conformance suite. Full
  design in [`strategy-library.md`](./strategy-library.md).
- **Option 2:** Wrap an existing engine (e.g. `egg`/`egglog` for rewriting). Good
  as an *optional backend* (`saturate`), but cannot be the core because it is
  Rust-only and would break JS parity (N1). Keep it behind a strategy.
- **Option 3:** Expose only proof tactics combinators (skip term-rewriting
  strategies). Rejected — the issue explicitly says "iterating over patterns",
  i.e. rewriting, and the comparison docs flag rewriting automation as "Part".
- **Carried by:** Phase ST (ST1–ST5).

## R7 — Beat all competitors by features and quality

- **Plan:** Treat [`docs/FEATURE-COMPARISON.md`](../../FEATURE-COMPARISON.md) and
  [`docs/CONCEPTS-COMPARISON.md`](../../CONCEPTS-COMPARISON.md) as the scoreboard.
  The strategy library + search-depth controls turn these specific cells from
  "Part"/"No" to "Yes":
  - *Tactic language* (FC:56), *Simplifier* (FC:57), *Rewriting automation*
    (FC:58), *Built-in proof search* (FC:59), **Search depth controls (FC:60 = No)**.
  - *Tactic-level proof construction* (CC:180), *Rewriting as proof principle*
    (CC:181), *Proof search* (CC:179).
- After Phase ST + the QC tasks, update both comparison docs **with evidence**
  (each upgraded cell cites the new feature + its tests), and add a high-leverage
  `auto`-style tactic (see [`strategy-library.md` §11](./strategy-library.md#11-worked-examples))
  to demonstrate parity with Lean `simp`/`aesop`, Rocq `auto`/`autorewrite`,
  Isabelle `auto`.
- **Carried by:** Phase QC (QC1–QC3).

## R8 — Collect issue data into the case-study folder

- **Done in this PR:** [`data/issue-181.json`](./data/issue-181.json),
  [`data/issue-181-comments.json`](./data/issue-181-comments.json) (empty — no
  comments), [`data/pr-182.json`](./data/pr-182.json),
  [`data/online-research.md`](./data/online-research.md).

## R9 — Deep analysis + online research

- **Done in this PR:** [`README.md`](./README.md), [`existing-tools.md`](./existing-tools.md),
  [`data/online-research.md`](./data/online-research.md) — external sources cited
  and dated.

## R10 — List each and all requirements

- **Done in this PR:** [`requirements.md`](./requirements.md) (R1–R13 + N1–N6).

## R11 — Propose solutions/plans per requirement

- **Done in this PR:** this file.

## R12 — Check existing components/libraries

- **Done in this PR:** [`existing-tools.md`](./existing-tools.md).

## R13 — Plan sub-issues in this PR

- **Done in this PR:** [`sub-issues.md`](./sub-issues.md) — Phases MX, ST, QC, DOC
  with paste-ready issue bodies. Creating the GitHub issues is left as an explicit,
  authorised follow-up (outward-facing action), matching how
  [issue #138](../issue-138/) handled it.

---

## Non-functional plans

### N1 — JS ⇄ Rust parity

- **Recommendation:** define a single `MetaLang` façade interface; back it on each
  side with meta-language's **native implementation** — the Rust crate on the Rust
  side and the native JS package (`meta-language`) on the JS side.
  No wasm build or JS port is needed: meta-language now maintains its **own**
  Rust↔JS parity gate. RML depends on the published npm package on the JS side;
  upstream release lockstep is tracked in
  [#171](https://github.com/link-foundation/meta-language/issues/171). Full
  analysis in
  [`meta-language-integration.md` §5](./meta-language-integration.md#5-js-integration-the-chosen-path).
- The strategy core is written twice (JS + Rust) against the same conformance
  corpus so no combinator is implementation-specific.

### N2 — Backward compatibility

- Everything ships **opt-in** first (`--via-meta-language`, new strategy syntax),
  full suite runs both ways in CI, default flips only after parity is proven —
  the same discipline that protected [issue #138](../issue-138/).

### N3 — Surface + CLI exposure

- Strategies are first-class in the dialect (parsed via meta-language) and exposed
  on the CLI (`rml prove --strategy …`, `rml run --max-steps N`).

### N4 — Converge with the CST epic

- meta-language *is* a lossless CST/network; MX2/MX4 reuse it instead of forking
  the [issue #138](../issue-138/) converters.

### N5 — Tests + CI for every capability

- Each sub-issue's acceptance criteria require mirrored JS/Rust tests and a CI
  gate (see [`sub-issues.md`](./sub-issues.md)).

### N6 — Soundness preserved

- Strategies only *schedule* existing certified steps; they add no inference rule
  ([`strategy-library.md` §10](./strategy-library.md#10-soundness)).
