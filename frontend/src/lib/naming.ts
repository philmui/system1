/** Presentation names only; persisted provider keys and graph IDs stay intact. */
export const displayName = (value: string) => value.replace(/\bLangGraph\b/gi, 'AgentGraph').replace(/\bJev\b/gi, 'System 1 Model');
