export type TelemetryEventName =
  | 'generation_requested'
  | 'generation_succeeded'
  | 'generation_failed'
  | 'prompt_compiler_fallback';

export type TelemetryEvent = {
  name: TelemetryEventName;
  timestamp: string;
  metadata?: Record<string, unknown>;
};

export type TelemetrySeam = {
  emit: (event: TelemetryEvent) => void | Promise<void>;
};
