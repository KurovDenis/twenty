# TypeScript Error Fixes Design Document

## 1. Overview

This design document outlines a comprehensive strategy for resolving the TypeScript compilation errors found in the Twenty CRM codebase, specifically in the `engine/core-modules/business-setup/sgr` module. The errors span multiple files and encompass various type issues including missing properties, incompatible types, and incorrect method signatures.

## 2. Error Analysis

The TypeScript errors can be categorized into several distinct patterns:

### 2.1 Missing Properties in Types
- Missing properties in interface implementations (e.g., `AvitoWorkflowMetrics` missing `totalSteps` and `errorRate` properties)
- Properties not existing on types (e.g., `AVITO_CREDENTIALS_STORED` on `BusinessSetupStepKeys`)
- Undefined methods or properties on objects (e.g., `get` and `close` on `TestingModuleBuilder`)

### 2.2 Incompatible Types
- Type mismatches between expected and actual types (e.g., `null` not assignable to `string | undefined`)
- Enum value mismatches (e.g., `"API"` not assignable to error type enum)
- Extra properties in object literals that aren't defined in the target interface

### 2.3 Method Signature Issues
- Incorrect parameter counts in function calls
- Type mismatches in method parameters or return values
- Duplicate identifier declarations

### 2.4 Module Import Issues
- Cannot find module `@nestjs/swagger`

## 3. Proposed Solutions

### 3.1 Interface Extensions and Type Updates

For missing properties in interfaces and types, we'll update the relevant type definitions:

#### 3.1.1 `AvitoWorkflowMetrics` Interface Update

```typescript
// Current interface
interface AvitoWorkflowMetrics {
  totalErrors: number;
  errorsByType: Record<string, number>;
  // ...other existing properties
}

// Updated interface
interface AvitoWorkflowMetrics {
  totalErrors: number;
  errorsByType: Record<string, number>;
  totalSteps: number;
  errorRate: number;
  // ...other existing properties
}
```

#### 3.1.2 `BusinessSetupStepKeys` Enum Update

```typescript
// Current enum
export enum BusinessSetupStepKeys {
  // existing keys
}

// Updated enum
export enum BusinessSetupStepKeys {
  // existing keys
  AVITO_CREDENTIALS_STORED = 'avito_credentials_stored',
}
```

#### 3.1.3 `SupervisorErrorType` Enum Update

```typescript
// Current enum
export enum SupervisorErrorType {
  // existing keys
}

// Updated enum
export enum SupervisorErrorType {
  // existing keys
  INVALID_TOOL = 'invalid_tool',
}
```

### 3.2 Object Literal Corrections

For object literals with extra properties, we need to update either the interface definitions or modify the object literals:

#### 3.2.1 Route to Specialized Agent Tool

```typescript
// Current implementation
{
  tool: "route_to_specialized_agent",
  target_status: BusinessSetupStatus.SOME_STATUS,
  message: "message",
  reason: "reason"
}

// Corrected implementation
{
  tool: "route_to_specialized_agent",
  status: BusinessSetupStatus.SOME_STATUS,  // Changed from target_status to status
  message: "message",
  reason: "reason"
}
```

#### 3.2.2 SupervisorThinkingStep Updates

```typescript
// Current implementation
{
  type: "thinking",
  thinking: "some thinking content"
}

// Corrected implementation (depending on actual interface definition)
{
  type: "thinking",
  content: "some thinking content"  // Replace thinking with content if that's what the interface expects
}
```

### 3.3 Test Module Fixes

For issues in test files involving `TestingModule` and duplicate identifiers:

#### 3.3.1 TestingModuleBuilder Methods

```typescript
// Current usage
const moduleBuilder = Test.createTestingModule({ ... });
const someService = moduleBuilder.get(SomeService);
await moduleBuilder.close();

// Fixed usage (assuming TestingModule provides these methods)
const moduleRef = await Test.createTestingModule({ ... }).compile();
const someService = moduleRef.get(SomeService);
await moduleRef.close();
```

#### 3.3.2 Fix for Duplicate Identifiers

Resolve duplicate imports in test files, particularly in `avito-workflow-error-recovery.service.spec.ts`:

```typescript
// Instead of importing the same items multiple times
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
// ...

// Only import once and use throughout the file
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
// ...
```

### 3.4 Function Argument Type Fixes

For issues with function arguments having incorrect types:

#### 3.4.1 SGRStreamingResult Type

```typescript
// Update the interface to include missing properties used in tests
interface SGRStreamingResult {
  // Existing properties
  type: string;
  content?: string;
  completed?: boolean;
  
  // Add missing properties used in tests
  workflowState?: any;
  workflowContext?: any;
  workflowDuration?: number;
  error?: any;
  timestamp?: string;
  // Additional properties as needed
}
```

#### 3.4.2 Validate Avito Token Tool Parameters

```typescript
// Current implementation
{
  tool: "validate_avito_token",
  client_id: "some_id",
  client_secret: "some_secret"
}

// Fixed implementation
{
  tool: "validate_avito_token",
  client_id: "some_id",
  client_secret: "some_secret",
  api_url: "https://api.avito.com/v1"  // Add required property
}
```

### 3.5 Missing Module Installation

For the missing `@nestjs/swagger` module:

```bash
# Install the required dependency
yarn add @nestjs/swagger
```

## 4. Implementation Approach

The implementation will be tackled in phases to ensure systematic error resolution:

### 4.1 Type Definition Updates
1. Update all interface and type definitions to include missing properties
2. Update enum definitions to include missing values
3. Create shared type definition files where appropriate to avoid duplication

### 4.2 Test File Fixes
1. Fix duplicate imports in test files
2. Correct testing module usage patterns
3. Update mock objects to conform to the correct interfaces

### 4.3 Implementation Corrections
1. Fix object literal structures to match expected interfaces
2. Correct function parameter types and counts
3. Address error handling and logging inconsistencies

### 4.4 Dependency Resolution
1. Install missing dependencies
2. Ensure proper module imports throughout the codebase

## 5. Testing Strategy

To validate the fixes, we'll implement the following testing approach:

### 5.1 TypeScript Compilation
- Run TypeScript compiler after each set of fixes to confirm error resolution
- Track remaining errors and address them incrementally

### 5.2 Unit Tests
- Ensure all unit tests pass after type fixes
- Add additional tests for edge cases uncovered during the fix process

### 5.3 Integration Tests
- Verify that the business setup SGR module functions correctly after fixes
- Test the complete workflow to ensure no regressions

## 6. File Modification List

The following files need to be modified to resolve the TypeScript errors:

### 6.1 Service Files
- `avito-welcome-tool-dispatcher.service.ts`
- `avito-workflow-error-recovery.service.ts`
- `avito-workflow-monitoring.service.ts`
- `enhanced-avito-welcome-tool-dispatcher.service.ts`
- `secure-avito-credential-storage.service.spec.ts`

### 6.2 Test Files
- `avito-integration-e2e.spec.ts`
- `enhanced-avito-workflow.spec.ts`
- `supervisor-error-scenarios.spec.ts`
- `supervisor-integration.spec.ts`
- `supervisor-tool-dispatcher.service.spec.ts`
- `avito-workflow-error-recovery.service.spec.ts`
- `avito-workflow-state-machine.service.integration.spec.ts`
- `enhanced-avito-welcome-tool-dispatcher.service.spec.ts`

### 6.3 Other Files
- `sgr-health.controller.ts`

## 7. Type Definition Updates

The specific type definition updates needed are illustrated below:

```typescript
// AvitoWorkflowMetrics extensions
interface AvitoWorkflowMetrics {
  totalErrors: number;
  errorsByType: Record<string, number>;
  errorsBySeverity: Record<string, number>;
  escalatedCount: number;
  resolvedCount: number;
  totalSteps: number;  // Add missing property
  errorRate: number;   // Add missing property
  averageResolutionTime?: number; // Add optional property used in tests
  escalatedErrors?: any[]; // Add optional property used in tests
}

// SupervisorException extensions
interface SupervisorException extends Error {
  errorType: SupervisorErrorType;
  // Other properties
}

// SGRStreamingResult extensions
interface SGRStreamingResult {
  type: string;
  content?: string;
  step?: {
    stepNumber: number;
    // other step properties
  };
  workflowState?: any;
  workflowContext?: any;
  error?: any;
  timestamp?: string;
  workflowDuration?: number;
  isComplete?: boolean;
}

// SupervisorThinkingStep extensions
interface SupervisorThinkingStep {
  type: "thinking" | "tool_execution" | "final_response" | "function_call";
  content?: string;
  thinking?: string; // Alternative property name used in tests
  step?: any; // Used in some test cases
  function?: any; // Used in function_call step type
}

// Error types extension
type AvitoErrorType = "TIMEOUT" | "AUTH" | "UNKNOWN" | "NETWORK" | "VALIDATION" | "EXECUTION" | "RATE_LIMIT" | "API" | undefined;

// AvitoWorkflowConfig extensions
interface AvitoWorkflowConfig {
  maxAttempts: number;
  timeoutMs: number;
  retryDelayMs: number;
  enableAutoRetry: boolean;
  enableEncryption: boolean;
  enableAuditLog: boolean;
  apiTimeoutMs: number;
  validationStrictMode: boolean;
  allowedCredentialFormats: string[];
}
```

## 8. Risks and Mitigations

### 8.1 Type Compatibility Risks
- **Risk**: Changes to interfaces may cause incompatibilities with existing code
- **Mitigation**: Carefully track interface usages and update all implementations

### 8.2 Test Coverage Risks
- **Risk**: Fixing type errors in tests might mask actual issues
- **Mitigation**: Ensure tests are still validating the correct functionality

### 8.3 Dependency Risks
- **Risk**: Adding new dependencies may introduce version conflicts
- **Mitigation**: Verify compatibility with existing dependency versions

## 9. Implementation Schedule

| Phase | Task | Estimated Time |
|-------|------|---------------|
| 1 | Update core type definitions | 2 hours |
| 2 | Fix test file imports and duplications | 3 hours |
| 3 | Update object literals to match interfaces | 2 hours |
| 4 | Fix function parameter types | 2 hours |
| 5 | Install missing dependencies | 1 hour |
| 6 | Validation and testing | 4 hours |
| 7 | Documentation and code review | 2 hours |