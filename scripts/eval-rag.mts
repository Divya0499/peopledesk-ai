// Measures how well the document Q&A answers: run with `npm run eval:rag`.
//
// Indexes the documents in tests/eval/docs into a throwaway Pinecone
// namespace with the app's own pipeline (chunking, embedding), asks every
// question in tests/eval/dataset.json through askRag() (retrieval,
// reranking, answer), scores the answers, then deletes the namespace. The
// real documents in the default namespace are never touched.
//
// Needs the same keys as the app (GEMINI_API_KEY, PINECONE_API_KEY,
// PINECONE_INDEX) and DATABASE_URL, since lib/ingest.ts loads Prisma.

import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const namespace = `eval-${Date.now()}`;
// Set before any lib code calls getIndex()
process.env.PINECONE_NAMESPACE = namespace;

const { indexDocument } = await import("../lib/ingest");
const { askRag } = await import("../lib/langchain-rag");
const { getIndex } = await import("../lib/pinecone");
const { withRetry } = await import("../lib/retry");

type Question = {
  question: string;
  mustInclude?: string[][];
  mustNotInclude?: string[];
  source?: string;
  answerable?: boolean;
};

type Result = {
  question: string;
  answerable: boolean;
  answer: string;
  sources: string[];
  answerCorrect: boolean;
  citedRightSource: boolean | null;
  passed: boolean;
  latencyMs: number;
};

const ROOT = path.resolve(import.meta.dirname, "..");
const DOCS_DIR = path.join(ROOT, "tests/eval/docs");
const DATASET = path.join(ROOT, "tests/eval/dataset.json");
const OUTPUT = path.join(ROOT, "tests/eval/last-run.json");

const NOT_FOUND = /couldn.t find|not (available|mentioned|specified|included)|no information|doesn.t (say|mention|specify)/i;

// Pinecone serverless makes new vectors searchable after a short delay
async function waitForVectors(expected: number) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const stats = await getIndex().describeIndexStats();
    const count = stats.namespaces?.[namespace]?.recordCount ?? 0;

    if (count >= expected) return;

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error("Vectors didn't become searchable within a minute");
}

function score(q: Question, answer: string, sources: string[]) {
  const text = answer.toLowerCase();
  const answerable = q.answerable !== false;

  if (!answerable) {
    const refused = NOT_FOUND.test(answer);

    return { answerCorrect: refused, citedRightSource: null, passed: refused };
  }

  const hasAll = (q.mustInclude ?? []).every((group) =>
    group.some((option) => text.includes(option.toLowerCase())),
  );
  const hasNone = (q.mustNotInclude ?? []).every(
    (bad) => !text.includes(bad.toLowerCase()),
  );
  const answerCorrect = hasAll && hasNone && !NOT_FOUND.test(answer);
  const citedRightSource = q.source ? sources.includes(q.source) : null;

  return {
    answerCorrect,
    citedRightSource,
    passed: answerCorrect && citedRightSource !== false,
  };
}

const percent = (part: number, whole: number) =>
  whole === 0 ? "n/a" : `${((part / whole) * 100).toFixed(1)}%`;

async function main() {
  const { questions } = JSON.parse(await readFile(DATASET, "utf8")) as {
    questions: Question[];
  };

  console.log(`Indexing documents into namespace ${namespace}…`);
  let chunks = 0;

  for (const file of (await readdir(DOCS_DIR)).sort()) {
    const text = await readFile(path.join(DOCS_DIR, file), "utf8");
    chunks += await indexDocument(`eval-${file}`, file, text);
  }

  await waitForVectors(chunks);
  console.log(`${chunks} chunks indexed. Asking ${questions.length} questions…\n`);

  const results: Result[] = [];

  for (const q of questions) {
    const started = Date.now();
    // Retries a rate-limited call instead of scoring it as a wrong answer
    const { text, sources } = await withRetry(() => askRag(q.question), 4);
    const latencyMs = Date.now() - started;
    const cited = [...new Set(sources.map((source) => source.source))];
    const scored = score(q, text, cited);

    results.push({
      question: q.question,
      answerable: q.answerable !== false,
      answer: text.trim(),
      sources: cited,
      ...scored,
      latencyMs,
    });

    console.log(
      `${scored.passed ? "PASS" : "FAIL"}  ${q.question}\n      → ${text.trim().replace(/\s+/g, " ").slice(0, 140)}`,
    );
  }

  const answerable = results.filter((r) => r.answerable);
  const unanswerable = results.filter((r) => !r.answerable);
  const withSource = answerable.filter((r) => r.citedRightSource !== null);
  const latencies = results.map((r) => r.latencyMs).sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length / 2)];
  const p95 = latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95))];

  const summary = {
    runAt: new Date().toISOString(),
    questions: results.length,
    overall: percent(results.filter((r) => r.passed).length, results.length),
    answerAccuracy: percent(
      answerable.filter((r) => r.answerCorrect).length,
      answerable.length,
    ),
    citationAccuracy: percent(
      withSource.filter((r) => r.citedRightSource).length,
      withSource.length,
    ),
    refusalAccuracy: percent(
      unanswerable.filter((r) => r.answerCorrect).length,
      unanswerable.length,
    ),
    latencyMs: { p50, p95 },
  };

  console.log("\nSummary");
  console.table(summary);

  await writeFile(OUTPUT, JSON.stringify({ summary, results }, null, 2));
  console.log(`Full results: ${path.relative(ROOT, OUTPUT)}`);
}

try {
  await main();
} finally {
  // Removes only this run's namespace
  await getIndex()
    .deleteAll()
    .catch((error) => console.error("Couldn't delete the eval namespace:", error));
}
