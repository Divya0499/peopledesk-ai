export type Chunk = {
  text: string;
  // The heading this chunk belongs to, e.g. "Leave Policy";
  // undefined for text before the first heading
  section?: string;
};

type Section = {
  heading?: string;
  title?: string;
  body: string;
};

// A numbered heading on its own line, like "3. Leave Policy".
// Short and without a closing period, so wrapped sentence lines
// that happen to start with a number aren't mistaken for headings.
const HEADING = /^(\d+)\.\s+([A-Z][^.]{0,60})$/;

// Split the raw text (newlines intact) at each heading line
function splitSections(text: string) {
  const sections: Section[] = [{ body: "" }];

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    const match = trimmed.match(HEADING);

    if (match) {
      sections.push({ heading: trimmed, title: match[2].trim(), body: "" });
    } else {
      sections[sections.length - 1].body += line + "\n";
    }
  }

  return sections.filter((section) => section.body.trim());
}

// Split text into sentences.
// Don't split after a number like "1." so numbered items stay
// attached to the sentence that follows.
function splitSentences(text: string) {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[^\d\s][.!?])\s+/)
    .filter(Boolean);
}

// Group whole sentences into chunks of about chunkSize characters.
// Each chunk starts with the last sentence of the previous chunk
// (the overlap), so an idea split across two chunks isn't lost.
function groupSentences(sentences: string[], chunkSize: number) {
  const chunks: string[] = [];

  let current: string[] = [];
  let length = 0;

  for (const sentence of sentences) {
    if (length + sentence.length > chunkSize && current.length > 0) {
      chunks.push(current.join(" "));

      // Keep the last sentence as overlap
      const last = current[current.length - 1];
      current = [last];
      length = last.length;
    }

    current.push(sentence);
    length += sentence.length + 1;
  }

  // Add what's left, unless it's only the overlap sentence
  if (current.length > 1 || chunks.length === 0) {
    chunks.push(current.join(" "));
  }

  return chunks;
}

// Chunk each section separately so no chunk mixes two topics.
// Every chunk starts with its section heading, so a chunk from the
// middle of a long section still says what it's about.
export function chunkText(text: string, chunkSize = 500): Chunk[] {
  return splitSections(text).flatMap((section) =>
    groupSentences(splitSentences(section.body), chunkSize).map((body) => ({
      text: section.heading ? `${section.heading}\n${body}` : body,
      section: section.title,
    })),
  );
}
