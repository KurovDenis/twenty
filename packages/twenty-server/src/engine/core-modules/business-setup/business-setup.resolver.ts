import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { type User } from 'src/engine/core-modules/user/user.entity';
import { type Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthUser } from 'src/engine/decorators/auth/auth-user.decorator';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';

import { BusinessSetupService } from './business-setup.service';

import { BusinessSetupStatus } from './enums/business-setup-status.enum';

@Resolver()
@UseGuards(JwtAuthGuard)
export class BusinessSetupResolver {
  constructor(private readonly businessSetupService: BusinessSetupService) {}

  @Query(() => BusinessSetupStatus)
  async getBusinessSetupStatus(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ): Promise<BusinessSetupStatus> {
    return await this.businessSetupService.getBusinessSetupStatus(
      user,
      workspace,
    );
  }

  @Mutation(() => Boolean)
  async setBusinessSetupStatus(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Args('status') status: BusinessSetupStatus,
  ): Promise<boolean> {
    await this.businessSetupService.setBusinessSetupStatus(
      user.id,
      workspace.id,
      status,
    );

    return true;
  }
}
