# Requirements — Issue #181

This document extracts every distinguishable requirement from the text of
[issue #181](https://github.com/link-foundation/relative-meta-logic/issues/181)
and pairs each one with a status flag and a pointer to the proposed solution.
Detailed plans are in [`solution-plans.md`](./solution-plans.md); the umbrella
analysis is in [`README.md`](./README.md). The full issue text is preserved in
[`data/issue-181.json`](./data/issue-181.json).

## Legend

| Mark | Meaning |
|------|---------|
| Today | Already true in `main` (cite the artefact). |
| Partial | Partial support today; needs an extension. |
| Missing | Not implemented; new work. |
| Meta | A requirement *about this case study itself* (collect data, analyse, plan). |

## The issue, quoted

> First of all for language translation logic, and representation of the meta
> logic expressions themselves we should use github.com/link-foundation/meta-language
> (it should [be] extensible and feature rich enough to support all our features).
>
> So we should prefer parsing in our dialect of meta language, and do all
> expressions manipulation in that way.
>
> We need to make sure we have all such features:
> ```
> Нужна библа паттернов перебирания паттернов! )
> Такое называют стратегии и тактики во всяких пруверах.
> ```
> *(“We need a library of patterns for iterating over patterns! These are called
> strategies and tactics in various provers.”)*
>
> And beat exactly all competitors in the field by features and quality.
>
> We need to collect data related about the issue to this repository, … compile
> that data to `./docs/case-studies/issue-{id}` folder, and use it to do deep case
> study analysis (also … search online …), list of each and all requirements …,
> and propose possible solutions and solution plans for each requirement (… also
> check known existing components/libraries …).
>
> Plan sub-issues in this pull request to fully implement our vision, they all
> will be merged to this pull request.

## Functional requirements table

| ID | Requirement (paraphrased from #181) | Status | Where it lives today / where it needs to land |
|----|-------------------------------------|--------|------------------------------------------------|
| **R1** | Use `link-foundation/meta-language` for **language-translation logic**. | Missing | meta-language is absent from the codebase (`grep` confirms no references). Today translation is via one-way exporters ([`docs/LEAN_EXPORT.md`](../../LEAN_EXPORT.md), [`docs/ROCQ-EXPORT.md`](../../ROCQ-EXPORT.md)) and the CST converters tracked by [issue #138](../issue-138/). Plan in [`meta-language-integration.md`](./meta-language-integration.md) §Translation. |
| **R2** | Use meta-language for the **representation of the meta-logic expressions themselves**. | Missing | RML represents expressions as `links-notation` ASTs: JS `Parser` ([`js/src/rml-links.mjs:17`](../../../js/src/rml-links.mjs#L17)), Rust `Node` enum ([`rust/src/lib.rs:418`](../../../rust/src/lib.rs#L418)). meta-language's `LinkNetwork` is the proposed replacement/overlay; both already sit on `links-notation 0.13`. See [`meta-language-integration.md`](./meta-language-integration.md) §Representation. |
| **R3** | meta-language must be **extensible and feature-rich enough to support all our features**. | Partial (upstream) | meta-language v0.45.0 offers lossless parse, projections, `LinkQuery`, `find/replace`, `SubstitutionRule`, and many-valued/`ProbabilisticTruthValue` semantics ([`data/online-research.md`](./data/online-research.md) §1). A feature-coverage audit (does it cover *every* RML construct?) is itself a sub-issue (MX1). |
| **R4** | **Prefer parsing in our dialect of meta language** (the RML dialect on top of meta-language). | Missing | RML parses LiNo directly. The plan: register an RML `LanguageParser`/dialect inside meta-language's `ParserRegistry` so RML source becomes a meta-language network. [`meta-language-integration.md`](./meta-language-integration.md) §Dialect. |
| **R5** | **Do all expression manipulation in that way** — i.e. via meta-language’s query/rewrite over the network. | Missing | RML manipulates its own `Node`/AST directly (`matchProofPattern` :2214, `_applyTactic` :3986, eval-nat rules :2317). The plan routes matching/rewriting through `LinkQuery` / `find` / `replace` / `SubstitutionRule`. [`solution-plans.md`](./solution-plans.md) Plan MX3. |
| **R6** | A **library of strategies and tactics** ("patterns for iterating patterns"). | Missing | RML has individual tactics but **no combinators** (`grep` confirms no `topdown`/`bottomup`/`tactical`). Designed in [`strategy-library.md`](./strategy-library.md); planned as Phase ST. |
| **R7** | **Beat exactly all competitors** in the field by features and quality. | Partial | Tracked in [`docs/CONCEPTS-COMPARISON.md`](../../CONCEPTS-COMPARISON.md) and [`docs/FEATURE-COMPARISON.md`](../../FEATURE-COMPARISON.md). The *Proof Engineering and Automation* rows are "Part"/"No" (tactic language, simplifier, rewriting, proof search, **search-depth controls = No**). Phase QC closes them. |
| **R8** | **Collect issue data** into `docs/case-studies/issue-181/`. | Today (this PR) | [`data/issue-181.json`](./data/issue-181.json), [`data/issue-181-comments.json`](./data/issue-181-comments.json) (empty — the issue has no comments), [`data/pr-182.json`](./data/pr-182.json), [`data/online-research.md`](./data/online-research.md). |
| **R9** | **Deep case-study analysis**, including **online research** for extra facts. | Today (this PR) | [`README.md`](./README.md), [`existing-tools.md`](./existing-tools.md), [`data/online-research.md`](./data/online-research.md) — all citing external sources verified 2026-06-18. |
| **R10** | **List each and all requirements** from the issue. | Today (this file) | This table (R1–R13) plus the derived NFRs below. |
| **R11** | **Propose possible solutions and solution plans for each requirement.** | Today (this PR) | [`solution-plans.md`](./solution-plans.md) gives ≥1 plan per requirement; designs in [`meta-language-integration.md`](./meta-language-integration.md) and [`strategy-library.md`](./strategy-library.md). |
| **R12** | **Check known existing components/libraries** that solve similar problems. | Today (this PR) | [`existing-tools.md`](./existing-tools.md): meta-language, Stratego/Visser, LCF tacticals, Ltac/Ltac2, Eisbach, Lean tactics, Maude/ELAN, egg/egglog, links-notation. |
| **R13** | **Plan sub-issues in this PR** to fully implement the vision; they will be merged into this PR. | Today (this PR) | [`sub-issues.md`](./sub-issues.md): Phases MX, ST, QC, DOC with ready-to-file issue bodies. |

## Derived non-functional requirements

Issue #181 implies, but does not state, the following. We surface them so the
reviewer can confirm them before implementation phases start.

| ID | Requirement | Justification |
|----|-------------|---------------|
| **N1** | **JS ⇄ Rust parity is preserved.** Any meta-language adoption must keep both implementations behaving identically. | The dual-implementation discipline audited in [`docs/case-studies/issue-167`](../issue-167/). meta-language has **no npm package** ([`data/online-research.md`](./data/online-research.md) §1), so this is the dominant design constraint — see [`meta-language-integration.md`](./meta-language-integration.md) §JS strategy. |
| **N2** | **Backward compatibility.** Existing `rml run`/`rml check`/tactic syntax keeps working; the full existing test suite stays green. | Same discipline that protected the CST work in [issue #138](../issue-138/) (opt-in, non-breaking). |
| **N3** | **The strategy layer is exposed in both the surface syntax and the CLI.** | Consistency with how tactics are surfaced today (`_applyTactic`, tactic links in `.lino`). |
| **N4** | **CST/lossless integration.** The meta-language adoption should compose with the CST infrastructure from [issue #138](../issue-138/) rather than duplicate it. | meta-language is itself a lossless CST/network; the two efforts must converge, not fork. |
| **N5** | **Every new capability is covered by tests** mirrored across JS and Rust, and gated in CI. | Repository-wide testing convention; see [`acceptance criteria in sub-issues.md`](./sub-issues.md). |
| **N6** | **Soundness is not weakened.** Strategy combinators must reuse the existing certified tactic/kernel steps, not bypass them. | RML records SMT/ATP as trusted external nodes and otherwise checks proofs; strategies only *schedule* sound steps (see [`docs/KERNEL.md`](../../KERNEL.md)). |

## What this PR does and does not do

Following the precedent of [`docs/case-studies/issue-138`](../issue-138/) (a
planning issue delivered as a case-study folder, with implementation tracked
separately):

- **This PR does** deliver the complete case study: data, deep analysis, the full
  requirement list (this file), solution plans, the strategy-library design, the
  meta-language integration design, the risk register, and a ready-to-file
  sub-issue plan ([`sub-issues.md`](./sub-issues.md)).
- **This PR does not** implement Phases MX/ST/QC/DOC — those land in their own PRs.
- **This PR does not** auto-open the GitHub sub-issues. Creating issues is an
  outward-facing action; [`sub-issues.md`](./sub-issues.md) contains paste-ready
  bodies so a maintainer can file them (or authorise the assistant to) after
  review. This mirrors how [issue #138](../issue-138/) and the parity epic
  [issue #95](../issue-95/) were handled.
