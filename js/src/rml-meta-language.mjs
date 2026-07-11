import {
  LinkMetadata,
  LinkNetwork,
  LinkQuery,
  LinkType,
  ParseConfiguration,
  Probability,
  ProbabilisticTruthValue,
  ReplacementRule,
  SubstitutionRule,
  TranslationRule,
  TranslationRuleSet,
  TruthValue,
} from 'meta-language';
import { evaluate, parseLino } from './rml-links.mjs';

const RML_META_LANGUAGE = 'RML';
const JAVA_SCRIPT_LANGUAGE = 'JavaScript';
const JS_IDENTIFIER_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function assertJavaScriptIdentifier(value, role) {
  if (!JS_IDENTIFIER_RE.test(value)) {
    throw new Error(`${role} must be a JavaScript identifier`);
  }
}

function defaultConfiguration(configuration) {
  return configuration ?? ParseConfiguration.default();
}

function linkIdValue(id) {
  return typeof id?.asU64 === 'function' ? id.asU64() : Number(id);
}

/**
 * Parse RML source into the shared meta-language lossless network.
 */
function parseRmlToMetaLanguage(source, options = {}) {
  return LinkNetwork.parse(
    String(source),
    options.language ?? RML_META_LANGUAGE,
    defaultConfiguration(options.configuration),
  );
}

function reconstructRmlFromMetaLanguage(network) {
  return network.reconstructText();
}

function parseRmlLinksViaMetaLanguage(source, options = {}) {
  return parseLino(reconstructRmlFromMetaLanguage(parseRmlToMetaLanguage(source, options)));
}

function rmlMetaLanguageParityReport(source, options = {}) {
  const text = String(source);
  const language = options.language ?? RML_META_LANGUAGE;
  const network = parseRmlToMetaLanguage(text, options);
  const reconstructed = reconstructRmlFromMetaLanguage(network);
  const directLinks = parseLino(text);
  const metaLinks = parseLino(reconstructed);
  const direct = evaluate(text, options.evaluationOptions ?? {});
  const meta = evaluate(reconstructed, options.evaluationOptions ?? {});

  return {
    language,
    reconstructed,
    networkLinkCount: network.len(),
    roundTripOk: reconstructed === text,
    directLinks,
    metaLinks,
    linkParityOk: sameJson(directLinks, metaLinks),
    directResults: direct.results,
    metaResults: meta.results,
    directDiagnostics: direct.diagnostics,
    metaDiagnostics: meta.diagnostics,
    evaluationParityOk: sameJson(direct.results, meta.results) &&
      sameJson(direct.diagnostics, meta.diagnostics),
  };
}

function rewriteJavaScriptIdentifierViaMetaLanguage(source, from, to) {
  assertJavaScriptIdentifier(from, 'from');
  assertJavaScriptIdentifier(to, 'to');

  const network = LinkNetwork.parse(
    String(source),
    JAVA_SCRIPT_LANGUAGE,
    ParseConfiguration.default(),
  );
  const query = LinkQuery.fromSexpression(`(identifier) @target\n(#eq? @target "${from}")`);
  const matches = network.find(query);
  const report = network.replace(matches, ReplacementRule.capturedText('target', to));

  return {
    source: network.reconstructText(),
    matchCount: matches.length,
    changed: !report.isEmpty(),
    report,
  };
}

function metaLanguageSubstitutionSmoke() {
  const network = new LinkNetwork();
  const a = network.insertPoint('a');
  const b = network.insertPoint('b');
  const relation = network.insertLink(
    [a],
    LinkMetadata.new().withLinkType(LinkType.Relation),
  );
  const report = network.applySubstitution(new SubstitutionRule([a], [b]));
  const changed = network.link(relation)
    ?.references()
    .some(reference => linkIdValue(reference) === linkIdValue(b)) ?? false;

  return {
    updated: report.updated().length,
    changed,
  };
}

function renderMetaLanguageTranslationSmoke(source = '(namespace self)') {
  const network = parseRmlToMetaLanguage(source);
  const rules = new TranslationRuleSet('rml-smoke').withRule(
    new TranslationRule(
      'any-source-token',
      LinkQuery.byType(LinkType.SourceToken).withTerm('('),
    ).withTemplate('text', 'translated'),
  );

  return network.reconstructTextAsWithRules('text', ParseConfiguration.default(), rules);
}

function metaLanguageTruthSmoke() {
  const half = ProbabilisticTruthValue.fromRatio(1, 2);

  return {
    conjunction: TruthValue.True.and(TruthValue.Unknown).toString(),
    probabilityBasisPoints: Probability.fromRatio(1, 4).basisPoints(),
    probabilisticAndBasisPoints: half.and(half).trueProbability().basisPoints(),
  };
}

function metaLanguageFeatureReport(source = '(namespace self)\n(? (a = a))\n') {
  return {
    packageName: 'meta-language',
    rml: rmlMetaLanguageParityReport(source),
    substitution: metaLanguageSubstitutionSmoke(),
    translation: renderMetaLanguageTranslationSmoke('(namespace self)'),
    truth: metaLanguageTruthSmoke(),
  };
}

export {
  LinkNetwork,
  LinkQuery,
  LinkType,
  ParseConfiguration,
  Probability,
  ProbabilisticTruthValue,
  ReplacementRule,
  SubstitutionRule,
  TranslationRule,
  TranslationRuleSet,
  TruthValue,
  metaLanguageFeatureReport,
  metaLanguageSubstitutionSmoke,
  metaLanguageTruthSmoke,
  parseRmlLinksViaMetaLanguage,
  parseRmlToMetaLanguage,
  reconstructRmlFromMetaLanguage,
  renderMetaLanguageTranslationSmoke,
  rewriteJavaScriptIdentifierViaMetaLanguage,
  rmlMetaLanguageParityReport,
};
