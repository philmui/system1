/** Presentation copy only. Leave model/version tokens and qualified IDs intact. */
export const displayName = (value: string) => value.replace(/\bLangGraph\b/gi, 'AgentGraph').replace(/(?<![\w:/.-])Jev(?![\w:/-]|\.[\w])/gi, 'System 1 Model');
