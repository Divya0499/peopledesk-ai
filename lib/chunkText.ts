export type Chunk = {
  text: string;
  section?: string;
};

type Section = {
  heading?: string;
  title?: string;
  body: string;
};

// e.g. "3. Leave Policy". no period at the end so normal sentences starting
// with a number don't match
const HEADING = /^(\d+)\.\s+([A-Z][^.]{0,60})$/;

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

// don't split after "1." etc
function splitSentences(text: string) {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[^\d\s][.!?])\s+/)
    .filter(Boolean);
}

function groupSentences(sentences: string[], chunkSize: number) {
  const chunks: string[] = [];

  let current: string[] = [];
  let length = 0;

  for (const sentence of sentences) {
    if (length + sentence.length > chunkSize && current.length > 0) {
      chunks.push(current.join(" "));

      // last sentence carries over as overlap
      const last = current[current.length - 1];
      current = [last];
      length = last.length;
    }

    current.push(sentence);
    length += sentence.length + 1;
  }

  if (current.length > 1 || chunks.length === 0) {
    chunks.push(current.join(" "));
  }

  return chunks;
}

// chunk per section, and put the heading at the top of every chunk
export function chunkText(text: string, chunkSize = 500): Chunk[] {
  return splitSections(text).flatMap((section) =>
    groupSentences(splitSentences(section.body), chunkSize).map((body) => ({
      text: section.heading ? `${section.heading}\n${body}` : body,
      section: section.title,
    })),
  );
}
