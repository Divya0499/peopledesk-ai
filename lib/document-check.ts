import { z } from "zod";
import { model } from "./langchain-model";
import { withRetry } from "./retry";
import {
  formatUntrustedDocuments,
  UNTRUSTED_DOCUMENT_RULES,
} from "./untrusted-content";

// Uploaded documents answer every employee's questions, so only company-wide
// HR and workplace documents belong here. A quotation or invoice would give
// wrong answers, and a payslip, CV or offer letter would show one person's
// private data to everyone.

// The start of the document is enough to tell what kind it is, and keeps the
// check fast and cheap on a long PDF
const SAMPLE_CHARS = 6000;

const checkSchema = z.object({
  allowed: z
    .boolean()
    .describe("true only if this is a company-wide HR or workplace document"),
  documentType: z
    .string()
    .describe(
      "What the document is, in a few words, e.g. leave policy, quotation, invoice, resume",
    ),
  reason: z
    .string()
    .describe("One short sentence for the uploader explaining the decision"),
});

export type DocumentCheck = z.infer<typeof checkSchema>;

const checker = model.withStructuredOutput(checkSchema);

const CHECK_PROMPT = `
You check documents before they are added to a company's HR knowledge base.
Every employee can ask questions that are answered from these documents.

Allowed (company-wide documents for employees):
- employee handbooks, HR policies, leave, attendance and holiday policies
- benefits, payroll and compensation policies (rules, not one person's pay)
- travel, expense, IT, security, and code of conduct policies
- onboarding guides, internal procedures, workplace FAQs

Not allowed:
- quotations, invoices, bills, receipts, purchase orders, price lists
- vendor or client contracts, proposals, sales or marketing material
- documents about one person: resumes/CVs, payslips, offer letters,
  appraisals, ID documents, bank statements, medical records
- anything unrelated to the workplace: books, articles, study notes,
  research papers

Judge only from what the document is. If it is unclear or mixed, set
allowed to false.

${UNTRUSTED_DOCUMENT_RULES}
`.trim();

// Asks the model whether the PDF's text belongs in the HR knowledge base.
// Throws if the model can't be reached; the caller must then reject the
// upload rather than let an unchecked file through.
export async function checkDocument(
  fileName: string,
  text: string,
): Promise<DocumentCheck> {
  const document = formatUntrustedDocuments([
    { label: fileName, text: text.slice(0, SAMPLE_CHARS) },
  ]);

  return withRetry(() =>
    checker.invoke([
      { role: "system", content: CHECK_PROMPT },
      { role: "user", content: `Check this document:\n\n${document}` },
    ]),
  );
}
