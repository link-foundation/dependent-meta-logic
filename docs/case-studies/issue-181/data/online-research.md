# Online research and verified facts — Issue #181

This file consolidates the external facts the case study relies on, each with the
source and the date it was checked. It backs the analysis in
[`README.md`](../README.md), [`existing-tools.md`](../existing-tools.md),
[`meta-language-integration.md`](../meta-language-integration.md) and
[`strategy-library.md`](../strategy-library.md).

All package/registry facts in §1–§4 below were verified on **2026-06-18**.

> **Update — 2026-06-21:** meta-language now ships a **JavaScript implementation
> with enforced Rust↔JS parity** (`@link-foundation/meta-language` v0.46.0,
> `js/` folder), which **supersedes the "Rust-only / no npm package" framing in
> §1**. The new verified facts, the empirical readiness check, and the two gaps
> filed upstream are in **[§5](#5-update-2026-06-21--meta-language-now-has-a-javascript-implementation)**.

---

## 1. `link-foundation/meta-language`

The issue names `github.com/link-foundation/meta-language` as the package RML
should adopt for (a) language-translation logic and (b) representation of the
meta-logic expressions themselves. Verified facts:

| Fact | Value | Source (checked 2026-06-18) |
|------|-------|------------------------------|
| Repository | `link-foundation/meta-language` | `gh api repos/link-foundation/meta-language` |
| Repo description | "A language about languages" | same |
| README tagline | "A Rust foundation for a universal, self-describing meta language backed by a links network." | `README.md` (raw.githubusercontent) |
| Primary language | Rust | `gh api … .language` |
| Created / last push | 2026-06-05 / 2026-06-14 | `gh api … .created_at/.updated_at` |
| Stars | 0 | `gh api … .stargazers_count` |
| License | Unlicense | `gh api … .license.spdx_id` |
| Homepage | <https://link-foundation.github.io/meta-language/> | `gh api … .homepage` |
| crates.io crate | `meta-language` **v0.45.0**, not yanked, 694 downloads | `https://index.crates.io/me/ta/meta-language`, `crates.io/api/v1/crates/meta-language` |
| **npm package** | **does not exist (HTTP 404)** | `registry.npmjs.org/meta-language` → 404 |

**Declared dependencies** (from the crate `Cargo.toml`, checked 2026-06-18):

- `links-notation = "0.13"` — the **same parser RML already depends on** (RML pins
  `links-notation = "0.13.0"` in [`rust/Cargo.toml`](../../../../rust/Cargo.toml#L25)
  and `links-notation` npm `0.13.0` in [`js/src/rml-links.mjs`](../../../../js/src/rml-links.mjs#L17)).
- `tree-sitter = "0.25.8"` plus a family of `tree-sitter-*` grammar crates.
- `doublets = "0.4.0"` (optional) + `platform-mem` behind a `doublets` feature —
  an optional persistent links backend.

**Documented capabilities** (README, checked 2026-06-18; quotes are verbatim):

- *Lossless by default.* "The default parse path is lossless." `parse()` is the
  default lossless entry point; `parse_lossless_text()` is the explicit boundary;
  `reconstruct_text()` does "byte-for-byte reconstruction from non-missing token
  links ordered by source span."
- *Projections.* "view … the same lossless network as concrete syntax, abstract
  syntax, or semantic-only data by stripping lower-level preservation links from
  the view" via `projected_links()`; `NetworkProjection::AbstractSyntax` is named
  explicitly.
- *Structural query / codemod.* "`LinkQuery` for structural matching by link type,
  term, language, named flag, tree-sitter-query-like S-expressions, captures, and
  host predicates." "`find()` / `replace()` for codemod-style query transforms
  over captured links while preserving unchanged source bytes."
  "`SubstitutionRule` / `apply_substitution()` for the link-cli-style
  match-and-substitute operation."
- *Many-valued / probabilistic semantics.* "Object-identity links, many-valued
  `TruthValue` semantics, and fixed-point `ProbabilisticTruthValue` confidence
  semantics." — this is conceptually aligned with RML's own probabilistic /
  many-valued truth ranges.
- *LiNo parsing.* "Structural LiNo parsing for links-notation doublets, triplets,
  named links, simple indented definitions, and self-references."

**Interpretation for RML.** meta-language is a young (created 2026-06-05, 0 stars,
694 downloads) but past-prototype Rust crate that is *built on the same
`links-notation` 0.13 parser RML already uses*. It adds exactly the three
capabilities issue #181 cares about: lossless representation of expressions,
structural query/rewrite over those expressions, and many-valued/probabilistic
truth values that match RML's own model. The **single biggest integration
constraint** is that it is **Rust-only — there is no npm package** — so the
JavaScript half of RML (which must stay at parity, per
[`docs/case-studies/issue-167`](../../issue-167/) and the dual-implementation
discipline) cannot simply `import` it. See
[`meta-language-integration.md`](../meta-language-integration.md) for the options.

---

## 2. "Library of patterns for iterating patterns" = strategies & tactics

The Russian line in the issue —

> Нужна библа паттернов перебирания паттернов! )
> Такое называют стратегии и тактики во всяких пруверах.

translates to:

> We need a library of patterns for iterating over patterns! These are called
> **strategies and tactics** in various provers.

This is a request for a **strategy / tactic combinator language**: a small,
composable algebra for *how to apply* rewrite rules and proof steps (in what
order, how deep, with what backtracking), as distinct from the rules themselves.
The established designs we surveyed:

### 2.1 LCF tacticals (the origin)

- Edinburgh LCF (Milner, 1979) introduced **tactics** (goal → subgoals + validation)
  and **tacticals** that combine them: `THEN`, `THENL`, `ORELSE`, `REPEAT`, `TRY`,
  `ALL_TAC` (identity), `NO_TAC` (fail). This is the ancestor of every system below.
  - Background: HOL/Isabelle/Rocq/Lean all inherit it. See the HOL "Tactics and
    Tacticals" documentation and Isabelle's *Isar Reference*.

### 2.2 Term-rewriting strategy languages

- **Stratego/XT** (Visser et al.) — the canonical *strategy combinator* language.
  Primitives: `id`, `fail`, sequencing `s1 ; s2`, **deterministic left choice
  `s1 <+ s2`**, non-deterministic choice `s1 + s2`, `where`, `rec` for recursion,
  and the **one-level traversal operators `all(s)`, `one(s)`, `some(s)`**. Derived
  library strategies: `try(s) = s <+ id`, `repeat(s) = try(s ; repeat(s))`,
  `topdown(s) = s ; all(topdown(s))`, `bottomup(s) = all(bottomup(s)) ; s`,
  `oncetd(s)`, `alltd(s)`, `innermost(s)`.
  - **Correction to an earlier draft:** Stratego has **no `+>` operator**. The two
    real choice operators are `<+` (deterministic/left choice) and `+`
    (non-deterministic choice). Verified against the Stratego language reference.
- **Eelco Visser, "A survey of strategies in rule-based program transformation
  systems", *Journal of Symbolic Computation* 40 (2005) 831–873** — the canonical
  survey. Key contribution we adopt: the **generic one-level traversal operator**
  (`all`/`one`/`some`) from which all traversal schemes (`topdown`, `bottomup`,
  `innermost`, `downup`, …) are *derived* rather than primitive. This is the design
  spine for [`strategy-library.md`](../strategy-library.md).
- **ELAN** (Nancy) — strategies over rewrite rules with `dont care`/`dont know`
  choice, `repeat`, `iterate`; an early influence on the area.
- **Maude strategy language** — `idle`, `fail`, concatenation, union `|`,
  iteration `*`/`+`, normalization `s!`, conditional `s ? s1 : s2`, and
  `matchrew` for subterm strategies; defined in separate *strategy modules*.
- **Rewriting calculus / ρ-calculus** (Cirstea & Kirchner) — the theoretical
  foundation that makes a rule a first-class value that strategies operate on.

### 2.3 Prover tactic languages

- **Coq/Rocq `Ltac` and `Ltac2`** — `t1; t2`, `[> … | …]` (per-goal),
  `try`, `repeat`, `first [ … ]`, `solve`, `||` (first-success), `do n`, `progress`,
  `match goal with`. `Ltac2` adds a typed ML-like layer. Rocq also ships
  `autorewrite`, `rewrite_strat` (a *strategy* sublanguage for rewriting:
  `topdown`, `bottomup`, `repeat`, `hints`), and `setoid_rewrite`.
- **Lean 4** — tactic blocks with `<;>` (apply to all goals), `first | … | …`,
  `repeat`, `try`, `all_goals`, `any_goals`, `solve`; `simp` with a configurable
  rewrite set; macro-based user tactics.
- **Isabelle** — Isar structured proofs; `Eisbach` defines new proof methods by
  combining existing ones with `,` (then), `|` (or), `?` (try), `+` (repeat);
  method arguments and `match` over goals.
  - **Correction to an earlier draft:** Eisbach has **no `succeed` method**, and
    `[n]` is *Isar goal-range* syntax, not an Eisbach combinator.
- **ssreflect** (Rocq) — disciplined rewrite/manipulation language (`rewrite`
  patterns, `//`, `/=`, occurrence selection) — a model for *focused* rewriting.

### 2.4 E-graphs / equality saturation (the modern automation frontier)

- **`egg`** (Rust crate; Willsey et al., POPL 2021, "egg: Fast and Extensible
  Equality Saturation") — e-graph + rewrite rules applied to *saturation* with a
  cost-based extraction. Relevant because RML already has an assigned-infix rewrite
  table; equality saturation is the scalable way to "iterate patterns" without
  hand-tuned ordering.
- **`egglog`** (Zhang et al., PLDI 2023) — unifies Datalog and equality
  saturation and adds a **`schedule`/`ruleset` sublanguage** (`run`, `saturate`,
  `seq`, `repeat`) — i.e. a strategy language for rule application. A direct model
  for a declarative strategy layer.

### 2.5 The common core we recommend

Across all of the above, the same small algebra recurs. The recommended RML core
(see [`strategy-library.md`](../strategy-library.md)):

- **Atoms:** `id` (always succeed, no change), `fail` (always fail).
- **Composition:** `seq(s1, s2)` (`;`), deterministic choice `lchoice(s1, s2)`
  (`<+`), backtracking choice `choice(s1, s2)` (`+`).
- **Recursion:** `rec`/named strategies + fixpoint.
- **Derived control:** `try(s)`, `repeat(s)`, `repeat1(s)`, `not(s)`, `test(s)`,
  `while(c, s)`.
- **One-level traversal (the spine):** `all(s)`, `one(s)`, `some(s)`.
- **Derived traversal:** `topdown`, `bottomup`, `innermost`, `oncetd`, `oncebu`,
  `alltd`, `downup`, `outermost`.

This is intentionally the **Visser-survey core**, because it is the smallest set
that provably generates every traversal scheme the competitor systems expose.

---

## 3. Competitor landscape ("beat exactly all competitors by features and quality")

RML already maintains two living comparison documents that enumerate competitors
and per-feature status:

- [`docs/CONCEPTS-COMPARISON.md`](../../../CONCEPTS-COMPARISON.md) — columns for
  Twelf, Beluga, Abella, Isabelle/HOL, Lean, Rocq/Coq, plus "Host", "Archive",
  and others. Relevant rows (verified 2026-06-18):
  - line 179 *Proof search* — RML: "Part (Prototype): query evaluation".
  - line 180 *Tactic-level proof construction* — RML: "Part (Prototype): tactic
    links exist (`reflexivity`, `symmetry`, `transitivity`, `rewrite`, `simplify`,
    `smt`, `atp`, `exact`, `induction`) but the tactic layer is not mature like
    Lean/Rocq/Isabelle".
  - line 181 *Rewriting as proof principle* — RML: "Part: assigned-infix rewrite
    table and `rewrite` tactic".
- [`docs/FEATURE-COMPARISON.md`](../../../FEATURE-COMPARISON.md) — §"Proof
  Engineering and Automation" (verified 2026-06-18):
  - line 56 *Tactic language* — "Part (Prototype) … Not as mature as Isar/Ltac/Lean."
  - line 57 *Simplifier* — "Part: evaluator and operators".
  - line 58 *Rewriting automation* — "Part: assigned-infix rewrite table and
    `rewrite` tactic".
  - line 59 *Built-in proof search* — "Part: query evaluation".
  - line 60 *Search depth controls* — **"No"** (the only outright gap in the section).
  - line 123 (recommendations) — "Mature the tactic link layer (…)".

These two documents are the **scoreboard** issue #181's "beat all competitors"
clause must move. The strategy/tactic library plus search-depth controls turn the
"Part" / "No" cells in the *Proof Engineering and Automation* section into "Yes".

---

## 4. Where RML stands today (verified in source, 2026-06-18)

| Capability | Present? | Evidence |
|------------|----------|----------|
| Parses LiNo via `links-notation` | Yes | [`js/src/rml-links.mjs:17`](../../../../js/src/rml-links.mjs#L17), [`rust/Cargo.toml:25`](../../../../rust/Cargo.toml#L25) |
| `meta-language` used anywhere | **No** | `grep -rn meta-language js/ rust/ lib/` → no hits in code |
| Pattern matcher over proof terms | Yes | `matchProofPattern` [`js/src/rml-links.mjs:2214`](../../../../js/src/rml-links.mjs#L2214); `instantiateProofPattern` :2347 |
| Rule-driven evaluation | Yes | `DEFAULT_EVAL_NAT_RULES` :2317, `applyEvalNatRule`/`evalNatTerm` |
| Tactic engine | Yes (prototype) | `_applyTactic` [`js/src/rml-links.mjs:3986`](../../../../js/src/rml-links.mjs#L3986), `_tacticName` :3310 |
| Tactic *combinators* (`;`, `<+`, `try`, `repeat`, traversal) | **No** | `grep -niE 'topdown|bottomup|innermost|tactical|combinator' js/src rust/src` → no hits |
| Assigned-infix rewrite table | Yes | `docs/CONCEPTS-COMPARISON.md:181`, `docs/FEATURE-COMPARISON.md:58` |
| Search-depth controls | **No** | `docs/FEATURE-COMPARISON.md:60` |

The two gaps issue #181 targets are therefore precisely: **(G1)** no
meta-language integration, and **(G2)** no strategy/tactic *combinator* layer on
top of the existing rules/tactics.

---

## 5. Update 2026-06-21 — meta-language now has a JavaScript implementation

The 2026-06-18 analysis (§1) found meta-language to be **Rust-only with no npm
package**, which it called "the single biggest integration constraint". On
**2026-06-21** the maintainer reported on [PR #182](https://github.com/link-foundation/relative-meta-logic/pull/182)
that meta-language "now fully supports JavaScript" and asked whether RML can
proceed with full adoption. This section records what was re-verified.

### 5.1 New verified facts (checked 2026-06-21)

| Fact | Value | Source |
|------|-------|--------|
| README tagline | "implemented in **both Rust and JavaScript** with guaranteed feature parity between the two." | `README.md` (was "A Rust foundation…") |
| Repository layout | `rust/` (reference crate) **and** `js/` (`@link-foundation/meta-language`), shared `parity/`, `docs/`, `.github/` | `gh api repos/link-foundation/meta-language/contents` |
| JS package | `@link-foundation/meta-language` **v0.46.0**, `type: module`, ESM `exports`, `links-notation 0.13.0` + `peggy 5.1.0` deps | `js/package.json` |
| JS implementation issue | [#163 "Implement JavaScript version of meta language"](https://github.com/link-foundation/meta-language/issues/163) — **CLOSED 2026-06-21** | `gh issue view 163` |
| Parity gate | `parity/language-features.json` (14 required features) + `npm run check:parity`, run by **both** `js.yml` and `rust.yml` | `js/README.md`, `js/scripts/` |
| JS tests | `node --test` — **13/13 pass** | `cd js && npm install && npm test` |
| **npm registry** | **still 404** — package not yet published; git/tarball install only | `npm view @link-foundation/meta-language` → E404; `registry.npmjs.org/@link-foundation%2Fmeta-language` → `{"error":"Not found"}` |

The JS package is built on the **same `links-notation 0.13` RML already uses**
(`js/src/rml-links.mjs:17`), so adoption stays an overlay on a shared substrate —
exactly as §1 hoped, now without the language barrier.

### 5.2 Empirical readiness check

[`experiments/issue-181-meta-language-js-smoke.mjs`](../../../../experiments/issue-181-meta-language-js-smoke.mjs)
exercises the JS package against RML's concrete needs. Result: **7 PASS, 2 GAP,
0 FAIL**.

| Probe | Result |
|-------|--------|
| Lossless parse of RML **named** LiNo (`parse(src, "RML", …)`) | PASS (114 links) |
| Byte-for-byte round-trip of RML named LiNo (`reconstructText()`) | PASS |
| Lossless parse/reconstruct of a JavaScript host sample | PASS |
| S-expression query + `replace` (README codemod example) | PASS (`oldName`→`newName`) |
| `SubstitutionRule` / `applySubstitution` leaf op | PASS |
| `TranslationRuleSet` present | PASS |
| `TruthValue` / `ProbabilisticTruthValue` exported in **JS** | **GAP** → upstream [#166](https://github.com/link-foundation/meta-language/issues/166) |
| Strategy/tactic combinators upstream | GAP (expected — RML's Pillar 2 to build) |

**Ingestion note.** RML's *named* LiNo must be ingested with the **lossless
parser** `LinkNetwork.parse(text, language, config)`, **not** `fromLino()`.
`fromLino()` is the inverse of `toLino()` — it only accepts the canonical
numeric-id serialization schema (e.g. `(1: 2 3)`), matching Rust's `from_lino`
contract ("top-level statement must be an identified link"). This is the
documented contract, not a bug; the smoke test asserts both behaviours.

### 5.3 Gaps filed upstream (as the maintainer requested)

- **[meta-language#165](https://github.com/link-foundation/meta-language/issues/165)** —
  publish `@link-foundation/meta-language` to npm (registry returns 404; `js.yml`
  has no publish step). Blocks clean `npm install`/version pinning; git-install
  works meanwhile.
- **[meta-language#166](https://github.com/link-foundation/meta-language/issues/166)** —
  truth-value semantics (`TruthValue` / `Probability` / `ProbabilisticTruthValue`,
  `rust/src/semantics.rs`) are **Rust-only**, absent from JS and from the parity
  manifest, despite #163's "all features in Rust must also be in JS" mandate.

### 5.4 Answer to the maintainer's question

**Can RML proceed with full JS support of meta-language?** For the **two pillars
the issue actually asks for** — representation/parsing (R2/R4/N4) and structural
manipulation (R5/translation R1) — **yes**: the JS package covers them today,
verified empirically. The remaining items are not blockers for those pillars:

- npm publish (#165) — adopt via a **pinned git dependency** until the package
  lands on npm, then switch to a version range (mirrors how RML pins
  `links-notation 0.13.0`).
- truth-value parity (#166) — **non-blocking**, because RML keeps its own truth
  model in JS regardless; it only blocks *delegating* truth semantics to
  meta-language on the JS side, which is not required to adopt representation +
  manipulation.
- strategy/tactic combinators — never a meta-language deliverable; Pillar 2
  builds them in RML on top of `find`/`replace`/`applySubstitution`.

So the case study's previously dominant "no npm / Rust-only" constraint is
**resolved as a parity blocker** and downgraded to a packaging follow-up; the
integration plan in [`meta-language-integration.md`](../meta-language-integration.md)
§4–§5 is updated accordingly.
