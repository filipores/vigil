import type { TimelineEvent, WsMessage } from '@agent-monitor/types';

let events = $state<TimelineEvent[]>([]);
const MAX_EVENTS = 500;

function addEvent(event: TimelineEvent) {
  events = [event, ...events].slice(0, MAX_EVENTS);
}

export function handleTimelineMessage(msg: WsMessage) {
  switch (msg.type) {
    case 'function-discovered':
      addEvent({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        type: 'function-added',
        summary: `New function: ${msg.payload.name}`,
        functionId: msg.payload.id,
        filePath: msg.payload.filePath,
      });
      break;
    case 'function-updated':
      addEvent({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        type: 'function-updated',
        summary: `Updated: ${msg.payload.name}`,
        functionId: msg.payload.id,
        filePath: msg.payload.filePath,
      });
      break;
    case 'function-removed':
      addEvent({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        type: 'function-removed',
        summary: `Removed function`,
        functionId: msg.payload.id,
      });
      break;
    case 'analysis-completed':
      for (const result of msg.payload.results) {
        const maxSeverity = result.concerns.length > 0
          ? result.concerns.reduce<'info' | 'warning' | 'critical'>((max, c) => {
              if (c.severity === 'critical') return 'critical';
              if (c.severity === 'warning' && max !== 'critical') return 'warning';
              return max;
            }, 'info')
          : undefined;
        addEvent({
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          type: 'analysis-completed',
          summary: `Analysis: ${result.summary.slice(0, 80)}`,
          functionId: result.functionId,
          analysisId: result.id,
          severity: maxSeverity,
        });
      }
      break;
    case 'rule-violation':
      for (const v of msg.payload.violations) {
        addEvent({
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          type: 'rule-violation',
          summary: `Violation: ${v.rule}`,
          functionId: v.functionId,
          filePath: v.filePath,
          severity: v.severity,
        });
      }
      break;
  }
}

export type TimelineFilter = 'all' | 'changes' | 'analysis' | 'violations';

function filterEvents(items: TimelineEvent[], filter: TimelineFilter): TimelineEvent[] {
  if (filter === 'all') return items;
  if (filter === 'changes') return items.filter((e) => e.type === 'function-added' || e.type === 'function-updated' || e.type === 'function-removed');
  if (filter === 'analysis') return items.filter((e) => e.type === 'analysis-completed');
  if (filter === 'violations') return items.filter((e) => e.type === 'rule-violation');
  return items;
}

export function getTimelineStore() {
  return {
    get events() { return events; },
    handleTimelineMessage,
    filterEvents,
    get criticalCount() {
      return events.filter((e) => e.severity === 'critical').length;
    },
    get warningCount() {
      return events.filter((e) => e.severity === 'warning').length;
    },
  };
}
