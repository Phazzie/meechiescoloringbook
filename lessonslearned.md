# Lessons Learned

- **Tone Enforcement via Schema Validation**: Using Zod's `.superRefine` to detect "therapy-speak" directly in the schema layer is highly effective for enforcing a specific AI persona (Meechie). It allows the application to cleanly catch and retry with aggressive system prompts instead of polluting the core UI with validation logic.
- **Strict Framing over Few-Shots**: Providing strict, aggressive framing text ("THIS IS WHAT MEECHIE HAS ACTUALLY SAID...") directly in the prompt is more effective than few-shot examples for preventing the LLM from falling back into generic "assistant" patterns or mimicking structural formats (like motivational posters).
- **Default Payloads as Presets**: Loading pre-defined canonical payloads directly into the studio state (`currentText`) gracefully bypasses the text generation pipeline while keeping the UI and image generation flow intact, creating an instant, authentic user experience.
