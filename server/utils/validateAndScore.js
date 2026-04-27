/**
 * MCQ Validation & Confidence Scoring
 *
 * computeConfidence(q) → 0.0 – 1.0
 *
 * Score factors:
 *  - Has exactly 4 distinct, non-empty options      (+0.30)
 *  - Correct answer found (not guessed)             (+0.25)
 *  - Correct answer exists in options list          (+0.15)
 *  - Question is long enough (≥ 10 chars)           (+0.10)
 *  - All options are reasonably long (≥ 2 chars)    (+0.10)
 *  - No duplicate options                           (+0.10)
 *
 * validateMCQ(q) → true/false — hard structural check
 * enrichQuestion(q) → attaches .confidence + .validationErrors[]
 * filterAndEnrich(questions) → removes structurally invalid, enriches valid
 */

/**
 * Hard validation — question MUST pass this to enter the DB.
 * Returns array of error strings (empty = valid).
 */
function validateMCQ(q) {
  const errors = [];

  if (!q.question || typeof q.question !== 'string' || q.question.trim().length < 5) {
    errors.push('Question text is missing or too short');
  }

  if (!Array.isArray(q.options)) {
    errors.push('Options must be an array');
  } else {
    if (q.options.length !== 4) {
      errors.push(`Expected 4 options, got ${q.options.length}`);
    }
    const nonEmpty = q.options.filter(o => typeof o === 'string' && o.trim().length >= 1);
    if (nonEmpty.length < 4) {
      errors.push('One or more options are empty');
    }
    const unique = new Set(q.options.map(o => o.trim().toLowerCase()));
    if (unique.size < q.options.length) {
      errors.push('Duplicate options detected');
    }
  }

  if (!q.correctAnswer || typeof q.correctAnswer !== 'string' || q.correctAnswer.trim().length < 1) {
    errors.push('Correct answer is missing');
  }

  return errors;
}

/**
 * Compute a 0–1 confidence score for a parsed MCQ.
 */
function computeConfidence(q) {
  let score = 0;

  // 1. Has exactly 4 distinct non-empty options (0.30)
  if (Array.isArray(q.options) && q.options.length === 4) {
    const nonEmpty = q.options.filter(o => typeof o === 'string' && o.trim().length >= 2);
    const unique = new Set(q.options.map(o => (o || '').trim().toLowerCase()));
    if (nonEmpty.length === 4 && unique.size === 4) {
      score += 0.30;
    } else if (nonEmpty.length >= 3) {
      score += 0.15;
    }
  }

  // 2. Correct answer was detected (not guessed as first option) (0.25)
  if (q.correctAnswer && !q.needsReview) {
    score += 0.25;
  } else if (q.correctAnswer) {
    score += 0.08; // partial — at least something is set
  }

  // 3. Correct answer is actually one of the options (0.15)
  if (
    q.correctAnswer &&
    Array.isArray(q.options) &&
    q.options.some(o => o.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase())
  ) {
    score += 0.15;
  }

  // 4. Question is long enough (0.10)
  if (q.question && q.question.trim().length >= 20) {
    score += 0.10;
  } else if (q.question && q.question.trim().length >= 10) {
    score += 0.05;
  }

  // 5. All options reasonably long (≥ 3 chars each) (0.10)
  if (Array.isArray(q.options) && q.options.every(o => typeof o === 'string' && o.trim().length >= 3)) {
    score += 0.10;
  }

  // 6. No duplicate options (0.10)
  if (Array.isArray(q.options)) {
    const unique = new Set(q.options.map(o => (o || '').trim().toLowerCase()));
    if (unique.size === q.options.length) {
      score += 0.10;
    }
  }

  return Math.min(1, parseFloat(score.toFixed(2)));
}

/**
 * Attach .confidence + .validationErrors to a question object.
 * Does NOT mutate the original.
 */
function enrichQuestion(q) {
  const validationErrors = validateMCQ(q);
  const confidence = computeConfidence(q);
  return {
    ...q,
    confidence,
    validationErrors,
    needsReview: q.needsReview || validationErrors.length > 0 || confidence < 0.7,
  };
}

/**
 * Process an array of raw extracted questions:
 *  1. Enrich each with confidence + validationErrors
 *  2. Remove questions that fail hard validation (structurally broken)
 *  3. Return { valid[], rejected[] } so caller can log/report rejections
 */
function filterAndEnrich(questions) {
  const valid = [];
  const rejected = [];

  for (const q of questions) {
    const enriched = enrichQuestion(q);
    const errors = validateMCQ(q);

    if (errors.length > 0) {
      // Hard failure — missing question text, wrong option count, etc.
      rejected.push({ ...enriched, rejectionReasons: errors });
    } else {
      valid.push(enriched);
    }
  }

  return { valid, rejected };
}

module.exports = { validateMCQ, computeConfidence, enrichQuestion, filterAndEnrich };
