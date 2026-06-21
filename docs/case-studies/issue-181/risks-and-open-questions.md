# Risks and open questions — Issue #181

The design trade-offs we are not yet ready to commit to, and the risks the
implementation phases ([`sub-issues.md`](./sub-issues.md)) must plan around,
ordered by expected impact (highest first).

## Q1. meta-language has no npm package — RESOLVED 2026-06-21 (downgraded)

> **Was the dominant risk.** When this case study was written (2026-06-18),
> `meta-language` was Rust-only with **no npm package** (registry → 404), so the
> JS half of RML could not adopt it and Phase MX risked forking into two stacks.

**Resolution.** meta-language now ships a **native JavaScript implementation with
enforced Rust↔JS parity** (`@link-foundation/meta-language` v0.46.0; upstream
[#163](https://github.com/link-foundation/meta-language/issues/163), closed
2026-06-21). The smoke test
([`experiments/issue-181-meta-language-js-smoke.mjs`](../../../experiments/issue-181-meta-language-js-smoke.mjs))
confirms the JS package covers RML's representation, query, substitution and
translation needs (**7 PASS / 0 FAIL**). RML now adopts it **directly**, with no
wasm build or JS port to own.

**Residual (packaging only, non-blocking):** the JS package is **not yet on npm**
(`npm view` → 404, verified 2026-06-21) → upstream
[#165](https://github.com/link-foundation/meta-language/issues/165). RML pins a
**git dependency** behind the `MetaLang` façade until the package is published,
then switches to a version range — exactly as it already pins `links-notation
0.13.0`. This is no longer the riskiest sub-task.

## Q2. Is meta-language actually "feature-rich enough"?

meta-language is young (created 2026-06-05, 0 stars, 694 downloads) and the issue
itself only *hopes* it is sufficient ("it should be … enough").

**Risk:** adopting it before confirming coverage could strand RML constructs that
it cannot represent.

**Recommendation:** gate adoption on the **MX1 audit** — a construct-by-construct
mapping with an explicit decision for every gap (extend dialect / upstream request
/ RML overlay). Pin the exact version; bump deliberately.

## Q3. Truth values: Rust-only in meta-language + semantic reconciliation

meta-language ships many-valued `TruthValue` + fixed-point
`ProbabilisticTruthValue`, **but only in Rust** — they are absent from the JS
package and from the parity manifest (verified 2026-06-21), filed upstream as
[#166](https://github.com/link-foundation/meta-language/issues/166). RML has its
own probabilistic/many-valued truth ranges and valence model.

**Risk:** (a) RML cannot delegate truth semantics to meta-language on the **JS**
side until #166 lands; (b) even once present, subtle mismatches (lattice ordering,
fixed-point semantics, defaults) could change evaluation results.

**Why non-blocking:** RML keeps its **own** JS truth model regardless, so adopting
meta-language for representation + manipulation (the two pillars) does not depend
on (a). The reconciliation only becomes load-bearing if RML later chooses to
delegate truth semantics to meta-language.

**Recommendation:** treat truth-value delegation as a **later, optional** step
gated on upstream #166; when taken, MX1 reconciles the two models
construct-by-construct with differential tests against current RML outputs. Both
are many-valued/probabilistic, so the surface area is small — but it must be
checked, not assumed.

## Q4. Convergence vs collision with the CST epic (#138)

meta-language is itself a lossless CST/network, and [issue #138](../issue-138/) is
mid-flight building `.lino` ⇄ host-language CST converters.

**Risk:** two parallel "universal representation" efforts that duplicate or
contradict each other (violates N4).

**Recommendation:** MX2/MX4 explicitly reuse meta-language as the CST substrate and
coordinate with #138's owners; the #138 converters become projections/printers
over the shared network rather than a second stack.

## Q5. Strategy non-termination and CI hangs

`repeat`, `innermost`, fixpoints and equality saturation can loop forever on
non-confluent or non-terminating rule sets.

**Risk:** a user (or a generated) strategy hangs `rml` and CI.

**Recommendation:** make fuel/depth bounds first-class (ST5) — every
non-terminating-by-nature combinator takes a bound; a global fuel budget fails
cleanly on exhaustion; CLI defaults are finite. This is also the feature that
closes the "Search depth controls = No" gap (R7), so it pays double.

## Q6. Soundness of automation

Adding `auto`/`first`/`repeat`/`saturate` makes it easy to write powerful tactics.

**Risk:** a combinator appears to "prove" a goal by an unsound shortcut.

**Recommendation:** strategies are **schedulers only** — they may invoke only
already-certified tactics/rewrites, and SMT/ATP leaves keep their trusted-external
label ([`strategy-library.md` §10](./strategy-library.md#10-soundness)). Add
adversarial tests that a strategy cannot close a false goal.

## Q7. Surface-syntax operator choices

The literature uses overloaded symbols (`;`, `<+`, `+`, `<;>`, `|`, `?`, `+`) and
they conflict across systems (e.g. `+` is "repeat" in Eisbach but
"non-deterministic choice" in Stratego).

**Risk:** picking confusing or colliding operators in the RML dialect.

**Recommendation:** ship the explicit `(seq …)`/`(lchoice …)` forms first (ST1)
and add operator sugar (ST4) only after fixing a table that avoids collisions with
existing RML syntax; document it in `docs/STRATEGIES.md`. Avoid inventing
non-standard operators (e.g. the non-existent Stratego `+>`).

## Q8. Maintenance cost of a JS port — NO LONGER APPLICABLE (2026-06-21)

This risk assumed RML might have to **port** meta-language's kernel to JS (the old
Option D) and keep it in sync with the Rust crate. That is moot: meta-language now
ships its **own** JS package with an upstream `check:parity` gate that guards
Rust↔JS drift. RML depends on it rather than maintaining a port, so there is no
second implementation for RML to keep in sync.

## Q9. Performance of network-backed representation

Replacing lightweight `Node` trees with a lossless `LinkNetwork` (plus optional
`doublets` storage) increases node count and indirection.

**Risk:** evaluation/rewriting slows down on large inputs.

**Recommendation:** keep the AbstractSyntax projection as the hot path; measure on
the existing corpus before optimising; the `doublets` backend is opt-in. Inherit
the "measure first" discipline from [issue #138 Q9](../issue-138/risks-and-open-questions.md).

## Q10. Scope and sequencing

This is a large vision (representation + manipulation + translation + a whole
strategy language + a competitor-beating push).

**Risk:** the epic balloons and never lands.

**Recommendation:** each sub-issue in [`sub-issues.md`](./sub-issues.md) is
independently shippable and behind an opt-in flag until proven; land MX1→MX2 and
ST1 first (they unblock everything), defer MX4/QC until the core is stable, modelled
on the parity-epic discipline in [issue #95](../issue-95/).

## Open questions for the maintainer

1. **JS bridge preference — ANSWERED 2026-06-21:** meta-language now ships a native
   JS package, so RML depends on it directly (git-pinned until npm publish
   [#165](https://github.com/link-foundation/meta-language/issues/165)); no
   wasm/napi/port needed. The only remaining maintainer call here is whether to
   wait for npm publish before wiring MX, or to start now on the git pin.
2. **Relationship to #138:** should Phase MX formally absorb the #138 CST converter
   work, or run beside it with a shared meta-language substrate?
3. **Default flip:** what bar (which test suites green, what parity %) authorises
   making `--via-meta-language` the default?
4. **Issue creation:** should the assistant be authorised to file the
   [`sub-issues.md`](./sub-issues.md) issues automatically, or will a maintainer
   create them after review?
