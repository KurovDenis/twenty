import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { type User } from 'src/engine/core-modules/user/user.entity';
import { type Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthUser } from 'src/engine/decorators/auth/auth-user.decorator';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { BusinessSetupChatContinuationService } from '../chat-continuation/business-setup-chat-continuation.service';
import { BusinessSetupTransitionService } from '../chat-continuation/business-setup-transition.service';
import { ChatContinuationInput, BusinessSetupTransitionInput } from '../chat-continuation/dtos/chat-continuation.input';
import { BusinessSetupStatus } from '../enums/business-setup-status.enum';

@Resolver()
@UseGuards(JwtAuthGuard)
export class BusinessSetupChatResolver {
  constructor(
    private readonly chatContinuationService: BusinessSetupChatContinuationService,
    private readonly transitionService: BusinessSetupTransitionService,
  ) {}

  @Mutation(() => Boolean)
  async continueWelcomeChat(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Args('input') input: ChatContinuationInput,
  ): Promise<boolean> {
    const result = await this.chatContinuationService.continueWelcomeChat(
      user.id,
      workspace.id,
      input,
    );

    return result.success;
  }

  @Mutation(() => Boolean)
  async transitionToNextStep(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Args('input') input: BusinessSetupTransitionInput,
  ): Promise<boolean> {
    const result = await this.transitionService.transitionToNextStep(
      user.id,
      workspace.id,
      input,
    );

    return result.success;
  }

  @Query(() => BusinessSetupStatus, { nullable: true })
  async getNextBusinessSetupStep(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Args('currentStep') currentStep: BusinessSetupStatus,
  ): Promise<BusinessSetupStatus | null> {
    return await this.transitionService.getNextStep(
      currentStep,
      user.id,
      workspace.id,
    );
  }

  @Query(() => Boolean)
  async isReadyForNextBusinessSetupStep(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Args('currentStep') currentStep: BusinessSetupStatus,
  ): Promise<boolean> {
    const readiness = await this.transitionService.isReadyForNextStep(
      currentStep,
      user.id,
      workspace.id,
    );

    return readiness.ready;
  }

  @Query(() => String)
  async getBusinessSetupProgress(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ): Promise<string> {
    const progress = await this.transitionService.getBusinessSetupProgress(
      user.id,
      workspace.id,
    );

    return JSON.stringify(progress);
  }
}
