import { Injectable, Logger } from '@nestjs/common';
import { trace, type Span, type SpanAttributes, SpanStatusCode } from '@opentelemetry/api';

export interface TracingContext {
  agentId: string;
  threadId: string;
  workspaceId: string;
  userId: string;
  operation: string;
}

@Injectable()
export class LangGraphTracingService {
  private readonly logger = new Logger(LangGraphTracingService.name);
  private readonly tracer = trace.getTracer('langgraph-agent');

  async traceAgentExecution<T>(
    agentId: string,
    operation: string,
    fn: () => Promise<T>,
    attributes?: SpanAttributes,
  ): Promise<T> {
    const span = this.tracer.startSpan(`agent.${operation}`, {
      attributes: {
        'agent.id': agentId,
        'agent.operation': operation,
        ...attributes,
      },
    });

    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  }

  async traceStateOperation<T>(
    operation: string,
    threadId: string,
    fn: () => Promise<T>,
    attributes?: SpanAttributes,
  ): Promise<T> {
    const span = this.tracer.startSpan(`state.${operation}`, {
      attributes: {
        'state.operation': operation,
        'thread.id': threadId,
        ...attributes,
      },
    });

    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  }

  async traceLLMCall<T>(
    model: string,
    operation: string,
    fn: () => Promise<T>,
    attributes?: SpanAttributes,
  ): Promise<T> {
    const span = this.tracer.startSpan(`llm.${operation}`, {
      attributes: {
        'llm.model': model,
        'llm.operation': operation,
        ...attributes,
      },
    });

    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  }

  async traceToolExecution<T>(
    toolName: string,
    fn: () => Promise<T>,
    attributes?: SpanAttributes,
  ): Promise<T> {
    const span = this.tracer.startSpan(`tool.${toolName}`, {
      attributes: {
        'tool.name': toolName,
        ...attributes,
      },
    });

    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  }

  createSpan(
    name: string,
    attributes?: SpanAttributes,
  ): Span {
    return this.tracer.startSpan(name, { attributes });
  }

  addEvent(
    span: Span,
    name: string,
    attributes?: SpanAttributes,
  ): void {
    span.addEvent(name, attributes);
  }

  setAttributes(
    span: Span,
    attributes: SpanAttributes,
  ): void {
    span.setAttributes(attributes);
  }

  recordException(
    span: Span,
    error: Error,
    attributes?: SpanAttributes,
  ): void {
    span.recordException(error);
  }

  // Trace message processing
  async traceMessageProcessing<T>(
    messageId: string,
    threadId: string,
    fn: () => Promise<T>,
    attributes?: SpanAttributes,
  ): Promise<T> {
    const span = this.tracer.startSpan('message.processing', {
      attributes: {
        'message.id': messageId,
        'thread.id': threadId,
        ...attributes,
      },
    });

    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  }

  // Trace validation
  async traceValidation<T>(
    validationType: string,
    fn: () => Promise<T>,
    attributes?: SpanAttributes,
  ): Promise<T> {
    const span = this.tracer.startSpan(`validation.${validationType}`, {
      attributes: {
        'validation.type': validationType,
        ...attributes,
      },
    });

    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  }

  // Trace encryption operations
  async traceEncryption<T>(
    operation: 'encrypt' | 'decrypt',
    fn: () => Promise<T>,
    attributes?: SpanAttributes,
  ): Promise<T> {
    const span = this.tracer.startSpan(`encryption.${operation}`, {
      attributes: {
        'encryption.operation': operation,
        ...attributes,
      },
    });

    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  }

  // Trace cache operations
  async traceCacheOperation<T>(
    operation: 'get' | 'set' | 'delete',
    key: string,
    fn: () => Promise<T>,
    attributes?: SpanAttributes,
  ): Promise<T> {
    const span = this.tracer.startSpan(`cache.${operation}`, {
      attributes: {
        'cache.operation': operation,
        'cache.key': key,
        ...attributes,
      },
    });

    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  }

  // Trace rate limiting
  async traceRateLimit(
    identifier: string,
    limit: number,
    fn: () => Promise<boolean>,
    attributes?: SpanAttributes,
  ): Promise<boolean> {
    const span = this.tracer.startSpan('rate_limit.check', {
      attributes: {
        'rate_limit.identifier': identifier,
        'rate_limit.limit': limit,
        ...attributes,
      },
    });

    try {
      const allowed = await fn();
      span.setAttributes({
        'rate_limit.allowed': allowed,
      });
      span.setStatus({ code: SpanStatusCode.OK });
      return allowed;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  }

  // Get current trace context
  getCurrentSpan(): Span | undefined {
    return trace.getActiveSpan();
  }

  // Inject trace context into headers
  injectTraceContext(headers: Record<string, string>): void {
    const currentSpan = this.getCurrentSpan();
    if (currentSpan) {
      // В production здесь должна быть инъекция в headers
      // trace.inject(context, trace.TraceFormat.HTTP_HEADERS, headers);
    }
  }

  // Extract trace context from headers
  extractTraceContext(headers: Record<string, string>): void {
    // В production здесь должно быть извлечение из headers
    // const context = trace.extract(trace.TraceFormat.HTTP_HEADERS, headers);
    // trace.setSpan(trace.getActive(), context);
  }
}
