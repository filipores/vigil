<script lang="ts">
  import type { RuleDefinition, RuleViolation } from '@agent-monitor/types';

  let {
    rules,
    violations,
    onUpdateRules,
    onTriggerCheck,
  }: {
    rules: RuleDefinition[];
    violations: RuleViolation[];
    onUpdateRules: (rules: RuleDefinition[]) => void;
    onTriggerCheck: () => void;
  } = $props();

  let newRuleText = $state('');
  let newRuleSeverity = $state<'info' | 'warning' | 'critical'>('warning');
  let isChecking = $state(false);

  const SEVERITY_DOT: Record<string, string> = {
    info: 'bg-text-secondary',
    warning: 'bg-warm',
    critical: 'bg-red-400',
  };

  const SEVERITY_TEXT: Record<string, string> = {
    info: 'text-text-secondary',
    warning: 'text-warm',
    critical: 'text-red-400',
  };

  function toggleRule(id: string) {
    const updated = rules.map((r) =>
      r.id === id ? { ...r, enabled: !r.enabled } : r,
    );
    onUpdateRules(updated);
  }

  function addRule() {
    const text = newRuleText.trim();
    if (!text) return;
    const id = crypto.randomUUID().slice(0, 12);
    const updated = [
      ...rules,
      { id, rule: text, severity: newRuleSeverity, enabled: true } as RuleDefinition,
    ];
    onUpdateRules(updated);
    newRuleText = '';
  }

  async function handleCheck() {
    isChecking = true;
    try {
      onTriggerCheck();
    } finally {
      setTimeout(() => { isChecking = false; }, 1000);
    }
  }
</script>

<div class="space-y-3">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div class="text-[10px] font-medium uppercase tracking-[0.1em] text-text-dim">
      Boundary Rules
    </div>
    <div class="flex items-center gap-2">
      {#if violations.length > 0}
        <span class="text-[10px] font-medium text-red-400">
          {violations.length} violation{violations.length !== 1 ? 's' : ''}
        </span>
      {/if}
      <button
        onclick={handleCheck}
        disabled={isChecking}
        class="px-2 py-1 text-[10px] font-medium rounded border transition-colors duration-150 {isChecking
          ? 'text-signal/70 bg-signal/10 border-signal/20 cursor-not-allowed'
          : 'text-text-secondary border-border-subtle hover:text-text hover:bg-surface-raised/50'}"
      >
        {isChecking ? 'Checking...' : 'Check Now'}
      </button>
    </div>
  </div>

  <!-- Rules list -->
  {#if rules.length === 0}
    <p class="text-[11px] text-text-dim italic">No rules defined.</p>
  {:else}
    <div class="space-y-1">
      {#each rules as rule (rule.id)}
        <div class="flex items-center gap-2 px-2 py-1.5 rounded border border-border-subtle bg-surface-raised/30">
          <button
            onclick={() => toggleRule(rule.id)}
            class="shrink-0 w-5 h-3 rounded-full relative transition-colors duration-150 {rule.enabled ? 'bg-signal/30' : 'bg-surface-bright'}"
            title={rule.enabled ? 'Enabled' : 'Disabled'}
          >
            <span
              class="absolute top-0.5 w-2 h-2 rounded-full transition-all duration-150 {rule.enabled ? 'left-2.5 bg-signal' : 'left-0.5 bg-text-dim'}"
            ></span>
          </button>
          <span class="w-1.5 h-1.5 rounded-full shrink-0 {SEVERITY_DOT[rule.severity]}"></span>
          <span class="text-[11px] truncate {rule.enabled ? SEVERITY_TEXT[rule.severity] : 'text-text-dim line-through'}">
            {rule.rule}
          </span>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Add rule form -->
  <div class="flex items-center gap-1.5">
    <input
      type="text"
      bind:value={newRuleText}
      placeholder="Add a rule..."
      class="flex-1 bg-surface text-text text-[11px] border border-border-subtle rounded px-2 py-1 outline-none focus:border-signal/40 transition-colors placeholder:text-text-dim"
      onkeydown={(e) => { if (e.key === 'Enter') addRule(); }}
    />
    <select
      bind:value={newRuleSeverity}
      class="bg-surface text-text-secondary text-[10px] border border-border-subtle rounded px-1.5 py-1 outline-none focus:border-signal/40 transition-colors"
    >
      <option value="info">Info</option>
      <option value="warning">Warning</option>
      <option value="critical">Critical</option>
    </select>
    <button
      onclick={addRule}
      disabled={!newRuleText.trim()}
      class="px-2 py-1 text-[10px] font-medium text-void bg-signal rounded hover:brightness-110 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      Add
    </button>
  </div>
</div>
