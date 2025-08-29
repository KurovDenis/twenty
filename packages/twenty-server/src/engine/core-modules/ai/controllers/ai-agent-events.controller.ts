/**
 * AI Agent Events Controller
 *
 * Provides REST API endpoints for frontend to poll AI agent events
 */

import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { User } from 'src/engine/core-modules/user/user.entity';
import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthUser } from 'src/engine/decorators/auth/auth-user.decorator';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';

import { AIAgentEventsService } from '../services/ai-agent-events.service';

export interface AIAgentEventResponse {
  type: string;
  payload: any;
  timestamp: string;
}

@Controller('ai-agent')
@UseGuards(JwtAuthGuard, WorkspaceAuthGuard)
export class AIAgentEventsController {
  constructor(private readonly aiAgentEventsService: AIAgentEventsService) {}

  /**
   * Get AI agent events for current user since specified timestamp
   */
  @Get('events')
  async getEvents(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Query('since') since?: string,
  ): Promise<AIAgentEventResponse[]> {
    const sinceDate = since ? new Date(since) : new Date(Date.now() - 60000); // Default: last 1 minute

    return this.aiAgentEventsService.getEventsForUser(
      user.id,
      workspace.id,
      sinceDate,
    );
  }

  /**
   * Test endpoint to simulate welcome chat creation
   */
  @Get('test/simulate-welcome')
  async simulateWelcomeChat(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ): Promise<{ message: string }> {
    await this.aiAgentEventsService.simulateWelcomeChatCreated(
      user.id,
      workspace.id,
    );

    return { message: 'Welcome chat simulation triggered' };
  }
}
