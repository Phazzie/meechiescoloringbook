/*
 * Purpose: Re-export fixture-backed mock for ChatInterpretationSeam.
 * Why: Maintain backward compatibility for legacy contract tests and test suites.
 * Info flow: Callers -> modular chat-interpretation seam mock.
 * Invariants: Delegate directly to createChatInterpretationMock in chat-interpretation-seam/mock.
 */
export { createChatInterpretationMock } from '$lib/seams/chat-interpretation-seam/mock';
