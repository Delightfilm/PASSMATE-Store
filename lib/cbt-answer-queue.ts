export type AnswerState = { choice: number | null; review: boolean; locked: boolean };
type Field = "answer" | "review";

// Only the same question waits. Stale acknowledgements never replace newer input.
export function createAnswerQueue(
  read: (id: string) => AnswerState,
  write: (id: string, field: Field, state: AnswerState) => void,
  send: (id: string, choice: number | null, review: boolean | null) => Promise<AnswerState>,
  onError: (error: unknown) => void,
  onPending: (id: string, pending: boolean) => void = () => {},
) {
  const questions = new Map<string, { tail: Promise<void>; confirmed: AnswerState; versions: Record<Field, number>; errors: Partial<Record<Field, unknown>>; pending: number }>();
  function enqueue(id: string, choice: number | null, review: boolean | null, lock = false) {
    let entry = questions.get(id);
    if (!entry) { entry = { tail: Promise.resolve(), confirmed: read(id), versions: { answer: 0, review: 0 }, errors: {}, pending: 0 }; questions.set(id, entry); }
    entry.pending++; onPending(id,true);
    const field: Field = review === null ? "answer" : "review";
    const version = ++entry.versions[field];
    const optimistic = read(id);
    if (field === "answer") { optimistic.choice = choice; optimistic.locked = lock; } else optimistic.review = review!;
    write(id, field, optimistic);
    delete entry.errors[field];
    const current = entry;
    current.tail = current.tail.then(async () => {
      try {
        current.confirmed = await send(id, choice, review);
        if (current.versions[field] === version) { write(id, field, current.confirmed); delete current.errors[field]; }
      } catch (error) {
        if (current.versions[field] === version) { write(id, field, current.confirmed); current.errors[field] = error; }
        onError(error);
      } finally {
        if (--current.pending === 0) onPending(id,false);
      }
    });
  }
  async function flush() {
    await Promise.all(Array.from(questions.values(), entry => entry.tail));
    for (const entry of questions.values()) for (const error of Object.values(entry.errors)) if (error) throw error;
  }
  return { enqueue, flush };
}
