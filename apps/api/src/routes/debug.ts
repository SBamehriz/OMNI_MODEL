type Body = {
  messages?: Array<{ role: string; content: string }>;
  priority?: string;
  latency_pref?: string;
  max_cost?: number;
};
type Req = { body?: Body };
type Rep = { send: (b: unknown) => Rep };

export async function debugRoutes(app: { post: (path: string, h: (req: Req, reply: Rep) => Rep | Promise<Rep>) => void }) {
  app.post('/debug', async (req: Req, reply: Rep) => {
    const { messages, priority = 'balanced', latency_pref = 'normal' } = req.body ?? {};
    const lastContent = messages?.length ? (messages[messages.length - 1]?.content ?? '').toLowerCase() : '';

    let task_type = 'chat';
    if (/\b(code|function|def |class |import |const |let |var )/i.test(lastContent)) task_type = 'coding';
    else if (/\b(why|explain|reason|proof|solve|derive)\b/i.test(lastContent)) task_type = 'reasoning';
    else if (/\b(summarize|summary|tl;dr|brief)\b/i.test(lastContent)) task_type = 'summarization';
    else if (/\b(translate|traduction|übersetzen)\b/i.test(lastContent)) task_type = 'translation';

    const selected_model = priority === 'cheap' ? 'gpt-4o-mini' : 'gpt-4o-mini';
    const reason = `task=${task_type}, priority=${priority}, latency_pref=${latency_pref}; MVP uses single model ${selected_model}`;

    return reply.send({
      task_type,
      considered_models: [{ model: 'gpt-4o-mini', score: 1, reason: 'default MVP model' }],
      selected_model,
      reason,
    });
  });
}
