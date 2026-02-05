/**
 * MVP task classifier: heuristic from last user message.
 * Post-MVP: call a cheap model to classify.
 */
export type TaskType =
  | 'chat'
  | 'coding'
  | 'reasoning'
  | 'summarization'
  | 'translation'
  | 'image'
  | 'agent_step';

export function classifyTask(
  messages: Array<{ role: string; content: string }>
): TaskType {
  const last = messages?.length ? messages[messages.length - 1]?.content?.toLowerCase() ?? '' : '';
  if (/\b(code|function|def |class |import |const |let |var |async |await |\.py\b|\.ts\b|\.js\b)/i.test(last))
    return 'coding';
  if (/\b(why|explain|reason|proof|solve|derive|analyze|logic)\b/i.test(last)) return 'reasoning';
  if (/\b(summarize|summary|tl;dr|brief|outline)\b/i.test(last)) return 'summarization';
  if (/\b(translate|traduction|übersetzen|翻译)\b/i.test(last)) return 'translation';
  if (/\b(image|picture|generate|draw|dall|img)\b/i.test(last)) return 'image';
  return 'chat';
}
