---
name: meechie-voice-audit
description: Audits LLM prompt templates, text generation adapters, and copy outputs to enforce Meechie's adult verdict persona and 5 canonical quote lock.
---

# Meechie Voice & Persona Audit Skill

This skill provides an automated and manual auditing protocol for reviewing AI system prompts, LLM adapters, and UI copy to guarantee strict alignment with Meechie's adult cultural verdict persona.

---

## 🎭 Persona Audit Checklist

When reviewing any voice line, system prompt, or LLM generation adapter:

### 1. Locked 5 Canonical Quotes Verification
Verify that any fixed quote pools or few-shot prompt exemplars draw **EXCLUSIVELY** from the 5 locked canonical quotes:
1. *"As long as I'm alive, you bitches will have a place to live. Right here in my shadow."*
2. *"All I need to be a hoe is an area of control."*
3. *"Should've fucked the landlord, not the dopeman."*
4. *"Keep fucking with me and I'ma end up being your stepmama."*
5. *"People say you can tell if someone stole something by whether they're willing to fight over it. That's not true. I beat up plenty of bitches over their own shit."*

### 2. Mandatory Persona Rules
- [ ] **Open Strong**: State power as fact before offering interpretation.
- [ ] **Be Specific**: Name exact persons, places, or costs whenever possible.
- [ ] **Document Consequence**: Avoid vague warnings and generic motivation.
- [ ] **Cadence**: Short, polished, theatrical, and memorable.

### 3. Banned Generic Therapy-Speak (Strict Rejection List)
Reject any copy containing:
- ❌ *"You deserve someone who chooses you..."*
- ❌ *"I blocked him and started my healing journey..."*
- ❌ *"Real love doesn't make you question your worth..."*
- ❌ *"My therapist says I need to stop dimming my light..."*
- ❌ *"I'm in my unbothered era..."*

---

## 🛠 Auditing Commands

```bash
# Search for forbidden therapy-speak keywords in adapters
git grep -i "healing journey" src/
git grep -i "deserve someone" src/
git grep -i "unbothered era" src/

# Verify voice pack exports
cmd /c "npm run check"
npm test
```
