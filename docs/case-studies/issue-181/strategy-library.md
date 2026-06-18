# Strategy & tactic library design — Issue #181

> Нужна библа паттернов перебирания паттернов! Такое называют стратегии и тактики
> во всяких пруверах.
>
> *"We need a library of patterns for iterating over patterns! These are called
> strategies and tactics in various provers."*

This document designs the **strategy/tactic combinator library** requested by
issue #181 (requirement **R6**). It is the design that Phase **ST** in
[`sub-issues.md`](./sub-issues.md) implements. The landscape and citations are in
[`existing-tools.md`](./existing-tools.md) and [`data/online-research.md`](./data/online-research.md).

## Table of contents

1. [Vocabulary: rules vs tactics vs strategies](#1-vocabulary)
2. [What RML has today](#2-what-rml-has-today)
3. [Design principles](#3-design-principles)
4. [The core combinator algebra](#4-the-core-combinator-algebra)
5. [Derived (library) strategies](#5-derived-library-strategies)
6. [Two domains: term rewriting and goal/tactic proving](#6-two-domains)
7. [Surface syntax in the RML dialect](#7-surface-syntax)
8. [JS and Rust signatures (parity)](#8-js-and-rust-signatures)
9. [Search-depth and fuel controls](#9-search-depth-and-fuel-controls)
10. [Soundness](#10-soundness)
11. [Worked examples](#11-worked-examples)

---

## 1. Vocabulary

We use the standard rewriting/prover vocabulary throughout:

- **Rule** — a single rewrite or inference step (e.g. an entry in RML's
  assigned-infix rewrite table, or one `DEFAULT_EVAL_NAT_RULES` entry,
  [`js/src/rml-links.mjs:2317`](../../../js/src/rml-links.mjs#L2317)). A rule is
  *data*.
- **Tactic** — a transformation of a *proof state* (goal ⇒ subgoals, with a
  validation), e.g. RML's `reflexivity`/`rewrite`/`induction`
  ([`_applyTactic`, js/src/rml-links.mjs:3986](../../../js/src/rml-links.mjs#L3986)).
- **Strategy / tactical** — a *combinator* that says **how to apply** rules or
  tactics: in what order, how deep into the term, with what backtracking, how many
  times. A strategy is a *first-class value* built from other strategies.

Issue #181 asks for the third layer: "patterns for iterating over patterns".

## 2. What RML has today

| Layer | Present? | Evidence |
|-------|----------|----------|
| Rules | Yes | assigned-infix rewrite table; `DEFAULT_EVAL_NAT_RULES` :2317 |
| Pattern matching over terms | Yes | `matchProofPattern` :2214, `instantiateProofPattern` :2347 |
| Tactics | Yes (prototype) | `_applyTactic` :3986 — `reflexivity`, `symmetry`, `transitivity`, `suppose`, `introduce`, `rewrite`, `simplify`, `smt`, `atp`, `exact`, `induction` |
| **Strategy combinators** | **No** | `grep -niE 'topdown|bottomup|innermost|tactical|combinator' js/src rust/src` → no hits |

So the building blocks (rules, a matcher, tactics) exist; the **combinator layer
that composes them is entirely missing**. That is exactly the gap to fill.

## 3. Design principles

1. **One algebra, two domains.** The *same* combinator set drives both
   term-rewriting strategies (over expressions/`Node`s) and proof tactics (over
   goal states). This is the LCF + Stratego insight; it keeps the surface small.
2. **Derive traversal, don't hardcode it.** Following
   [Visser 2005](./existing-tools.md#tier-2--reference-designs-to-imitate-not-dependencies),
   provide the **one-level traversal operators `all`/`one`/`some`** as primitives
   and *derive* `topdown`/`bottomup`/`innermost`/… in the library. Smaller kernel,
   provably complete coverage.
3. **Success/failure is the control-flow currency.** Every strategy either
   *succeeds* (optionally transforming the subject) or *fails*. Choice and repeat
   are defined in terms of failure, exactly as in Stratego/LCF.
4. **Parity first (N1).** The core is implemented twice — JS and Rust — with an
   identical combinator set and identical semantics, and a shared conformance test
   suite. No combinator may exist in one implementation only.
5. **Manipulate via meta-language (R5).** Where a strategy needs to *match* or
   *rewrite* a subterm, it calls meta-language's `LinkQuery`/`find`/`replace`/
   `SubstitutionRule` (Rust) or the JS bridge to them
   ([`meta-language-integration.md`](./meta-language-integration.md)) rather than
   ad-hoc AST walking. The strategy library is the *scheduler*; meta-language is
   the *matcher/rewriter*.
6. **Bounded by construction (R7).** Every potentially non-terminating combinator
   (`repeat`, `innermost`, fixpoints, saturation) takes an optional **fuel/depth**
   bound — directly closing the "Search depth controls = No" gap in
   [`docs/FEATURE-COMPARISON.md:60`](../../FEATURE-COMPARISON.md).

## 4. The core combinator algebra

The kernel — the smallest set that generates everything else (names follow
Stratego/Visser; LCF aliases noted):

| Combinator | Meaning | LCF/prover analogue |
|------------|---------|---------------------|
| `id` | Always succeed; leave subject unchanged. | `ALL_TAC` / `idtac` |
| `fail` | Always fail. | `NO_TAC` / `fail` |
| `seq(s1, s2)` — `s1 ; s2` | Apply `s1`, then `s2` to its result; fail if either fails. | `THEN` / `;` |
| `lchoice(s1, s2)` — `s1 <+ s2` | Deterministic left choice: try `s1`; if it fails, try `s2`. | `ORELSE` / `first` |
| `choice(s1, s2)` — `s1 + s2` | Non-deterministic (backtracking) choice. | Ltac `||` w/ backtracking |
| `rec(x, s)` / named strategy | Recursion / fixpoint by name. | recursive tactic defs |
| `all(s)` | Apply `s` to **every** immediate child; succeed iff all succeed. | (one-level traversal) |
| `one(s)` | Apply `s` to **exactly one** child (the first that succeeds). | (one-level traversal) |
| `some(s)` | Apply `s` to **at least one** child; succeed iff ≥1 succeeds. | (one-level traversal) |

`all`/`one`/`some` operate on the **children of the current node** (in RML: the
elements of a `List` `Node`, or the captured children of a meta-language link).
This is the generic-traversal core from Visser's survey; with `seq`, `lchoice`
and `rec` it generates every traversal scheme below.

## 5. Derived (library) strategies

All defined in terms of the kernel — the "library of patterns" itself:

```text
try(s)        = s <+ id
repeat(s)     = try(s ; repeat(s))           -- 0+ times, to fixpoint
repeat1(s)    = s ; repeat(s)                 -- 1+ times
test(s)       = where(s)                      -- succeed iff s succeeds, discard effect
not(s)        = test(s) <+ id  ->  fail/id    -- negation-as-failure
while(c, s)   = repeat(c ; s)
topdown(s)    = s ; all(topdown(s))           -- pre-order, whole tree
bottomup(s)   = all(bottomup(s)) ; s          -- post-order, whole tree
downup(s)     = s ; all(downup(s)) ; s
oncetd(s)     = s <+ one(oncetd(s))           -- first match, top-down
oncebu(s)     = one(oncebu(s)) <+ s           -- first match, bottom-up
alltd(s)      = s <+ all(alltd(s))            -- topmost matches, don't recurse into them
innermost(s)  = repeat(oncebu(s))             -- normalise innermost-first
outermost(s)  = repeat(oncetd(s))
```

For the **proof/goal** domain we add goal-targeting combinators borrowed from
Ltac/Lean:

```text
all_goals(t)  = apply tactic t to every open subgoal
any_goals(t)  = apply t to each subgoal, succeed if ≥1 succeeds
first([t...]) = t1 <+ t2 <+ ... <+ fail
solve(t)      = t, then fail unless the goal is fully closed
progress(t)   = t, then fail unless the state changed
do(n, t)      = apply t exactly n times
```

This set is a **superset** of what Ltac, Lean, Eisbach and `rewrite_strat`
expose, expressed in one algebra — which is what "beat competitors by features"
(R7) requires for the automation rows.

## 6. Two domains

The same algebra is instantiated for two *subjects*:

- **Term-rewriting strategies** — subject is an expression (RML `Node` / a
  meta-language link). A *rule* (assigned-infix entry, eval-nat rule, or a
  meta-language `SubstitutionRule`) is lifted to a leaf strategy `apply(rule)`
  that succeeds iff the rule fires at the current node. `topdown`/`innermost`/…
  then schedule it across the term. This is RML's missing **rewrite scheduling**.
- **Goal/tactic strategies** — subject is a proof state. An existing RML tactic
  (`reflexivity`, `rewrite`, `induction`, …) is a leaf strategy; `seq`,
  `lchoice`, `repeat`, `all_goals`, `first`, `solve` schedule them. This is RML's
  missing **tactic combinator layer** ([`docs/CONCEPTS-COMPARISON.md:180`](../../CONCEPTS-COMPARISON.md)).

A single dispatcher decides which subject a strategy expression targets based on
where it is invoked (`rml run`'s evaluator vs the proof engine).

## 7. Surface syntax

Strategies are written in the RML dialect (LiNo), parsed — per **R4** — through
meta-language. A draft surface (final names to be fixed in ST1):

```lino
(strategy simplifyAll
  (innermost
    (lchoice
      (apply add-zero)
      (apply mul-one))))

(strategy proveEq
  (seq
    (try (rewrite assoc))
    (repeat (lchoice reflexivity (rewrite comm)))
    (solve reflexivity)))
```

Sugar (operator forms mirroring the literature, optional layer in ST4):

```lino
simplifyAll := innermost (add-zero <+ mul-one)
proveEq     := try (rewrite assoc) ; repeat (reflexivity <+ rewrite comm) ; solve reflexivity
```

Because the dialect is parsed by meta-language, a strategy *is itself* a
meta-language network — so strategies can be queried, rewritten and translated by
the very same machinery (this is the "do all manipulation that way" property, R5).

## 8. JS and Rust signatures (parity)

To honour **N1**, the two implementations expose the same shape. Sketch:

**JavaScript** (`js/src/strategy.mjs`, new):

```js
// A Strategy is (subject, ctx) -> { ok: boolean, subject?: Subject }
export const id   = (s) => ({ ok: true, subject: s });
export const fail = () => ({ ok: false });
export const seq      = (a, b) => (s, c) => { const r = a(s, c); return r.ok ? b(r.subject, c) : r; };
export const lchoice  = (a, b) => (s, c) => { const r = a(s, c); return r.ok ? r : b(s, c); };
export const all  = (a) => (s, c) => /* apply a to every child of s */;
export const one  = (a) => (s, c) => /* apply a to first child that succeeds */;
export const some = (a) => (s, c) => /* apply a to ≥1 child */;
export const try_   = (a) => lchoice(a, id);
export const repeat = (a) => (s, c) => try_(seq(a, repeat(a)))(s, c);
// topdown/bottomup/innermost/oncetd/... derived as in §5, all fuel-aware (§9).
```

**Rust** (`rust/src/strategy.rs`, new):

```rust
pub enum Outcome { Ok(Subject), Fail }
pub trait Strategy { fn apply(&self, s: Subject, ctx: &mut Ctx) -> Outcome; }
// id, Fail, Seq(a,b), LChoice(a,b), Choice(a,b), All(a), One(a), Some(a) as structs;
// try/repeat/topdown/bottomup/innermost/... as constructor fns returning Box<dyn Strategy>.
```

The `Subject` is either an RML expression (`Node` / meta-language link handle) or
a proof state; `Ctx` carries the rule environment, the meta-language network
handle, and the **fuel budget** (§9). A shared JSON conformance corpus
(`tests/strategy-conformance/*.json`) asserts both implementations produce
identical traces.

## 9. Search-depth and fuel controls

This directly closes the only outright **"No"** in
[`docs/FEATURE-COMPARISON.md:60`](../../FEATURE-COMPARISON.md) ("Search depth
controls"). Every non-terminating-by-nature combinator accepts a bound:

- `repeat(s, {fuel})`, `innermost(s, {fuel})`, `saturate(rules, {iters, nodes})`.
- A global `Ctx.fuel` budget decremented per rule firing; on exhaustion the
  strategy fails cleanly (no partial/unsound state) and reports the bound hit.
- CLI/flags: `rml run --max-steps N`, `rml prove --depth N --fuel N`.
- Defaults are finite, so a buggy strategy cannot hang CI (N5).

## 10. Soundness

Strategies are **schedulers, not new inference rules** (N6). Concretely:

- A goal/tactic strategy may only invoke tactics that already produce
  kernel-checked steps; combinators just choose *which* and *when*. The validation
  chain is unchanged from `_applyTactic` today.
- A term-rewriting strategy may only fire rules that are already sound rewrites
  (assigned-infix table, eval-nat, or a declared `SubstitutionRule`); `all`/`one`/
  `some`/`topdown`/… cannot invent rewrites.
- SMT/ATP leaves remain recorded as trusted external nodes exactly as today
  ([`docs/CONCEPTS-COMPARISON.md:200`](../../CONCEPTS-COMPARISON.md)); a strategy
  that calls `smt`/`atp` inherits that trust label, it does not launder it.

Therefore adding the strategy layer cannot make a previously-unprovable goal
provable by unsound means; it can only make sound proofs *shorter to write*.

## 11. Worked examples

**Normalise an arithmetic expression to a fixpoint, innermost-first:**

```lino
(strategy norm (innermost (lchoice (apply add-zero) (apply mul-one))))
; norm applied to (+ (* x 1) 0)  ==>  x
```

**A one-line "auto" tactic that beats hand-rolled scripts:**

```lino
(strategy auto
  (repeat
    (first reflexivity
           (rewrite-db simp)
           (assumption)
           (split))
    (fuel 200)))
```

`auto` is the kind of high-leverage combinator (`first` + `repeat` + a rewrite DB
+ a fuel bound) that Lean's `simp`/`aesop`, Rocq's `auto`/`autorewrite`, and
Isabelle's `auto` provide and RML currently does not. Shipping it — with the
depth control of §9 — is what moves the *Proof Engineering and Automation* rows of
the comparison docs from "Part"/"No" to "Yes" (R7).
