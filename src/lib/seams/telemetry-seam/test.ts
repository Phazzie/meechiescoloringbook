// Purpose: Contract tests for TelemetrySeam.
// Why: Enforce mock adherence to the seam contract.
// Info flow: tests -> mock -> contract assertions.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createConsoleTelemetrySeam } from '../../adapters/telemetry-seam';
import { telemetryEventFixture } from './fixtures';
import { createMockTelemetrySeam, mockTelemetryStore } from './mock';
import { validateTelemetryEvent } from './validators';

describe('TelemetrySeam mock contract', () => {
  it('accepts telemetry events', () => {
    mockTelemetryStore.length = 0;
    const seam = createMockTelemetrySeam(mockTelemetryStore);
    seam.emit(telemetryEventFixture);

    expect(mockTelemetryStore).toEqual([telemetryEventFixture]);
    expect(validateTelemetryEvent(mockTelemetryStore[0])).toEqual(telemetryEventFixture);
  });
});

describe('TelemetrySeam console adapter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes a JSON telemetry line to console.log', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const seam = createConsoleTelemetrySeam();
    seam.emit(telemetryEventFixture);

    expect(logSpy).toHaveBeenCalledOnce();
    const logged = logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(logged) as { telemetry: unknown };
    expect(parsed.telemetry).toMatchObject({ name: 'generation_requested' });
  });

  it('emitted event passes schema validation', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const seam = createConsoleTelemetrySeam();
    seam.emit({ name: 'generation_succeeded', timestamp: '2025-01-01T00:00:00.000Z', metadata: { imageCount: 2 } });

    const logged = logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(logged) as { telemetry: unknown };
    expect(() => validateTelemetryEvent(parsed.telemetry)).not.toThrow();
  });

  it('does not throw when emit is called with all event types', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const seam = createConsoleTelemetrySeam();
    const baseEvent = { timestamp: '2025-01-01T00:00:00.000Z' };
    expect(() => seam.emit({ ...baseEvent, name: 'generation_requested' })).not.toThrow();
    expect(() => seam.emit({ ...baseEvent, name: 'generation_succeeded' })).not.toThrow();
    expect(() => seam.emit({ ...baseEvent, name: 'generation_failed' })).not.toThrow();
    expect(() => seam.emit({ ...baseEvent, name: 'prompt_compiler_fallback' })).not.toThrow();
  });
});
