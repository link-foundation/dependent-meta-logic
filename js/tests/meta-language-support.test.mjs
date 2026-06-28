import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  metaLanguageFeatureReport,
  metaLanguageSubstitutionSmoke,
  metaLanguageTruthSmoke,
  parseRmlLinksViaMetaLanguage,
  parseRmlToMetaLanguage,
  reconstructRmlFromMetaLanguage,
  renderMetaLanguageTranslationSmoke,
  rewriteJavaScriptIdentifierViaMetaLanguage,
  rmlMetaLanguageParityReport,
} from '../src/rml-meta-language.mjs';

const RML_SAMPLE = [
  '(a: a is a)',
  '((a = a) has probability 1)',
  '(? (a = a))',
].join('\n') + '\n';

describe('meta-language support', () => {
  it('represents RML source losslessly through meta-language', () => {
    const network = parseRmlToMetaLanguage(RML_SAMPLE);

    assert.ok(network.len() >= RML_SAMPLE.length);
    assert.strictEqual(reconstructRmlFromMetaLanguage(network), RML_SAMPLE);
    assert.deepStrictEqual(parseRmlLinksViaMetaLanguage(RML_SAMPLE), [
      '(a: a is a)',
      '((a = a) has probability 1)',
      '(? (a = a))',
    ]);
  });

  it('keeps RML parser and evaluator results identical after meta-language round trip', () => {
    const report = rmlMetaLanguageParityReport(RML_SAMPLE);

    assert.strictEqual(report.language, 'RML');
    assert.strictEqual(report.roundTripOk, true);
    assert.strictEqual(report.linkParityOk, true);
    assert.strictEqual(report.evaluationParityOk, true);
    assert.deepStrictEqual(report.directResults, [1]);
    assert.deepStrictEqual(report.metaResults, report.directResults);
    assert.deepStrictEqual(report.metaDiagnostics, report.directDiagnostics);
  });

  it('rewrites JavaScript identifiers through meta-language query and replace', () => {
    const rewritten = rewriteJavaScriptIdentifierViaMetaLanguage(
      'const oldName = call(oldName);\n',
      'oldName',
      'newName',
    );

    assert.strictEqual(rewritten.matchCount, 2);
    assert.strictEqual(rewritten.changed, true);
    assert.strictEqual(rewritten.source, 'const newName = call(newName);\n');
  });

  it('exposes structural substitution support from meta-language', () => {
    const report = metaLanguageSubstitutionSmoke();

    assert.ok(report.updated >= 1);
    assert.strictEqual(report.changed, true);
  });

  it('renders through meta-language translation rules', () => {
    assert.strictEqual(
      renderMetaLanguageTranslationSmoke('(namespace self)'),
      'translated',
    );
  });

  it('exposes meta-language truth semantics used by RML planning', () => {
    assert.deepStrictEqual(metaLanguageTruthSmoke(), {
      conjunction: 'Unknown',
      probabilityBasisPoints: 2500,
      probabilisticAndBasisPoints: 2500,
    });
  });

  it('summarizes the available meta-language features for issue 181', () => {
    const report = metaLanguageFeatureReport(RML_SAMPLE);

    assert.strictEqual(report.packageName, 'meta-language');
    assert.strictEqual(report.rml.roundTripOk, true);
    assert.strictEqual(report.rml.evaluationParityOk, true);
    assert.strictEqual(report.substitution.changed, true);
    assert.strictEqual(report.translation, 'translated');
    assert.strictEqual(report.truth.probabilisticAndBasisPoints, 2500);
  });
});
