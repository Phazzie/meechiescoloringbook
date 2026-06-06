// Purpose: Provide a test-facing SafetyPolicySeam factory.
// Why: Keep existing mock imports stable while sharing the deterministic policy implementation.
// Info flow: tests -> mock factory -> pure safety policy implementation.
export { createSafetyPolicySeam as createMockSafetyPolicySeam } from './policy';
