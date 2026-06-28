# Existing tools and libraries — Issue #181

This document catalogues the components we recommend reusing — and the ones we
study for design only — for the two pillars of issue #181: **adopting
`meta-language`** for expression representation and translation, and building a
**strategy/tactic combinator library**. It satisfies requirement **R12** (“check
known existing components/libraries that solve similar problems or can help”).
Package facts were first verified on 2026-06-18 and refreshed on 2026-06-28; see
[`data/online-research.md`](./data/online-research.md) for the raw evidence.

The catalogue is tiered like [`docs/case-studies/issue-138/existing-tools.md`](../issue-138/existing-tools.md):
Tier 1 = direct reuse, Tier 2 = reference designs to imitate, Tier 3 = background.

---

## Tier 1 — Directly reusable

### `meta-language` (link-foundation) — the core adoption

- **Crate:** `meta-language` v0.49.0 on crates.io (Unlicense).
- **JS package:** `meta-language` v0.46.0 on npm — a native JavaScript
  implementation with enforced Rust↔JS parity (`parity/language-features.json` +
  `npm run check:parity`, gated by both `js.yml` and `rust.yml`). The current
  Rust/JS release skew is tracked upstream in
  [#171](https://github.com/link-foundation/meta-language/issues/171).
- **Repo:** <https://github.com/link-foundation/meta-language> ("A language about languages").
- **Why it fits R1–R5:**
  - It is a **lossless self-describing links network** (`LinkNetwork`) that can
    represent expressions byte-for-byte (`parse()` lossless by default,
    `reconstruct_text()` for exact reconstruction) — directly serving **R2**
    (representation) and **N4** (compose with CST work).
  - It exposes **structural query and codemod**: `LinkQuery` (tree-sitter-query
    style S-expressions, captures, host predicates), `find()`/`replace()`,
    `SubstitutionRule`/`apply_substitution()` — directly serving **R5** (do all
    manipulation that way) and providing the *matching substrate* the strategy
    library schedules over (**R6**).
  - It ships **many-valued `TruthValue` + fixed-point `ProbabilisticTruthValue`**
    semantics in both Rust and JavaScript (the old JS gap was closed in
    [#166](https://github.com/link-foundation/meta-language/issues/166)), which
    align with RML's own probabilistic/many-valued truth ranges — so adopting it
    does not force RML to abandon its semantics.
  - It is **built on `links-notation 0.13`**, the exact parser RML already pins,
    minimising impedance mismatch.
  - It carries **tree-sitter 0.25.8 + grammar crates** and an optional `doublets`
    persistent backend, which is the substrate for **R1** (translation between
    host languages) and dovetails with [issue #138](../issue-138/)'s CST plan.
- **Former hard constraint — now resolved:** when this study was first written
  meta-language was Rust-only with **no npm package**, so the JS half of RML could
  not adopt it. As of 2026-06-28 meta-language ships its **own native npm package**
  with an enforced parity gate, so both halves of RML can adopt it. The residuals
  are release lockstep, translation-rule serialization, and token naming parity
  ([#171](https://github.com/link-foundation/meta-language/issues/171),
  [#172](https://github.com/link-foundation/meta-language/issues/172),
  [#173](https://github.com/link-foundation/meta-language/issues/173)).
  See [`meta-language-integration.md`](./meta-language-integration.md).
- **Maturity caveat:** created 2026-06-05, young but past prototype. A
  feature-coverage audit against RML's construct set is the first sub-issue (MX1)
  precisely because we must confirm "extensible and feature-rich enough"
  (the issue's own hedge: "*it should be* … enough").

### `links-notation` (LiNo) — already in use, keep it

- **Crate** `links-notation` 0.13 / **npm** `links-notation` 0.13.0 (both present).
- RML already depends on it ([`js/src/rml-links.mjs:17`](../../../js/src/rml-links.mjs#L17),
  [`rust/Cargo.toml:25`](../../../rust/Cargo.toml#L25)) and so does meta-language.
  It remains the **lexical/parse foundation** under both. No change needed; it is
  the shared floor that makes meta-language adoption low-risk.

### `egg` / `egglog` — optional automation backend (Rust)

- **`egg`** (crates.io; Willsey et al., POPL 2021) — e-graphs + equality
  saturation. RML already has an assigned-infix rewrite table; `egg` is the
  scalable engine for "iterate patterns" without hand-tuned ordering, and is a
  candidate backend behind a strategy like `saturate(ruleset)`.
- **`egglog`** (Zhang et al., PLDI 2023) — Datalog + equality saturation with a
  **`schedule`/`ruleset` sublanguage** (`run`, `saturate`, `seq`, `repeat`). This
  is itself a declarative strategy language and a concrete model for RML's
  combinator surface. Optional Tier-1 because it would be a *backend*, not a hard
  dependency; the core strategy library must work without it.

---

## Tier 2 — Reference designs to imitate (not dependencies)

These are the systems whose **strategy/tactic algebras** we copy the *design* of.
RML will not depend on any of them; it will re-implement the common core in JS and
Rust ([`strategy-library.md`](./strategy-library.md)).

### Stratego/XT + Visser's survey — the strategy-combinator canon

- **Eelco Visser, "A survey of strategies in rule-based program transformation
  systems", *J. Symbolic Computation* 40 (2005) 831–873.** The authoritative
  reference. Its central idea — the **generic one-level traversal operator**
  (`all`/`one`/`some`) from which `topdown`/`bottomup`/`innermost`/… are *derived*
  — is the spine of our design.
- **Stratego language reference** — primitives `id`, `fail`, `s1 ; s2`,
  `s1 <+ s2` (deterministic/left choice), `s1 + s2` (non-deterministic choice),
  `rec`, `all`/`one`/`some`; library `try`, `repeat`, `topdown`, `bottomup`,
  `oncetd`, `alltd`, `innermost`. (Note: there is **no `+>`** operator — the real
  ones are `<+` and `+`.)

### LCF tacticals — the proof-tactic canon

- Edinburgh LCF / HOL / Isabelle tacticals: `THEN`, `THENL`, `ORELSE`, `REPEAT`,
  `TRY`, `ALL_TAC` (= `id`), `NO_TAC` (= `fail`). Every prover below descends from
  this. RML's `seq`/`choice`/`try`/`repeat`/`id`/`fail` map one-to-one.

### Coq/Rocq `Ltac` / `Ltac2` and `rewrite_strat`

- `Ltac`: `;`, `[> … | …]`, `try`, `repeat`, `first [ … ]`, `solve`, `||`, `do n`,
  `progress`, `match goal with`. `Ltac2` adds a typed layer.
- **`rewrite_strat`** is a *rewriting strategy sublanguage* (`topdown`, `bottomup`,
  `repeat`, `hints`, `subterms`) — the closest existing analogue to what RML needs
  for rewrite scheduling, and a direct model for our traversal combinators applied
  to the assigned-infix rewrite table.
- `autorewrite`/`setoid_rewrite` — model for rewrite-set automation.

### Lean 4 tactic combinators

- `<;>` (apply to all resulting goals), `first | … | …`, `repeat`, `try`,
  `all_goals`, `any_goals`, `solve`, and `simp` with configurable rewrite sets.
  Model for goal-targeting combinators (`all_goals`/`any_goals`).

### Isabelle `Eisbach`

- Defines new proof *methods* by combining existing ones: `,` (sequence),
  `|` (alternative), `?` (try), `+` (repeat), method arguments, `match`. Model for
  a *user-facing* method-definition surface. (Note: Eisbach has **no `succeed`**
  method; `[n]` is Isar goal-range syntax, not a combinator.)

### Maude strategy language / ELAN

- Maude: `idle`, `fail`, concatenation, union `|`, iteration `*`/`+`,
  normalisation `s!`, conditional `s ? s1 : s2`, `matchrew` for subterms, defined
  in separate *strategy modules*. ELAN: `dont care`/`dont know` choice, `repeat`,
  `iterate`. Model for keeping strategies in a **separate namespace** from rules.

---

## Tier 3 — Background and theory

- **Rewriting calculus / ρ-calculus** (Cirstea & Kirchner) — makes a rule a
  first-class value strategies operate on; the theory under all of the above.
- **HOL/Isabelle "Tactics and Tacticals"** documentation — the canonical prose
  description of the tactical algebra.
- **Term Rewriting and All That** (Baader & Nipkow) — normalisation,
  confluence, termination background needed for `innermost`/`repeat` correctness
  and for the **search-depth controls** RML currently lacks
  ([`docs/FEATURE-COMPARISON.md:60`](../../FEATURE-COMPARISON.md)).

---

## Build-vs-reuse decisions

| Need | Decision | Rationale |
|------|----------|-----------|
| Lossless expression representation (R2) | **Reuse** `meta-language` `LinkNetwork` on **both** sides (native Rust crate + native JS package) | Already lossless, already on `links-notation 0.13`, native JS implementation now available from npm. |
| Structural match/rewrite substrate (R5) | **Reuse** `meta-language` `LinkQuery`/`find`/`replace`/`SubstitutionRule` | Purpose-built codemod API; avoids re-implementing query matching. |
| Strategy/tactic combinators (R6) | **Build** a small core in JS + Rust, modelled on Visser/Stratego + LCF | No suitable cross-language library exists; the core is small (~15 combinators) and must run identically in both implementations (N1). |
| Equality-saturation automation | **Optional reuse** of `egg`/`egglog` behind a strategy | Powerful but Rust-only and heavyweight; must be opt-in so JS parity (N1) holds without it. |
| Host-language translation (R1) | **Reuse** `meta-language` projections + converge with [issue #138](../issue-138/) CST converters | Avoids two parallel translation stacks (N4). |
