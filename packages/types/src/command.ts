export interface AgentContext {
  snippet: string;
  file: string;
  lineStart: number;
  lineEnd: number;
}

export interface AgentCommand {
  prompt: string;
  context: AgentContext;
}
