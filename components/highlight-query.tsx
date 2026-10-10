/** Highlight literal text only; search/filter/navigation behavior is unchanged. */
export function HighlightQuery({ text, query }: { text: string; query: string }) {
  const word = query.trim().replace(/\s/g, "").toLocaleLowerCase("ko-KR");
  if (!word) return <>{text}</>;
  const positions = Array.from(text).flatMap((char, index) => /\s/.test(char) ? [] : [index]);
  const characters = Array.from(text);
  const compact = characters.filter(char => !/\s/.test(char)).join("").toLocaleLowerCase("ko-KR");
  const start = compact.indexOf(word);
  if (start < 0) return <>{text}</>;
  const from = positions[start], to = positions[start + Array.from(word).length - 1] + 1;
  return <>{characters.slice(0, from).join("")}<mark className="qualification-match">{characters.slice(from, to).join("")}</mark>{characters.slice(to).join("")}</>;
}
