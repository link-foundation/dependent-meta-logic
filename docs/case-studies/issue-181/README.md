# Case study: Adopt `meta-language` and build a strategy/tactic library

**Issue:** [#181 — We need to fully support additional features](https://github.com/link-foundation/relative-meta-logic/issues/181)
**Pull request:** [#182](https://github.com/link-foundation/relative-meta-logic/pull/182)
**Sibling artefacts in this folder:** [`requirements.md`](./requirements.md), [`existing-tools.md`](./existing-tools.md), [`solution-plans.md`](./solution-plans.md), [`strategy-library.md`](./strategy-library.md), [`meta-language-integration.md`](./meta-language-integration.md), [`sub-issues.md`](./sub-issues.md), [`risks-and-open-questions.md`](./risks-and-open-questions.md), and raw data under [`data/`](./data/).

## Table of contents

1. [Executive summary](#executive-summary)
2. [Goal restated and scoped](#goal-restated-and-scoped)
3. [Where RML stands today](#where-rml-stands-today)
4. [The two pillars](#the-two-pillars)
5. [Key design decisions](#key-design-decisions)
6. [Phased roadmap and recommended issue split](#phased-roadmap-and-recommended-issue-split)
7. [Existing components and libraries that help](#existing-components-and-libraries-that-help)
8. [Test strategy](#test-strategy)
9. [Open questions](#open-questions)
10. [References](#references)

---

## Executive summary

Issue #181 asks RML to "fully support additional features" along two concrete axes
and one quality goal:

1. **Adopt [`link-foundation/meta-language`](https://github.com/link-foundation/meta-language)**
   for (a) language-translation logic and (b) the representation of meta-logic
   expressions themselves — and "prefer parsing in our dialect of meta language,
   and do all expressions manipulation in that way."
2. **Build a "library of patterns for iterating over patterns"** — explicitly,
   "strategies and tactics, as in various provers."
3. **"Beat exactly all competitors in the field by features and quality."**

Plus the process clauses this PR fulfils directly: collect issue data into
`docs/case-studies/issue-181/`, do deep analysis with online research, list every
requirement, propose solution plans for each, check existing libraries, and plan
sub-issues in this PR.

Two facts shape everything:

- **meta-language now ships in both Rust and JavaScript.** RML can depend on the
  Rust crate (`meta-language` v0.49.0) and the npm package (`meta-language`
  v0.46.0), both on `links-notation 0.13`, with lossless representation,
  structural query/codemod, translation rules, and many-valued/probabilistic
  truth values. **Update 2026-06-28:** the old "Rust-only / no npm package" and
  "truth semantics are Rust-only" blockers are resolved. The smoke test now shows
  9 PASS / 2 GAP / 0 FAIL; the remaining upstream gaps are release lockstep
  ([meta-language#171](https://github.com/link-foundation/meta-language/issues/171)),
  cross-runtime `TranslationRuleSet` serialization
  ([#172](https://github.com/link-foundation/meta-language/issues/172)), and token
  `LinkType` naming ([#173](https://github.com/link-foundation/meta-language/issues/173)).
  None blocks the RML overlay shipped in this PR.
- **RML already has rules, a pattern matcher, and prototype tactics, but no
  strategy *combinators* at all** — no `seq`/`<+`/`repeat`/`topdown`/`innermost`,
  no goal combinators, and (per the comparison docs) **no search-depth controls**.
  The combinator layer is the missing piece the issue's Russian note names.

This case study captures the data, lists all requirements (R1–R13 + non-functional
N1–N6), proposes ≥1 solution plan per requirement, names the libraries that help,
designs the strategy library and the meta-language integration in detail, and
splits the work into a four-phase sub-issue plan (MX/ST/QC/DOC). It **does not**
implement the phases — like [issue #138](../issue-138/) and the parity epic
[issue #95](../issue-95/), implementation lands in per-phase PRs.

## Goal restated and scoped

Quoting issue #181:

> First of all for language translation logic, and representation of the meta
> logic expressions themselves we should use github.com/link-foundation/meta-language
> (it should [be] extensible and feature rich enough to support all our features).
> So we should prefer parsing in our dialect of meta language, and do all
> expressions manipulation in that way.
>
> We need to make sure we have all such features:
> *“We need a library of patterns for iterating over patterns! These are called
> strategies and tactics in various provers.”*
>
> And beat exactly all competitors in the field by features and quality.

Scoped into measurable goals:

| Goal | Scope |
|------|-------|
| **G1** | meta-language is the representation + parsing + manipulation + translation substrate for RML, in both JS and Rust. |
| **G2** | A strategy/tactic combinator library (the Visser/Stratego + LCF common core) over RML's rules and tactics. |
| **G3** | The *Proof Engineering and Automation* rows of the comparison docs move from "Part"/"No" to "Yes", with evidence. |

## Where RML stands today

Verified in source on 2026-06-18 (full table in [`data/online-research.md` §4](./data/online-research.md#4-where-rml-stands-today-verified-in-source-2026-06-18)):

- Parses LiNo via `links-notation` (JS [`rml-links.mjs:17`](../../../js/src/rml-links.mjs#L17), Rust [`Cargo.toml:25`](../../../rust/Cargo.toml#L25)). meta-language appears **nowhere** in the code.
- Has a pattern matcher (`matchProofPattern` [:2214](../../../js/src/rml-links.mjs#L2214)), rule-driven evaluation (`DEFAULT_EVAL_NAT_RULES` [:2317](../../../js/src/rml-links.mjs#L2317)), and prototype tactics (`_applyTactic` [:3986](../../../js/src/rml-links.mjs#L3986): `reflexivity`, `symmetry`, `transitivity`, `suppose`, `introduce`, `rewrite`, `simplify`, `smt`, `atp`, `exact`, `induction`).
- Has **no** strategy combinators (`grep` for `topdown|bottomup|innermost|tactical|combinator` → nothing) and **no** search-depth controls ([`FEATURE-COMPARISON.md:60`](../../FEATURE-COMPARISON.md)).

So the building blocks exist; the two things issue #181 asks for — a meta-language
substrate and a combinator layer — are genuinely absent.

## The two pillars

### Pillar 1 — meta-language adoption (R1–R5)

meta-language gives RML a **lossless `LinkNetwork`** representation (`parse()`
lossless by default, `reconstruct_text()` byte-for-byte), **projections**
(`projected_links()` → concrete/abstract/semantic views), **structural query and
codemod** (`LinkQuery`, `find`/`replace`, `SubstitutionRule`), and **many-valued
`ProbabilisticTruthValue`** semantics that align with RML's own. Because it is
built on the same `links-notation 0.13`, adoption is an overlay, not a rewrite.

The plan (full design in [`meta-language-integration.md`](./meta-language-integration.md)):
audit coverage (MX1) → register the RML dialect and make the network the backing
representation with the old AST as a projection (MX2) → move matching/rewriting onto
`LinkQuery`/`SubstitutionRule` (MX3) → route host-language translation through
projections, converging with [issue #138](../issue-138/) (MX4). What was the hard
part — giving the **JS** side access despite a missing npm package — is now
straightforward: meta-language ships a native npm package, so RML depends on it
directly behind a thin `MetaLang` façade. The façade also isolates the current
Rust/JS version skew and token naming mismatch tracked upstream.

### Pillar 2 — strategy/tactic library (R6)

The Russian note asks for "a library of patterns for iterating over patterns …
strategies and tactics." We design the **Visser/Stratego + LCF common core**: the
kernel `id`, `fail`, `seq` (`;`), `lchoice` (`<+`), `choice` (`+`), `rec`, and the
one-level traversal trio `all`/`one`/`some`, from which the whole library
(`try`, `repeat`, `topdown`, `bottomup`, `innermost`, `oncetd`, …, plus the goal
combinators `all_goals`, `first`, `solve`, `progress`) is *derived*. One algebra
drives both term rewriting (over expressions) and proof tactics (over goals). Full
design, surface syntax, JS/Rust signatures and soundness argument in
[`strategy-library.md`](./strategy-library.md).

### The connection between the pillars

The strategy library is the **scheduler**; meta-language is the **matcher/rewriter**.
A leaf strategy `apply(rule)` fires a meta-language `SubstitutionRule`; `topdown`/
`innermost`/… decide where and how often. And because strategies are written in the
RML dialect (parsed via meta-language), a strategy *is itself* a meta-language
network — so it can be queried, rewritten and translated by the very same
machinery. That is the literal meaning of "do all expressions manipulation in that
way" (R5).

## Key design decisions

1. **Adopt meta-language as an overlay, not a rewrite.** Keep RML's `Node`/JS-AST
   as the AbstractSyntax projection; the network becomes the source of truth
   underneath. Non-breaking, opt-in first (N2).
2. **Derive traversal from `all`/`one`/`some`.** Smallest kernel that provably
   generates every traversal scheme the competitors expose (Visser 2005).
3. **One combinator algebra, two domains** (rewriting + proving). Keeps the surface
   small and the implementation shared.
4. **Parity behind a façade.** RML codes against a `MetaLang` interface; JS and
   Rust dependencies can be bumped deliberately while upstream release lockstep
   ([#171](https://github.com/link-foundation/meta-language/issues/171)) catches up.
5. **Bounded by construction.** Every non-terminating combinator takes fuel/depth;
   this also closes the comparison docs' only outright "No" (search-depth controls).
6. **Schedulers, not new rules.** Strategies only sequence already-certified steps,
   so soundness is preserved (N6).
7. **Plan now, implement in slices.** Deliver the case study + sub-issue plan in
   this PR; land MX1→MX2 and ST1 first (they unblock everything else).

## Phased roadmap and recommended issue split

Full bodies and acceptance criteria in [`sub-issues.md`](./sub-issues.md).

### Phase MX — meta-language adoption
- **MX1** Coverage audit (can it represent every RML construct?).
- **MX2** RML dialect + network-backed representation (opt-in).
- **MX3** Manipulation via `LinkQuery`/`SubstitutionRule`.
- **MX4** Translation via projections (converge with #138).
- **JS-bridge** ~~wasm/upstream/port to give JS access~~ **resolved 2026-06-28** —
  meta-language ships a native npm package and RML depends on it directly.

### Phase ST — strategy/tactic library
- **ST1** Core combinator algebra (JS + Rust, conformance corpus).
- **ST2** Term-rewriting strategies. **ST3** Proof/tactic strategies.
- **ST4** Surface syntax in the RML dialect. **ST5** Depth/fuel controls + `auto`.

### Phase QC — beat competitors, with evidence
- **QC1** Upgrade comparison-doc cells with citations. **QC2** Benchmarks vs
  Lean/Rocq/Isabelle. **QC3** Fuzz + CI hardening.

### Phase DOC — documentation
- **DOC1** Concepts pages. **DOC2** Tutorial. **DOC3** Examples + parity audit.

This split is intentionally fine-grained so each issue lands in a self-contained
PR, the way the parity epic ([issue #95](../issue-95/)) was delivered.

## Existing components and libraries that help

Detailed in [`existing-tools.md`](./existing-tools.md). Headlines:

- **Reuse:** `meta-language` (the core adoption), `links-notation` (already in
  use, shared floor), optionally `egg`/`egglog` as a rewriting backend behind a
  `saturate` strategy.
- **Imitate (design only):** Stratego/XT + Visser's 2005 JSC survey (the strategy
  canon), LCF tacticals, Rocq `Ltac`/`Ltac2` + `rewrite_strat`, Lean 4 tactic
  combinators, Isabelle `Eisbach`, Maude/ELAN strategy languages.

## Test strategy

Mirrors the conventions in [issue #138](../issue-138/) and the parity discipline in
[issue #167](../issue-167/):

- **Round-trip:** `reconstruct_text(parse(x)) == x` for all `examples/` + `lib/`.
- **Projection equivalence:** AbstractSyntax projection equals current parse on the
  corpus.
- **Strategy conformance:** a shared JSON corpus asserts JS and Rust produce
  identical traces; property tests for the algebraic laws.
- **Termination:** bounded combinators must terminate; a fuzz job tries to hang
  them.
- **Soundness:** adversarial tests that no strategy closes a false goal.
- **Parity:** every new module exists and behaves identically in JS and Rust, gated
  in CI.

## Open questions

See [`risks-and-open-questions.md`](./risks-and-open-questions.md). Q1 (preferred
JS bridge) is **answered as of 2026-06-28** — meta-language ships a native npm
package, so no wasm/port is needed. The remaining maintainer decisions are:
whether Phase MX absorbs or runs beside [issue #138](../issue-138/), the bar to
flip `--via-meta-language` to default, and whether to authorise auto-creating the
sub-issues.

## References

### External (verified 2026-06-18, meta-language re-verified 2026-06-28)

- [`link-foundation/meta-language`](https://github.com/link-foundation/meta-language) — repo, README, Rust crate v0.49.0 (crates.io), **JS package `meta-language` v0.46.0** (npm), homepage <https://link-foundation.github.io/meta-language/>. Remaining upstream parity/packaging gaps: [#171](https://github.com/link-foundation/meta-language/issues/171), [#172](https://github.com/link-foundation/meta-language/issues/172), [#173](https://github.com/link-foundation/meta-language/issues/173).
- [`links-notation` on crates.io](https://crates.io/crates/links-notation) and [on npm](https://www.npmjs.com/package/links-notation) — both 0.13.
- Eelco Visser, "A survey of strategies in rule-based program transformation systems", *J. Symbolic Computation* 40 (2005) 831–873.
- [Stratego/XT language reference](https://www.metaborg.org/) (strategy combinators `id`/`fail`/`;`/`<+`/`+`/`all`/`one`/`some`).
- LCF/HOL/Isabelle tacticals (`THEN`/`ORELSE`/`REPEAT`/`TRY`/`ALL_TAC`/`NO_TAC`).
- [Rocq `Ltac`](https://docs.rocq-prover.org/master/refman/proof-engine/ltac.html), [`Ltac2`](https://docs.rocq-prover.org/master/refman/proof-engine/ltac2.html), and `rewrite_strat`/`autorewrite`.
- [Lean 4 tactic combinators](https://lean-lang.org/doc/reference/latest/) (`<;>`, `first`, `repeat`, `all_goals`, `simp`).
- [Isabelle `Eisbach`](https://isabelle.in.tum.de/dist/Isabelle/doc/eisbach.pdf).
- [Maude strategy language](https://maude.lcc.uma.es/maude-manual/) and ELAN.
- egg — Willsey et al., "egg: Fast and Extensible Equality Saturation", POPL 2021; egglog — Zhang et al., PLDI 2023.

### Internal

- [`docs/CONCEPTS-COMPARISON.md`](../../CONCEPTS-COMPARISON.md), [`docs/FEATURE-COMPARISON.md`](../../FEATURE-COMPARISON.md) — the competitor scoreboard (R7).
- [`docs/case-studies/issue-138/`](../issue-138/) — CST converter epic (converges with MX4).
- [`docs/case-studies/issue-95/`](../issue-95/) — parity epic (roadmap model).
- [`docs/case-studies/issue-167/`](../issue-167/) — JS/Rust parity audit (N1).
- [`docs/KERNEL.md`](../../KERNEL.md) — soundness boundary (N6).
- Source: [`js/src/rml-links.mjs`](../../../js/src/rml-links.mjs), [`rust/src/lib.rs`](../../../rust/src/lib.rs), [`lib/self/foundations.lino`](../../../lib/self/foundations.lino).
