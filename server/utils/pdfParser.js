/**
 * Universal PDF MCQ Parser
 * Extracts MCQ questions from uploaded PDF files.
 * 
 * Supports ALL common MCQ formats:
 * 
 *  FORMAT 1 — Checkbox:    Q1. Question?  □ Opt1  □ Opt2  □ Opt3  □ Opt4
 *  FORMAT 2 — Lettered:    1. Question?   A) Opt  B) Opt  C) Opt  D) Opt
 *  FORMAT 3 — Dotted:      1. Question?   a. Opt  b. Opt  c. Opt  d. Opt
 *  FORMAT 4 — Parenthesized: 1) Question? (A) Opt (B) Opt (C) Opt (D) Opt
 *  FORMAT 5 — Numbered opts:  Q1. Question?  1) Opt  2) Opt  3) Opt  4) Opt
 *  FORMAT 6 — Bold/inline:   **1. Question?**  a) Opt  b) Opt  c) Opt  d) Opt
 *  FORMAT 7 — Answer keys:   Answer: A  |  Ans: B  |  Correct: C
 *  FORMAT 8 — 2-column PDF layouts with wide whitespace separators
 *  FORMAT 9 — Mixed formats within same document
 */
const pdfParse = require('pdf-parse');
const fs = require('fs');
const { filterAndEnrich } = require('./validateAndScore');

// ─── Checkbox symbols ──────────────────────────────────────────────
const CHECKBOX_CHARS = '□☐▢◻◽☑☒■▪●○◯◉';
const CHECKBOX_REGEX = new RegExp(`[${CHECKBOX_CHARS}]`, 'g');
const HAS_CHECKBOX = new RegExp(`[${CHECKBOX_CHARS}]`);

// ─── Option letter patterns ────────────────────────────────────────
const OPTION_PATTERNS = [
  // (A) option  or  (a) option
  /(?:^|\n)\s*\(([A-Da-d])\)\s*(.+?)(?=\n\s*\([A-Da-d]\)|\n\s*(?:Q\d|Answer|Ans|$))/gs,
  // A) option  or  a) option
  /(?:^|\n)\s*([A-Da-d])\)\s*(.+?)(?=\n\s*[A-Da-d]\)|\n\s*(?:Q\d|Answer|Ans|$))/gs,
  // A. option  or  a. option
  /(?:^|\n)\s*([A-Da-d])\.\s*(.+?)(?=\n\s*[A-Da-d]\.|\n\s*(?:Q\d|Answer|Ans|$))/gs,
  // A: option  or  a: option
  /(?:^|\n)\s*([A-Da-d]):\s*(.+?)(?=\n\s*[A-Da-d]:|\n\s*(?:Q\d|Answer|Ans|$))/gs,
  // A- option
  /(?:^|\n)\s*([A-Da-d])\-\s*(.+?)(?=\n\s*[A-Da-d]\-|\n\s*(?:Q\d|Answer|Ans|$))/gs,
];

// ─── Question number patterns ──────────────────────────────────────
const QUESTION_SPLIT = /(?:^|\n)\s*(?:Q(?:uestion)?\s*\.?\s*)?(\d+)\s*[.):\-]\s*/gi;
const Q_HEADER = /^Q(\d+)\s*[.\:\)]\s*/i;
const NUM_HEADER = /^(?:Q(?:uestion)?\s*\.?\s*)?(\d+)\s*[.):\-]\s*/i;

// ─── Answer key patterns ───────────────────────────────────────────
const ANSWER_PATTERNS = [
  /(?:answer|ans|correct\s*(?:answer|option)?)\s*[:=\-]\s*\(?([A-Da-d])\)?/i,
  /(?:answer|ans)\s*[:=\-]\s*(.+?)(?:\n|$)/i,
  /\*\*?([A-Da-d])\*\*?\s*$/i,  // Bold answer at end
];

/**
 * Parse a PDF file, extract MCQ questions, validate and score each one.
 * Returns { questions, rawText } where:
 *   - questions: structurally valid MCQs with .confidence and .needsReview
 *   - rawText:   raw extracted text, capped at 50KB for lightweight audit storage
 */
async function parsePDF(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(dataBuffer);
  const rawText = data.text;

  const rawQuestions = extractQuestions(rawText);
  const { valid, rejected } = filterAndEnrich(rawQuestions);

  if (rejected.length > 0) {
    console.warn(
      `[pdfParser] Rejected ${rejected.length} malformed question(s):`,
      rejected.map(r => ({ q: r.question?.substring(0, 40), reasons: r.rejectionReasons }))
    );
  }

  console.log(`[pdfParser] Extracted ${valid.length} valid questions (${rejected.length} rejected)`);

  // Cap rawText at 50KB — enough for debugging, avoids DB bloat
  const MAX_RAW_BYTES = 50 * 1024;
  const truncatedText = Buffer.byteLength(rawText, 'utf8') > MAX_RAW_BYTES
    ? rawText.substring(0, MAX_RAW_BYTES) + '\n[... truncated ...]'
    : rawText;

  return { questions: valid, rawText: truncatedText };
}

/**
 * Main extraction — runs all strategies and returns the best result
 */
function extractQuestions(text) {
  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  // Detect which format the document uses
  const hasCheckboxes = HAS_CHECKBOX.test(normalized);
  const hasLetterOpts = /\n\s*\(?[A-Da-d]\)?\s*[.):\-]\s*.+/m.test(normalized);
  const hasQPrefix = /Q\d+\s*[.):\-]/i.test(normalized);

  let questions = [];

  // Try all strategies, pick the one that extracts the most
  const strategies = [
    () => hasCheckboxes ? extractCheckboxFormat(normalized) : [],
    () => extractLetterFormat(normalized),
    () => extractFallbackFormat(normalized),
  ];

  for (const strategy of strategies) {
    const result = strategy();
    if (result.length > questions.length) {
      questions = result;
    }
  }

  return questions;
}

// ═══════════════════════════════════════════════════════════════════
//  STRATEGY 1: Checkbox format  (□ Option1  □ Option2 ...)
// ═══════════════════════════════════════════════════════════════════
function extractCheckboxFormat(text) {
  const questions = [];

  // Split on Q-number headers
  const blocks = text.split(/(?=Q\d+\s*[.):\-])/gi);

  for (const block of blocks) {
    const headerMatch = block.match(/^Q(\d+)\s*[.):\-]\s*([\s\S]*?)(?=[□☐▢◻◽☑☒■▪●○◯◉]|$)/i);
    if (!headerMatch) continue;

    let questionText = headerMatch[2].replace(/\n/g, ' ').replace(/\s{2,}/g, ' ').trim();
    if (!questionText || questionText.length < 3) continue;

    // Extract options between checkbox symbols
    const optionChunks = block.split(new RegExp(`[${CHECKBOX_CHARS}]`)).slice(1);
    let options = optionChunks
      .map(chunk => chunk.replace(/\n/g, ' ').replace(/\s{2,}/g, ' ').trim())
      .filter(opt => opt.length > 0);

    // If options not found via splitting, try line-by-line for 2-column layouts
    if (options.length < 2) {
      options = extract2ColumnOptions(block, questionText);
    }

    // Clean trailing Q-numbers from last option
    options = options.map(opt => opt.replace(/\s*Q\d+\s*[.):\-].*$/i, '').trim()).filter(o => o.length > 0);

    if (options.length >= 4) {
      const correctAnswer = detectCorrectAnswer(block, options);
      questions.push({
        question: questionText,
        options: options.slice(0, 4),
        correctAnswer: correctAnswer || options[0],
        difficulty: 'medium',
        category: 'General',
        needsReview: !correctAnswer,
      });
    }
  }

  return questions;
}

// ═══════════════════════════════════════════════════════════════════
//  STRATEGY 2: Letter format  (A/B/C/D options)
// ═══════════════════════════════════════════════════════════════════
function extractLetterFormat(text) {
  const questions = [];
  const blocks = splitIntoBlocks(text);

  for (const block of blocks) {
    // Remove question number prefix
    let cleanBlock = block.replace(NUM_HEADER, '').trim();

    // Try each option pattern to find the one that works
    let bestOptions = [];
    let bestPattern = null;

    for (const pattern of OPTION_PATTERNS) {
      const opts = [];
      let m;
      pattern.lastIndex = 0;
      while ((m = pattern.exec(cleanBlock)) !== null) {
        opts.push({
          index: m.index,
          letter: m[1].toUpperCase(),
          text: m[2].replace(/\n/g, ' ').trim(),
        });
      }
      if (opts.length >= 4 && opts.length > bestOptions.length) {
        bestOptions = opts;
        bestPattern = pattern;
      }
    }

    // Also try simple line-by-line matching
    if (bestOptions.length < 4) {
      const lineOpts = extractOptionsFromLines(cleanBlock);
      if (lineOpts.length >= 4) {
        bestOptions = lineOpts;
      }
    }

    if (bestOptions.length >= 4) {
      const questionText = cleanBlock.substring(0, bestOptions[0].index).replace(/\n/g, ' ').replace(/\s{2,}/g, ' ').trim();
      
      const options = bestOptions.slice(0, 4).map(o => {
        let t = o.text;
        // Remove answer markers
        t = t.replace(/[*✓✔]/g, '').replace(/\(correct\)/gi, '').replace(/\[correct\]/gi, '').trim();
        return t;
      });

      // Detect correct answer
      let correctAnswer = null;

      // Check for marked options (*, ✓, etc.)
      for (const opt of bestOptions.slice(0, 4)) {
        if (/[*✓✔]/.test(opt.text) || /\(correct\)/i.test(opt.text)) {
          correctAnswer = opt.text.replace(/[*✓✔]/g, '').replace(/\(correct\)/gi, '').trim();
          break;
        }
      }

      // Check for answer key
      if (!correctAnswer) {
        correctAnswer = detectCorrectAnswer(cleanBlock, options);
      }

      if (questionText.length > 3) {
        questions.push({
          question: questionText,
          options,
          correctAnswer: correctAnswer || options[0],
          difficulty: 'medium',
          category: 'General',
          needsReview: !correctAnswer,
        });
      }
    }
  }

  return questions;
}

// ═══════════════════════════════════════════════════════════════════
//  STRATEGY 3: Fallback — generic line-based extraction
// ═══════════════════════════════════════════════════════════════════
function extractFallbackFormat(text) {
  const questions = [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const qMatch = line.match(/^(?:Q(?:uestion)?\s*\.?\s*)?(\d+)\s*[.):\-]\s*(.+)/i);

    if (qMatch) {
      const questionText = qMatch[2].trim();
      const options = [];
      let j = i + 1;

      // Collect next lines as potential options
      while (j < lines.length && options.length < 4) {
        const optLine = lines[j];
        // Stop if we hit another question
        if (/^(?:Q(?:uestion)?\s*\.?\s*)?\d+\s*[.):\-]/i.test(optLine)) break;

        // Try to extract option text
        const optMatch = optLine.match(/^\s*(?:\(?[A-Da-d1-4]\)?\s*[.):\-]?\s*)?(.+)/);
        if (optMatch) {
          let optText = optMatch[1].trim();
          // Remove checkbox chars
          optText = optText.replace(CHECKBOX_REGEX, '').trim();
          // Split on 3+ spaces (2-column)
          const parts = optText.split(/\s{3,}/).map(p => p.replace(CHECKBOX_REGEX, '').trim()).filter(p => p.length > 1);
          options.push(...parts);
        }
        j++;
      }

      if (options.length >= 4 && questionText.length > 3) {
        questions.push({
          question: questionText,
          options: options.slice(0, 4),
          correctAnswer: options[0],
          difficulty: 'medium',
          category: 'General',
          needsReview: true,
        });
      }
      i = j;
    } else {
      i++;
    }
  }

  return questions;
}

// ═══════════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Split text into question blocks at numbered boundaries
 */
function splitIntoBlocks(text) {
  const positions = [];
  let match;
  QUESTION_SPLIT.lastIndex = 0;

  while ((match = QUESTION_SPLIT.exec(text)) !== null) {
    positions.push(match.index);
  }

  const blocks = [];
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i];
    const end = i + 1 < positions.length ? positions[i + 1] : text.length;
    blocks.push(text.substring(start, end).trim());
  }

  return blocks;
}

/**
 * Extract options from individual lines (for inline formats)
 */
function extractOptionsFromLines(block) {
  const options = [];
  const lines = block.split('\n');

  for (const line of lines) {
    const m = line.match(/^\s*\(?([A-Da-d])\)?\s*[.):\-]?\s*(.+)/);
    if (m) {
      options.push({
        index: block.indexOf(line),
        letter: m[1].toUpperCase(),
        text: m[2].trim(),
      });
    }
  }

  return options;
}

/**
 * Extract options from 2-column PDF layout (lines with wide whitespace gaps)
 */
function extract2ColumnOptions(block, questionText) {
  const options = [];
  const lines = block.split('\n').map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    // Skip question text line
    if (line.includes(questionText.substring(0, 20))) continue;
    // Skip headers/metadata
    if (/^(Q\d+|Full Name|USN|Pragyan|Page|Date)/i.test(line)) continue;

    // Split on 3+ whitespace chars (column boundary in PDFs)
    const parts = line.split(/\s{3,}/).map(p => p.replace(CHECKBOX_REGEX, '').trim()).filter(p => p.length > 1);
    options.push(...parts);
  }

  return options;
}

/**
 * Detect correct answer from answer key patterns in text
 */
function detectCorrectAnswer(text, options) {
  for (const pattern of ANSWER_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const letter = match[1].trim();
      // If it's a single letter A-D, map to option index
      if (/^[A-Da-d]$/.test(letter)) {
        const idx = letter.toUpperCase().charCodeAt(0) - 65;
        if (idx >= 0 && idx < options.length) {
          return options[idx];
        }
      }
      // If it's the full answer text, find matching option
      const found = options.find(o => o.toLowerCase() === letter.toLowerCase());
      if (found) return found;
    }
  }
  return null;
}

module.exports = { parsePDF, extractQuestions, filterAndEnrich };

