<!--
Purpose: Document the Meechie voice pack content and editing rules.
Why: Make Meechie voice lines auditable and easy to revise without hunting through code.
Info flow: This doc -> adapter/fixtures updates -> contract tests.
-->
# Meechie Voice Pack

A "voice pack" is a structured set of lines, templates, and keyword rules used by Meechie tools to produce responses.

## Editing rules
- Placeholders use braces (for example, `{moment}`) and are replaced with normalized input (trimmed, single-spaced).
- Keys in `exactMap` and `map` must be lowercase because matching is normalized to lowercase.
- The order of `wwmd.triggers` matters; the first match wins.
- If you change any response text, update:
  - `src/lib/adapters/meechie-voice.adapter.ts`
  - `fixtures/meechie-voice/sample.json`
  - `fixtures/meechie-tool/sample.json` (if the output changes)
  - `fixtures/meechie-tool/fault.json` (if the lineup error message changes)

## Current voice pattern (v1)
- Open strong: state power as fact before interpretation.
- Be specific: name person/place/cost whenever possible.
- Document consequence: avoid vague warnings and generic motivation.
- Keep cadence short, polished, and memorable.

Canonical data source:
- `fixtures/meechie-voice/sample.json` (`output.value`) is the contract source of truth.
