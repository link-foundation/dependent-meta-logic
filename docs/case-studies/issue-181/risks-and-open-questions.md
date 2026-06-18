# Risks and open questions — Issue #181

The design trade-offs we are not yet ready to commit to, and the risks the
implementation phases ([`sub-issues.md`](./sub-issues.md)) must plan around,
ordered by expected impact (highest first).

## Q1. meta-language has no npm package (dominant risk)

`meta-language` is a Rust crate (v0.45.0) with **no npm package** (registry → 404,
verified 2026-06-18). RML must keep JS and Rust at parity (N1).

**Risk:** the JS implementation cannot adopt meta-language directly, so the whole
representation/manipulation plan (Phase MX) could fork into two divergent stacks.

**Options:** (B) request/await an upstream wasm/napi npm publish; (A) build a wasm
façade ourselves; (D) port the minimal kernel to JS over `links-notation`;
(C) subprocess bridge (escape hatch only). See
[`meta-language-integration.md` §5](./meta-language-integration.md#5-js-integration-options).

**Recommendation:** pursue B and A in parallel behind a single `MetaLang` façade,
with D as the guaranteed fallback. Code RML against the façade so the backing
implementation is swappable. This is the riskiest sub-task (JS-bridge under MX2).

## Q2. Is meta-language actually "feature-rich enough"?

meta-language is young (created 2026-06-05, 0 stars, 694 downloads) and the issue
itself only *hopes* it is sufficient ("it should be … enough").

**Risk:** adopting it before confirming coverage could strand RML constructs that
it cannot represent.

**Recommendation:** gate adoption on the **MX1 audit** — a construct-by-construct
mapping with an explicit decision for every gap (extend dialect / upstream request
/ RML overlay). Pin the exact version; bump deliberately.

## Q3. Semantic reconciliation of truth values

meta-language ships many-valued `TruthValue` + fixed-point
`ProbabilisticTruthValue`; RML has its own probabilistic/many-valued truth ranges
and valence model.

**Risk:** subtle mismatches (lattice ordering, fixed-point semantics, default
values) could change evaluation results.

**Recommendation:** MX1 reconciles the two models construct-by-construct with
differential tests against current RML outputs before MX2 flips any default. Both
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

## Q8. Maintenance cost of a JS port (if Option D)

If the wasm/upstream routes stall, porting meta-language's kernel to JS creates a
second implementation to keep in sync with a fast-moving young crate.

**Risk:** drift between the JS port and the Rust crate.

**Recommendation:** port only the **minimal** kernel the façade needs, behind the
exact wasm interface (so it is swappable), and run a conformance corpus generated
from the Rust crate on every CI run to detect drift early.

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

1. **JS bridge preference:** is upstream willing to publish a wasm/napi npm package
   for meta-language (Option B), or should RML own a wasm/port (A/D)?
2. **Relationship to #138:** should Phase MX formally absorb the #138 CST converter
   work, or run beside it with a shared meta-language substrate?
3. **Default flip:** what bar (which test suites green, what parity %) authorises
   making `--via-meta-language` the default?
4. **Issue creation:** should the assistant be authorised to file the
   [`sub-issues.md`](./sub-issues.md) issues automatically, or will a maintainer
   create them after review?
