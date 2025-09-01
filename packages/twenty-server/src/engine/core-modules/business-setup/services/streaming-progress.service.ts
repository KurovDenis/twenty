import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { Subject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ProgressUpdate {
  operationId: string;
  status: 'started' | 'in_progress' | 'completed' | 'failed';
  step: string;
  progress: number; // 0-100
  message: string;
  timestamp: Date;
  metadata?: {
    stepNumber?: number;
    totalSteps?: number;
    agentType?: string;
    providerName?: string;
  };
}

export interface MessageEvent {
  data: string;
  type?: string;
  id?: string;
  retry?: number;
}

/**
 * Service for streaming real-time progress updates during Supervisor operations
 * Uses Server-Sent Events (SSE) to provide immediate feedback to users
 */
@Injectable()
export class StreamingProgressService {
  private readonly logger = new Logger(StreamingProgressService.name);
  private readonly progressSubjects = new Map<
    string,
    Subject<ProgressUpdate>
  >();

  constructor(private readonly eventEmitter: EventEmitter2) {
    // Listen for global progress events
    this.eventEmitter.on(
      'progress.update',
      this.handleProgressEvent.bind(this),
    );
    this.eventEmitter.on(
      'supervisor.progress',
      this.handleSupervisorProgress.bind(this),
    );
  }

  /**
   * Create a new progress stream for an operation
   */
  createProgressStream(operationId: string): Observable<MessageEvent> {
    this.logger.log(`Creating progress stream for operation: ${operationId}`);

    if (!this.progressSubjects.has(operationId)) {
      this.progressSubjects.set(operationId, new Subject<ProgressUpdate>());
    }

    const subject = this.progressSubjects.get(operationId)!;

    return subject.asObservable().pipe(
      map(
        (update: ProgressUpdate): MessageEvent => ({
          data: JSON.stringify(update),
          type: 'progress',
          id: `${operationId}-${Date.now()}`,
        }),
      ),
    );
  }

  /**
   * Send progress update for a specific operation
   */
  sendProgress(
    operationId: string,
    update: Omit<ProgressUpdate, 'operationId' | 'timestamp'>,
  ): void {
    const subject = this.progressSubjects.get(operationId);

    if (!subject) {
      this.logger.warn(
        `No progress stream found for operation: ${operationId}`,
      );

      return;
    }

    const progressUpdate: ProgressUpdate = {
      ...update,
      operationId,
      timestamp: new Date(),
    };

    this.logger.debug(
      `Sending progress update for ${operationId}:`,
      progressUpdate,
    );
    subject.next(progressUpdate);

    // Emit event for other services to listen
    this.eventEmitter.emit('progress.sent', progressUpdate);

    // Auto-cleanup completed/failed operations after 30 seconds
    if (update.status === 'completed' || update.status === 'failed') {
      setTimeout(() => {
        this.cleanupOperation(operationId);
      }, 30000);
    }
  }

  /**
   * Start a new operation with initial progress
   */
  startOperation(
    operationId: string,
    description: string,
    totalSteps?: number,
  ): void {
    this.sendProgress(operationId, {
      status: 'started',
      step: 'Initializing',
      progress: 0,
      message: description,
      metadata: { totalSteps, stepNumber: 0 },
    });
  }

  /**
   * Update operation progress
   */
  updateProgress(
    operationId: string,
    step: string,
    progress: number,
    message: string,
    metadata?: ProgressUpdate['metadata'],
  ): void {
    this.sendProgress(operationId, {
      status: 'in_progress',
      step,
      progress,
      message,
      metadata,
    });
  }

  /**
   * Complete an operation successfully
   */
  completeOperation(operationId: string, finalMessage: string): void {
    this.sendProgress(operationId, {
      status: 'completed',
      step: 'Completed',
      progress: 100,
      message: finalMessage,
    });
  }

  /**
   * Mark operation as failed
   */
  failOperation(operationId: string, errorMessage: string): void {
    this.sendProgress(operationId, {
      status: 'failed',
      step: 'Failed',
      progress: 0,
      message: errorMessage,
    });
  }

  /**
   * Cleanup operation resources
   */
  cleanupOperation(operationId: string): void {
    const subject = this.progressSubjects.get(operationId);

    if (subject) {
      subject.complete();
      this.progressSubjects.delete(operationId);
      this.logger.debug(
        `Cleaned up progress stream for operation: ${operationId}`,
      );
    }
  }

  /**
   * Handle global progress events
   */
  private handleProgressEvent(event: ProgressUpdate): void {
    // Forward events to specific operation streams
    this.sendProgress(event.operationId, event);
  }

  /**
   * Handle Supervisor-specific progress events
   */
  private handleSupervisorProgress(event: {
    operationId: string;
    stage: string;
    message: string;
    progress?: number;
  }): void {
    this.updateProgress(
      event.operationId,
      event.stage,
      event.progress || 50,
      event.message,
      { agentType: 'supervisor' },
    );
  }

  /**
   * Get active operations count for monitoring
   */
  getActiveOperationsCount(): number {
    return this.progressSubjects.size;
  }

  /**
   * Get all active operation IDs
   */
  getActiveOperationIds(): string[] {
    return Array.from(this.progressSubjects.keys());
  }
}
