// interpretation.js - Plain-language interpretation of regression results
//
// aiInterpretationToMarkdown(): formats the AI gateway's structured /interpret
// response. templateInterpretation(): deterministic fallback used when the AI
// gateway is unavailable (no API key, budget reached, or an error).

const fmt = (x, digits = 3) => {
  if (typeof x !== 'number' || !Number.isFinite(x)) return 'N/A';
  const abs = Math.abs(x);
  if (abs !== 0 && (abs >= 1e6 || abs < 1e-3)) return x.toExponential(digits - 1);
  return Number(x.toPrecision(digits)).toString();
};

const pValue = (row) => row['p.value'] ?? row.p_value;

const pText = (p) =>
  typeof p === 'number' ? (p < 0.001 ? 'p < 0.001' : `p = ${p.toFixed(3)}`) : 'p = N/A';

const cleanTerm = (term) => String(term).replace(/`/g, '');

export function templateInterpretation({ modelType, tidy = [], glance = {}, dependentVar, successLevel, warning }) {
  const lines = [`## ${modelType === 'logistic' ? 'Logistic' : 'OLS'} Regression Results`, ''];
  const g = Array.isArray(glance) ? glance[0] || {} : glance;

  if (warning) lines.push(`> ⚠️ ${warning}`, '');

  if (modelType === 'ols') {
    const r2 = g['r.squared'] ?? g.r_squared;
    if (typeof r2 === 'number') {
      lines.push(
        `**Model fit:** the predictors together explain **${(r2 * 100).toFixed(1)}%** of the variation in ${dependentVar} (R² = ${fmt(r2)}). ` +
          'What counts as a "good" R² depends on the field; in the social sciences, modest values are common.',
        ''
      );
    }
  } else if (typeof g.AIC === 'number') {
    lines.push(`**Model fit:** AIC = ${g.AIC.toFixed(2)} (lower is better when comparing models on the same data).`, '');
  }

  const terms = tidy.filter((row) => row.term !== '(Intercept)');
  if (terms.length) lines.push('**Predictors:**', '');

  for (const row of terms) {
    const term = cleanTerm(row.term);
    const p = pValue(row);
    const significant = typeof p === 'number' && p < 0.05;
    const sigText = significant ? 'statistically significant at the 5% level' : 'not statistically significant at the 5% level';

    if (modelType === 'logistic') {
      // Coefficients are log-odds; the interpretable quantity is the odds ratio
      const or = typeof row.odds_ratio === 'number' ? row.odds_ratio : Math.exp(row.estimate);
      const pct = (or - 1) * 100;
      const direction = pct >= 0 ? `${fmt(Math.abs(pct))}% higher` : `${fmt(Math.abs(pct))}% lower`;
      const outcome = successLevel ? `${dependentVar} = ${successLevel}` : dependentVar;
      lines.push(
        `- **${term}**: each 1-unit increase multiplies the odds of ${outcome} by **${fmt(or)}** ` +
          `(odds ${direction}), holding the other predictors constant (${pText(p)}, ${sigText}).`
      );
    } else {
      const b = row.estimate;
      const direction = b >= 0 ? 'higher' : 'lower';
      lines.push(
        `- **${term}**: each 1-unit increase is associated with a ${fmt(Math.abs(b))}-unit ${direction} ${dependentVar}, ` +
          `holding the other predictors constant (${pText(p)}, ${sigText}).`
      );
    }
  }

  lines.push('', '_These are associations in your data, not proof of cause and effect._');
  return lines.join('\n');
}

export function aiInterpretationToMarkdown(ai, { warning } = {}) {
  const lines = ['## Interpretation', ''];
  if (warning) lines.push(`> ⚠️ ${warning}`, '');
  if (ai.summary) lines.push(ai.summary, '');
  if (ai.model_quality) {
    lines.push(`**Model quality:** ${ai.model_quality.rating || ''} — ${ai.model_quality.explanation || ''}`.trim(), '');
  }
  if (Array.isArray(ai.key_findings) && ai.key_findings.length) {
    lines.push('**Key findings:**', ...ai.key_findings.map((f) => `- ${f}`), '');
  }
  if (Array.isArray(ai.coefficients) && ai.coefficients.length) {
    lines.push(
      '**Predictors:**',
      ...ai.coefficients.map((c) => `- **${cleanTerm(c.variable)}** (${c.significance || 'n/a'}): ${c.interpretation || ''}`),
      ''
    );
  }
  if (Array.isArray(ai.limitations) && ai.limitations.length) {
    lines.push('**Limitations:**', ...ai.limitations.map((l) => `- ${l}`), '');
  }
  if (ai.recommendations) lines.push(`**Next steps:** ${ai.recommendations}`, '');
  lines.push('_AI-generated explanation; check it against the statistical output._');
  return lines.join('\n');
}
