#!/usr/bin/env python3
"""Analyse spawn.jsonl + spawn.json logs from agentic-workflow runs."""

import json, os, sys, glob, re
from collections import defaultdict
from datetime import datetime, timezone

BASE = "D:/sources/_unowned/agentic-workflow/context/workspaces/socorro-24h/run-1-standard-vibe-full-app/wave-1"

# ── Collect all spawn.json metadata ─────────────────────────────────────
meta_files = sorted(glob.glob(os.path.join(BASE, "**/spawn.json"), recursive=True))
jsonl_files = sorted(glob.glob(os.path.join(BASE, "**/spawn.jsonl"), recursive=True))

print(f"Found {len(meta_files)} spawn.json, {len(jsonl_files)} spawn.jsonl files\n")

# ── Parse spawn.json metadata ───────────────────────────────────────────
steps = []
for f in meta_files:
    with open(f, "r", encoding="utf-8") as fh:
        try:
            meta = json.load(fh)
        except:
            continue
    meta["_path"] = f
    # derive step label from path
    rel = os.path.relpath(f, BASE).replace("\\", "/")
    meta["_rel"] = rel
    steps.append(meta)

# ── Parse spawn.jsonl logs ──────────────────────────────────────────────
def parse_jsonl(path):
    """Extract metrics from a spawn.jsonl file."""
    events = []
    with open(path, "r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                events.append(json.loads(line))
            except:
                pass

    metrics = {
        "path": path,
        "total_events": len(events),
        "assistant_turns": 0,
        "user_turns": 0,
        "system_events": 0,
        "tool_calls": [],
        "total_input_tokens": 0,
        "total_output_tokens": 0,
        "total_cache_creation_tokens": 0,
        "total_cache_read_tokens": 0,
        "models_used": set(),
        "subagent_count": 0,
        "subagent_tasks": [],
        "thinking_blocks": 0,
        "text_blocks": 0,
        "errors": [],
        "tool_results_failed": 0,
        "websearch_count": 0,
        "webfetch_count": 0,
        "read_count": 0,
        "write_count": 0,
        "edit_count": 0,
        "bash_count": 0,
        "glob_count": 0,
        "grep_count": 0,
        "agent_count": 0,
        "context_compressions": 0,
    }

    for ev in events:
        t = ev.get("type")
        if t == "assistant":
            metrics["assistant_turns"] += 1
            msg = ev.get("message", {})
            model = msg.get("model", "")
            if model:
                metrics["models_used"].add(model)
            usage = msg.get("usage", {})
            metrics["total_input_tokens"] += usage.get("input_tokens", 0)
            metrics["total_output_tokens"] += usage.get("output_tokens", 0)
            metrics["total_cache_creation_tokens"] += usage.get("cache_creation_input_tokens", 0)
            metrics["total_cache_read_tokens"] += usage.get("cache_read_input_tokens", 0)

            # Count content types
            for content in msg.get("content", []):
                ct = content.get("type")
                if ct == "thinking":
                    metrics["thinking_blocks"] += 1
                elif ct == "text":
                    metrics["text_blocks"] += 1
                elif ct == "tool_use":
                    tool_name = content.get("name", "unknown")
                    metrics["tool_calls"].append(tool_name)
                    # Count specific tools
                    lname = tool_name.lower()
                    if lname == "websearch":
                        metrics["websearch_count"] += 1
                    elif lname == "webfetch":
                        metrics["webfetch_count"] += 1
                    elif lname == "read":
                        metrics["read_count"] += 1
                    elif lname == "write":
                        metrics["write_count"] += 1
                    elif lname == "edit":
                        metrics["edit_count"] += 1
                    elif lname == "bash":
                        metrics["bash_count"] += 1
                    elif lname == "glob":
                        metrics["glob_count"] += 1
                    elif lname == "grep":
                        metrics["grep_count"] += 1
                    elif lname in ("agent", "task"):
                        metrics["agent_count"] += 1

            # Check for context compression
            cm = msg.get("context_management")
            if cm and isinstance(cm, dict) and cm.get("compressed"):
                metrics["context_compressions"] += 1

        elif t == "user":
            metrics["user_turns"] += 1
            # Check for tool result errors
            msg = ev.get("message", {})
            for content in msg.get("content", []) if isinstance(msg.get("content"), list) else []:
                if isinstance(content, dict) and content.get("is_error"):
                    metrics["tool_results_failed"] += 1
                    metrics["errors"].append(str(content.get("content", ""))[:200])

        elif t == "system":
            metrics["system_events"] += 1
            sub = ev.get("subtype", "")
            if sub == "task_started":
                metrics["subagent_count"] += 1
                metrics["subagent_tasks"].append(ev.get("description", "")[:100])

    metrics["models_used"] = list(metrics["models_used"])
    return metrics


all_metrics = []
for f in jsonl_files:
    m = parse_jsonl(f)
    rel = os.path.relpath(f, BASE).replace("\\", "/")
    m["_rel"] = rel
    all_metrics.append(m)

# ── Combine with spawn.json ─────────────────────────────────────────────
# Build lookup from jsonl path to meta
meta_by_dir = {}
for s in steps:
    d = os.path.dirname(s["_path"])
    meta_by_dir[d] = s

for m in all_metrics:
    d = os.path.dirname(m["path"])
    meta = meta_by_dir.get(d, {})
    m["task"] = meta.get("task", "?")
    m["agent"] = meta.get("agent", "?")
    m["exit_code"] = meta.get("exit_code", None)
    m["timed_out"] = meta.get("timed_out", False)
    m["model_used"] = meta.get("model_used", "?")
    started = meta.get("started_at")
    finished = meta.get("finished_at")
    if started and finished:
        try:
            s = datetime.fromisoformat(started.replace("Z", "+00:00"))
            e = datetime.fromisoformat(finished.replace("Z", "+00:00"))
            m["duration_sec"] = (e - s).total_seconds()
        except:
            m["duration_sec"] = None
    else:
        m["duration_sec"] = None
    m["attempt"] = meta.get("attempt", None)

# ── Output analysis ─────────────────────────────────────────────────────
output = []

def p(s=""):
    output.append(s)

p("# Insights: Análise de Qualidade do Processo Claude Code")
p(f"**Projeto**: socorro-24h | **Run**: run-1-standard-vibe-full-app | **Wave**: 1")
p(f"**Total de spawns analisados**: {len(all_metrics)}")
p()

# ── 1. Overview por step ────────────────────────────────────────────────
p("## 1. Visão Geral por Step")
p()

# Group by step (top-level dir)
step_groups = defaultdict(list)
for m in all_metrics:
    parts = m["_rel"].split("/")
    step_key = parts[0]  # e.g. step-01-pain-gain-analysis
    step_groups[step_key].append(m)

p("| Step | Task | Agent | Attempts | Timeouts | Duração Total | Tokens (in) | Tokens (out) | Tool Calls | Exit |")
p("|------|------|-------|----------|----------|---------------|-------------|-------------|------------|------|")

total_input = 0
total_output = 0
total_cache_create = 0
total_cache_read = 0
total_duration = 0
total_tool_calls = 0
total_timeouts = 0
total_attempts = 0

for step_key in sorted(step_groups.keys()):
    runs = step_groups[step_key]
    total_attempts += len(runs)
    task = runs[0]["task"]
    agent = runs[0]["agent"]
    attempts = len(runs)
    timeouts = sum(1 for r in runs if r["timed_out"])
    total_timeouts += timeouts
    dur = sum(r["duration_sec"] or 0 for r in runs)
    total_duration += dur
    inp = sum(r["total_input_tokens"] for r in runs)
    total_input += inp
    outp = sum(r["total_output_tokens"] for r in runs)
    total_output += outp
    total_cache_create += sum(r["total_cache_creation_tokens"] for r in runs)
    total_cache_read += sum(r["total_cache_read_tokens"] for r in runs)
    tc = sum(len(r["tool_calls"]) for r in runs)
    total_tool_calls += tc
    last_exit = runs[-1]["exit_code"]

    dur_str = f"{dur/60:.1f}m"
    inp_str = f"{inp:,}"
    outp_str = f"{outp:,}"

    p(f"| {step_key} | {task} | {agent} | {attempts} | {timeouts} | {dur_str} | {inp_str} | {outp_str} | {tc} | {last_exit} |")

p()
p(f"**Totais**: {total_attempts} spawns, {total_timeouts} timeouts, {total_duration/60:.1f}m duração, {total_input:,} input tokens, {total_output:,} output tokens, {total_tool_calls} tool calls")
p()

# ── 2. Token Economics ──────────────────────────────────────────────────
p("## 2. Token Economics")
p()
p(f"- **Input tokens total**: {total_input:,}")
p(f"- **Output tokens total**: {total_output:,}")
p(f"- **Cache creation tokens**: {total_cache_create:,}")
p(f"- **Cache read tokens**: {total_cache_read:,}")
cache_ratio = (total_cache_read / max(total_cache_read + total_cache_create, 1)) * 100
p(f"- **Cache hit ratio**: {cache_ratio:.1f}%")
p(f"- **Tokens gastos em spawns com timeout**: {sum(m['total_input_tokens'] + m['total_output_tokens'] for m in all_metrics if m['timed_out']):,}")
p()

# ── 3. Tool Usage Analysis ──────────────────────────────────────────────
p("## 3. Uso de Tools")
p()
tool_counts = defaultdict(int)
for m in all_metrics:
    for t in m["tool_calls"]:
        tool_counts[t] += 1

p("| Tool | Chamadas | % do Total |")
p("|------|----------|------------|")
for tool, count in sorted(tool_counts.items(), key=lambda x: -x[1]):
    pct = count / max(total_tool_calls, 1) * 100
    p(f"| {tool} | {count} | {pct:.1f}% |")
p()

# ── 4. Timeouts & Retries ──────────────────────────────────────────────
p("## 4. Timeouts & Retries")
p()
timeout_spawns = [m for m in all_metrics if m["timed_out"]]
p(f"- **Spawns com timeout**: {len(timeout_spawns)} de {len(all_metrics)} ({len(timeout_spawns)/len(all_metrics)*100:.0f}%)")
p()
if timeout_spawns:
    p("| Spawn | Task | Duração | Tokens Gastos |")
    p("|-------|------|---------|---------------|")
    for m in timeout_spawns:
        dur = f"{(m['duration_sec'] or 0)/60:.1f}m"
        tokens = m["total_input_tokens"] + m["total_output_tokens"]
        p(f"| {m['_rel'][:60]} | {m['task']} | {dur} | {tokens:,} |")
    p()
    wasted_tokens = sum(m["total_input_tokens"] + m["total_output_tokens"] for m in timeout_spawns)
    p(f"**Tokens desperdiçados em timeouts**: {wasted_tokens:,}")
    p()

# Steps with retries
retry_steps = {k: v for k, v in step_groups.items() if len(v) > 1}
if retry_steps:
    p("### Steps com múltiplas tentativas")
    p()
    for step_key, runs in sorted(retry_steps.items()):
        p(f"- **{step_key}** ({runs[0]['task']}): {len(runs)} tentativas")
        for r in runs:
            status = "TIMEOUT" if r["timed_out"] else f"exit {r['exit_code']}"
            dur = f"{(r['duration_sec'] or 0)/60:.1f}m"
            p(f"  - attempt {r.get('attempt', '?')}: {status}, {dur}, {r['total_input_tokens'] + r['total_output_tokens']:,} tokens")
    p()

# ── 5. Subagent Usage ──────────────────────────────────────────────────
p("## 5. Uso de Subagentes")
p()
total_subagents = sum(m["subagent_count"] for m in all_metrics)
p(f"- **Total de subagentes spawned**: {total_subagents}")
spawns_with_subagents = [m for m in all_metrics if m["subagent_count"] > 0]
p(f"- **Spawns que usaram subagentes**: {len(spawns_with_subagents)}")
p()
if spawns_with_subagents:
    p("| Spawn | Subagentes | Tarefas |")
    p("|-------|------------|---------|")
    for m in spawns_with_subagents:
        tasks_str = "; ".join(m["subagent_tasks"][:3])
        if len(m["subagent_tasks"]) > 3:
            tasks_str += f" ... +{len(m['subagent_tasks'])-3} mais"
        p(f"| {m['_rel'][:50]} | {m['subagent_count']} | {tasks_str[:80]} |")
    p()

# ── 6. Feature Loop Analysis ───────────────────────────────────────────
p("## 6. Ralph-Wiggum Loop (Features)")
p()
feature_spawns = [m for m in all_metrics if "ralph-wiggum" in m["_rel"]]
p(f"- **Total de feature spawns**: {len(feature_spawns)}")
if feature_spawns:
    feature_durations = [(m["_rel"], m["duration_sec"] or 0, m["total_input_tokens"] + m["total_output_tokens"], m["exit_code"], len(m["tool_calls"])) for m in feature_spawns]
    feature_durations.sort(key=lambda x: -x[1])

    p(f"- **Duração média por feature**: {sum(d[1] for d in feature_durations)/len(feature_durations)/60:.1f}m")
    p(f"- **Feature mais longa**: {feature_durations[0][0].split('/')[-1]} ({feature_durations[0][1]/60:.1f}m)")
    p(f"- **Feature mais curta**: {feature_durations[-1][0].split('/')[-1]} ({feature_durations[-1][1]/60:.1f}m)")
    p()

    p("| Feature | Duração | Tokens | Tools | Exit |")
    p("|---------|---------|--------|-------|------|")
    for rel, dur, tokens, exit_code, tc in sorted(feature_durations, key=lambda x: x[0]):
        fname = rel.split("/")[-1]
        p(f"| {fname} | {dur/60:.1f}m | {tokens:,} | {tc} | {exit_code} |")
    p()

    # Token distribution in features
    feature_tokens = [m["total_input_tokens"] + m["total_output_tokens"] for m in feature_spawns]
    avg_tokens = sum(feature_tokens) / len(feature_tokens)
    max_tokens = max(feature_tokens)
    min_tokens = min(feature_tokens)
    p(f"- **Tokens por feature**: avg={avg_tokens:,.0f}, min={min_tokens:,}, max={max_tokens:,}")
    p()

# ── 7. Error Analysis ──────────────────────────────────────────────────
p("## 7. Erros")
p()
all_errors = []
for m in all_metrics:
    for e in m["errors"]:
        all_errors.append((m["_rel"], e))
p(f"- **Total de tool errors**: {sum(m['tool_results_failed'] for m in all_metrics)}")
if all_errors:
    p()
    # Group similar errors
    error_patterns = defaultdict(int)
    for rel, e in all_errors:
        # simplify error
        if "permission" in e.lower():
            error_patterns["Permission denied"] += 1
        elif "not found" in e.lower() or "no such" in e.lower():
            error_patterns["File/command not found"] += 1
        elif "timeout" in e.lower():
            error_patterns["Timeout"] += 1
        elif "ENOENT" in e:
            error_patterns["ENOENT (file not found)"] += 1
        else:
            short = e[:80]
            error_patterns[short] += 1

    p("| Padrão de Erro | Ocorrências |")
    p("|----------------|-------------|")
    for pattern, count in sorted(error_patterns.items(), key=lambda x: -x[1])[:15]:
        p(f"| {pattern} | {count} |")
p()

# ── 8. Context Compression ─────────────────────────────────────────────
p("## 8. Context Compression")
p()
total_compressions = sum(m["context_compressions"] for m in all_metrics)
p(f"- **Total de compressões de contexto**: {total_compressions}")
if total_compressions > 0:
    compressed_spawns = [m for m in all_metrics if m["context_compressions"] > 0]
    p(f"- **Spawns com compressão**: {len(compressed_spawns)}")
    for m in compressed_spawns:
        p(f"  - {m['_rel'][:60]}: {m['context_compressions']} compressões")
p()

# ── 9. Efficiency Metrics ──────────────────────────────────────────────
p("## 9. Métricas de Eficiência")
p()
# Tokens per minute
if total_duration > 0:
    p(f"- **Throughput**: {total_output/(total_duration/60):,.0f} output tokens/min")
    p(f"- **Tool calls/min**: {total_tool_calls/(total_duration/60):.1f}")
p()

# Ratio of Bash vs dedicated tools
bash_total = sum(m["bash_count"] for m in all_metrics)
dedicated = sum(m["read_count"] + m["write_count"] + m["edit_count"] + m["glob_count"] + m["grep_count"] for m in all_metrics)
p(f"- **Bash calls**: {bash_total}")
p(f"- **Dedicated tool calls** (Read/Write/Edit/Glob/Grep): {dedicated}")
if bash_total + dedicated > 0:
    p(f"- **Ratio Bash/(Bash+Dedicated)**: {bash_total/(bash_total+dedicated)*100:.0f}% (menor = melhor)")
p()

# Web research efficiency
web_total = sum(m["websearch_count"] + m["webfetch_count"] for m in all_metrics)
p(f"- **Web calls** (Search+Fetch): {web_total}")
p()

# ── 10. Top Insights ───────────────────────────────────────────────────
p("## 10. Insights & Recomendações")
p()

insights = []

# Timeout rate
timeout_rate = len(timeout_spawns) / len(all_metrics) * 100
if timeout_rate > 15:
    insights.append(f"🔴 **Taxa de timeout alta ({timeout_rate:.0f}%)**: {len(timeout_spawns)} de {len(all_metrics)} spawns deram timeout. Isso desperdiça tokens e tempo. Considere aumentar o timeout ou otimizar os prompts para serem mais concisos.")

# Retry waste
if retry_steps:
    retry_waste = sum(
        sum(r["total_input_tokens"] + r["total_output_tokens"] for r in runs[:-1])
        for runs in retry_steps.values()
    )
    insights.append(f"🟡 **Tokens gastos em retries**: {retry_waste:,} tokens foram consumidos em tentativas que não vingaram. Steps com retries: {', '.join(retry_steps.keys())}.")

# Cache efficiency
if cache_ratio < 50:
    insights.append(f"🟡 **Cache hit ratio baixo ({cache_ratio:.0f}%)**: Muitos tokens são recriados no cache ao invés de lidos. Prompts mais estáveis ou compartilhamento de prefixos entre steps ajudariam.")
else:
    insights.append(f"🟢 **Cache hit ratio bom ({cache_ratio:.0f}%)**: Aproveitamento razoável do cache de prompt.")

# Bash overuse
if bash_total + dedicated > 0 and bash_total / (bash_total + dedicated) > 0.5:
    insights.append(f"🟡 **Uso excessivo de Bash ({bash_total} calls vs {dedicated} dedicated)**: O agente usa Bash para operações que poderiam ser feitas com Read/Write/Edit/Glob/Grep. Isso é menos eficiente e dificulta auditoria.")

# Feature variance
if feature_spawns:
    feature_durs = [m["duration_sec"] or 0 for m in feature_spawns]
    if max(feature_durs) > 3 * min(feature_durs) and min(feature_durs) > 0:
        insights.append(f"🟡 **Alta variância de duração entre features**: A feature mais longa demorou {max(feature_durs)/60:.0f}m vs {min(feature_durs)/60:.0f}m da mais curta. Features muito complexas poderiam ser decompostas.")

# Subagent usage
if total_subagents > 0:
    insights.append(f"🔵 **Subagentes ativos**: {total_subagents} subagentes spawned em {len(spawns_with_subagents)} spawns. Paralelismo é bom, mas cada subagente consome contexto adicional.")

# Thinking overhead
total_thinking = sum(m["thinking_blocks"] for m in all_metrics)
total_text = sum(m["text_blocks"] for m in all_metrics)
if total_thinking > 0:
    insights.append(f"🔵 **Thinking blocks**: {total_thinking} blocos de thinking vs {total_text} blocos de texto. Extended thinking está ativo.")

for i, insight in enumerate(insights, 1):
    p(f"{i}. {insight}")

p()

# ── 11. Speed Optimization Recommendations ──────────────────────────────
p("## 11. Recomendações para Velocidade")
p()
p("### Reduzir Timeouts")
p("- Prompts mais curtos e focados (less context, more direction)")
p("- Timeout adaptivo: steps de pesquisa podem ter timeout maior, steps de codificação menor")
p("- Detectar loops improdutivos (agente re-tentando o mesmo tool call) e abortar mais cedo")
p()
p("### Otimizar Tokens")
p("- Reduzir o tamanho do system prompt (CLAUDE.md) — cada spawn paga o custo do prompt base")
p("- Compartilhar prefixos comuns entre steps adjacentes para maximizar cache hits")
p("- Para steps de codificação, enviar apenas os arquivos relevantes ao invés de ler o repo inteiro")
p()
p("### Reduzir Retries")
p("- Steps com alta taxa de retry indicam instruções ambíguas ou critérios de sucesso imprecisos")
p("- Ajustar `stop_on` para aceitar respostas parciais quando o core está correto")
p("- Logs de retries devem ser injetados na próxima tentativa para evitar repetir erros")
p()
p("### Paralelismo")
p("- Features independentes no ralph-wiggum loop podem ser executadas em paralelo")
p("- Steps sem dependência sequencial poderiam ser executados concorrentemente")
p()

# Write output
out_path = os.path.join("D:/sources/_unowned/agentic-workflow/.tmp/-insights", "INSIGHTS.md")
with open(out_path, "w", encoding="utf-8") as fh:
    fh.write("\n".join(output))

print(f"Written to {out_path}")
print(f"\nQuick summary:")
print(f"  Spawns: {len(all_metrics)}")
print(f"  Timeouts: {len(timeout_spawns)}")
print(f"  Total duration: {total_duration/60:.0f}m")
print(f"  Total tokens: {total_input + total_output:,}")
