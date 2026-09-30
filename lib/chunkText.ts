// Split text into sentences.
// Don't split after a number like "1." so headings such as
// "3. Leave Policy" stay attached to the sentence that follows.
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
export function chunkText(text: string, chunkSize = 500) {
  const sentences = splitSentences(text);

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
