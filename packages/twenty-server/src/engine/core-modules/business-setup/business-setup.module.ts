import { Module } from '@nestjs/common';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';
import { TokenModule } from '../auth/token/token.module';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { UserVarsModule } from '../user/user-vars/user-vars.module';
import { BusinessSetupResolver } from './business-setup.resolver';
import { BusinessSetupService } from './business-setup.service';

@Module({
  imports: [
    UserVarsModule, 
    OnboardingModule, 
    TokenModule, 
    WorkspaceCacheStorageModule
  ],
  providers: [BusinessSetupService, BusinessSetupResolver],
  exports: [BusinessSetupService],
})
export class BusinessSetupModule {}
