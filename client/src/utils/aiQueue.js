export const AI_QUEUE_TASK_LABELS = {
  chat: 'a chat reply',
  topic_guard: 'message validation',
  profile_extract: 'profile update',
  recommendations_university: 'university recommendations',
  recommendations_scholarship: 'scholarship recommendations',
  roadmap: 'your roadmap',
  memory_summary: 'conversation memory',
  generate: 'an AI task',
};

export function getAiQueueTaskLabel(task) {
  if (!task) return 'an AI task';
  if (AI_QUEUE_TASK_LABELS[task]) return AI_QUEUE_TASK_LABELS[task];
  if (task.startsWith('recommendations')) return 'recommendations';
  return task.replace(/_/g, ' ');
}

export function getAiQueueBannerMessage(task) {
  const label = getAiQueueTaskLabel(task);
  return `Peri is working on ${label}. Please wait before starting another task.`;
}

const CHAT_PIPELINE_TASKS = new Set(['chat', 'topic_guard', 'profile_extract']);

export function isChatPipelineTask(task) {
  return CHAT_PIPELINE_TASKS.has(task);
}

export function isChatPipelineBusy(aiQueue) {
  return Boolean(aiQueue?.busy && isChatPipelineTask(aiQueue?.current_task));
}
