---
name: fitmodel-verify
description: Verification protocol for FitModel (Astro 5 evidence-driven AI model recommendation site). Use when validating changes, checking build health, or verifying feature completeness before deployment.
---

# FitModel Project Verification

This skill documents how to verify FitModel's user-facing features and data integrity. Run these checks after making changes to evidence, scoring logic, or scenario configuration.

## Feature Map

### Core User-Facing Behaviors

| Feature | What It Does | How Users See It |
|---------|--------------|------------------|
| **Home Page Speed Guide** | Shows 15 scenarios with TOP/VALUE/FREE recommendations | `/` — users pick a scenario matching their task |
| **Scenario Detail Pages** | Full ranking with confidence badges, dimension weights, and pitfalls | `/scenarios/{id}/` — users get complete recommendations with evidence |
| **Model Library** | Comprehensive ability index ranked by overall fit | `/models/` — users compare models across dimensions |
| **Leaderboard** | Rankings filtered by dimension (general/coding/writing/long_context) | `/leaderboards/` — users see specialized rankings |
| **JSON API** | Machine-readable data for agents/integrations | `/api/v1/*.json` — programmatic access with CORS enabled |
| **Evidence Traceability** | Every score links back to source URLs with retrieval dates | All ranking pages — users can verify claims |

### Evidence-Driven Scoring Rules

- **Build = Validate**: `npm run build` fails on unregistered metrics
- **Freshness Gates**: Stale evidence (>freshness_days) displays but doesn't affect scores
- **Out-of-Range**: Values outside `plausible` domain trigger warnings
- **Conflict Detection**: Same-day evidence diverging >10% uses median with lowered confidence

## Verification Commands

### 1. Build Health Check

```bash
# Full build with validation
npm run build

# Expected: exit 0, no "error" lines
# Failure modes:
#   - Unregistered metric in evidence.yaml → build fails (hard error)
#   - Schema violation in content → build fails
#   - Missing required fields → build fails
```

**Pass criteria**: Exit code 0, dist/ folder created with all API endpoints.

### 2. Data Freshness Audit

```bash
# Check evidence staleness (CI gate)
npm run check:freshness

# Expected: exit 0 when all evidence within freshness windows
# Non-zero exit: some metrics have stale/missing evidence
```

**Pass criteria**: Exit 0. If non-zero, check which metrics are stale:

```bash
npm run sync | grep -E "^\[STALE|GAP\]"
```

### 3. Sync Status Report

```bash
# Full diagnostic: freshness + source change detection + task cards
npm run sync

# Check for:
# - [STALE] metrics (already past freshness window — not scoring)
# - [GAP] metrics (registered but no evidence — dimension coverage hole)
# - [DUE] metrics (past half of freshness window — should update soon)
# - Source change detection results (unchanged/changed/unreachable)
```

**Pass criteria**: 
- No [STALE] entries (or acknowledged in changelog)
- [GAP] entries match documented "data collection in progress" notes
- [DUE] entries tracked in maintenance schedule

### 4. API Endpoint Integrity

```bash
# After successful build, verify API outputs exist
test -f dist/api/v1/index.json && echo "✓ index.json"
test -f dist/api/v1/all.json && echo "✓ all.json"
test -f dist/api/v1/models.json && echo "✓ models.json"
test -f dist/api/v1/evidence.json && echo "✓ evidence.json"
test -d dist/api/v1/scenarios && echo "✓ scenarios/"

# Validate JSON structure
jq '.scenarios | length' dist/api/v1/index.json
# Expected: 15 (number of scenarios)

jq '.models | length' dist/api/v1/models.json
# Expected: >0 (models with coverage > 0)

# Check API self-description
jq '.service, .schema_version, .methodology_url' dist/api/v1/index.json
# Expected: "FitModel", "1.0", and a valid URL
```

**Pass criteria**: All files exist, JSON is valid, counts match expectations.

### 5. Scenario Scoring Completeness

```bash
# Check which scenarios have valid picks (not null due to missing data)
jq -r '.scenarios[] | "\(.id): \(if .picks.top then "✓" else "✗ (no picks)" end)"' \
  dist/api/v1/index.json

# Investigate scenarios with null picks
jq '.scenarios[] | select(.picks.top == null) | {id, scoring_disabled, rank_count}' \
  dist/api/v1/index.json
```

**Pass criteria**: 
- All scenarios either have picks OR explicitly set `scoring_disabled: true`
- No scenario has `scoring_disabled: false` yet `picks: null` (data gap)

### 6. Evidence Coverage by Dimension

```bash
# Count evidence entries per dimension
jq -r '.[] | .dimension' src/data/metrics.yaml | sort | uniq -c

# Check which dimensions have <5 evidence entries per variant on average
jq -r '
  .evidence 
  | group_by(.metric) 
  | .[] 
  | {metric: .[0].metric, count: length}
' dist/api/v1/all.json | jq -s 'sort_by(.count)'
```

**Pass criteria**: No dimension-critical metrics (weight >0.3 in any scenario) with <10 total evidence entries.

### 7. Price Data Completeness (for VALUE picks)

```bash
# Models with ability scores but missing price data can't appear in VALUE picks
jq '
  .models 
  | map(select(.price == null)) 
  | map({variant, has_scores: (.evidence | length > 0)}) 
  | map(select(.has_scores))
' dist/api/v1/models.json

# Expected: Empty array OR variants documented as "API-only, no public pricing"
```

**Pass criteria**: Models missing price are either low-coverage or documented exceptions.

### 8. Ranking Confidence Distribution

```bash
# Check confidence label distribution across all scenarios
jq -r '
  .scenarios[].ranking[] 
  | .confidence_label
' dist/api/v1/all.json | sort | uniq -c

# Expected distribution: mostly "高" or "中", few "低"
# Many "低" indicates systematic data coverage issues
```

**Pass criteria**: <20% of rankings have "低" confidence (unless during data migration).

### 9. Evidence Source Verification (Sample)

```bash
# Randomly sample 5 evidence entries and verify URLs are accessible
jq -r '.evidence[:5] | .[] | .source_url' dist/api/v1/evidence.json \
  | while read url; do
      curl -sI "$url" | head -1
    done

# Expected: HTTP 200 or 403 (CloudFlare/bot block is OK; 404 is NOT)
```

**Pass criteria**: No 404 errors. 403 is acceptable for JS-rendered sources.

### 10. Dimension Weight Sum Validation

```bash
# All scenarios must have dimension weights summing to 1.0 (schema enforces this)
# Verify no floating-point precision errors leaked through
jq -r '
  .scenarios[] 
  | select(.scoring_disabled == false) 
  | {id, weight_sum: ([.weights[]] | add)}
' dist/api/v1/all.json

# Expected: All weight_sum values == 1.0
```

**Pass criteria**: All non-disabled scenarios have weight_sum = 1.0 (±0.001).

## Common Failure Modes

### Build Fails: "未注册指标"

**Symptom**: `npm run build` exits non-zero with message like:
```
[evidence] ev-xxx-123: 未注册指标 "metric_name"，先在 metrics.yaml 登记
```

**Fix**: Either:
1. Register the metric in `src/data/metrics.yaml` (requires human approval per AGENTS.md)
2. Remove the evidence entry (if it was added by mistake)

### Scenario Has Null Picks Despite scoring_disabled: false

**Symptom**: `jq '.scenarios[] | select(.picks.top == null and .scoring_disabled != true)' dist/api/v1/index.json` returns entries.

**Root cause**: Missing evidence for dimension metrics used by that scenario (coverage = 0).

**Fix**: 
1. Identify missing dimensions: `jq '.scenarios[] | select(.id == "scenario-id") | .weights' dist/api/v1/all.json`
2. Check evidence coverage: `npm run sync | grep -A3 "metric_name"`
3. Either add evidence OR set `scoring_disabled: true` in the scenario YAML with a note

### Many Rankings Have "低" Confidence

**Symptom**: >30% of `.scenarios[].ranking[].confidence_label` are "低".

**Root causes**:
- Evidence age (most data >30 days old)
- Sparse coverage (only 1-2 metrics per dimension)
- High disagreement (tier 3 sources contradicting tier 1/2)

**Fix**: Per AGENTS.md, run weekly `npm run sync` to identify stale metrics and refresh from source whitelist.

## Integration with AGENTS.md Workflow

This verification skill complements the maintenance protocol in `/AGENTS.md`:

1. **After Evidence Collection** (AGENTS.md step 3): Run `npm run build` to validate evidence integrity
2. **Before Changelog** (AGENTS.md step 5): Run this verification suite to document what changed
3. **Before PR Approval**: Human reviewer runs spot-check sample commands to audit agent work

## When to Update This Skill

- New user-facing feature added → add to Feature Map + corresponding check command
- New validation rule in `scoring.ts` → add to Evidence-Driven Scoring Rules + verification command
- API schema changes → update API Endpoint Integrity section

## Quick Verification One-Liner

```bash
npm run build && npm run check:freshness && \
jq '.scenarios | length' dist/api/v1/index.json && \
echo "✓ All core checks passed"
```

**Expected output**: Build success, freshness OK, scenario count = 15, final "✓" line.
