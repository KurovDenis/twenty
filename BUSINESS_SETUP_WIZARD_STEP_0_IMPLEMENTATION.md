# Business Setup Wizard - Шаг 0: Приветствие AI агента (WELCOME)

## 📋 Обзор

Этот документ содержит полные инструкции по реализации **Шага 0: Приветствие AI агента (WELCOME)** для Business Setup Wizard.

## 🎯 Цель

Создать приветственную страницу с AI агентом, который:
- Приветствует пользователя после завершения onboarding
- Объясняет процесс Business Setup
- Предоставляет возможность начать настройку с AI помощником
- Интегрируется с существующим FloatingAIChatButton

## 🏗️ Архитектура

### Backend
- `BusinessSetupStatus` enum
- `BusinessSetupService` для управления статусами
- `BusinessSetupResolver` для GraphQL операций
- Интеграция с существующими `UserVarsService` и `OnboardingService`

### Frontend
- `BusinessSetupWelcome` компонент (по аналогии с onboarding)
- Модификация существующего `FloatingAIChatButton`
- Хуки для управления состоянием
- Интеграция с AI чатом

## 📁 Структура файлов

```
packages/twenty-server/src/engine/core-modules/business-setup/
├── enums/
│   └── business-setup-status.enum.ts
├── business-setup.service.ts
├── business-setup.resolver.ts
└── business-setup.module.ts

packages/twenty-front/src/modules/business-setup/
├── hooks/
│   ├── useBusinessSetupStatus.ts
│   └── useSetNextBusinessSetupStatus.ts
├── graphql/
│   ├── queries.ts
│   └── mutations.ts
└── pages/
    └── BusinessSetupWelcome.tsx

packages/twenty-front/src/pages/business-setup/
└── BusinessSetupWelcome.tsx
```

---

## 🔧 Backend Реализация

### 1. Создать BusinessSetupStatus enum

**Файл:** `packages/twenty-server/src/engine/core-modules/business-setup/enums/business-setup-status.enum.ts`

```typescript
export enum BusinessSetupStatus {
  WELCOME = 'WELCOME',
  BUSINESS_ANALYSIS = 'BUSINESS_ANALYSIS',
  SALES_FUNNEL_DESIGN = 'SALES_FUNNEL_DESIGN',
  AGENT_SETUP = 'AGENT_SETUP',
  WORKFLOW_CREATION = 'WORKFLOW_CREATION',
  TEAM_ASSIGNMENT = 'TEAM_ASSIGNMENT',
  TESTING_OPTIMIZATION = 'TESTING_OPTIMIZATION',
  COMPLETED = 'COMPLETED',
}
```

### 2. Создать BusinessSetupService

**Файл:** `packages/twenty-server/src/engine/core-modules/business-setup/business-setup.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { UserVarsService } from 'src/engine/core-modules/user/user-vars/services/user-vars.service';
import { OnboardingService } from 'src/engine/core-modules/onboarding/onboarding.service';
import { BusinessSetupStatus } from './enums/business-setup-status.enum';
import { OnboardingStatus } from 'src/engine/core-modules/onboarding/enums/onboarding-status.enum';
import { type User } from 'src/engine/core-modules/user/user.entity';
import { type Workspace } from 'src/engine/core-modules/workspace/workspace.entity';

export enum BusinessSetupStepKeys {
  BUSINESS_SETUP_WELCOME_PENDING = 'BUSINESS_SETUP_WELCOME_PENDING',
  BUSINESS_SETUP_BUSINESS_ANALYSIS_PENDING = 'BUSINESS_SETUP_BUSINESS_ANALYSIS_PENDING',
  BUSINESS_SETUP_SALES_FUNNEL_DESIGN_PENDING = 'BUSINESS_SETUP_SALES_FUNNEL_DESIGN_PENDING',
  BUSINESS_SETUP_AGENT_SETUP_PENDING = 'BUSINESS_SETUP_AGENT_SETUP_PENDING',
  BUSINESS_SETUP_WORKFLOW_CREATION_PENDING = 'BUSINESS_SETUP_WORKFLOW_CREATION_PENDING',
  BUSINESS_SETUP_TEAM_ASSIGNMENT_PENDING = 'BUSINESS_SETUP_TEAM_ASSIGNMENT_PENDING',
  BUSINESS_SETUP_TESTING_OPTIMIZATION_PENDING = 'BUSINESS_SETUP_TESTING_OPTIMIZATION_PENDING',
}

export type BusinessSetupKeyValueTypeMap = {
  [BusinessSetupStepKeys.BUSINESS_SETUP_WELCOME_PENDING]: boolean;
  [BusinessSetupStepKeys.BUSINESS_SETUP_BUSINESS_ANALYSIS_PENDING]: boolean;
  [BusinessSetupStepKeys.BUSINESS_SETUP_SALES_FUNNEL_DESIGN_PENDING]: boolean;
  [BusinessSetupStepKeys.BUSINESS_SETUP_AGENT_SETUP_PENDING]: boolean;
  [BusinessSetupStepKeys.BUSINESS_SETUP_WORKFLOW_CREATION_PENDING]: boolean;
  [BusinessSetupStepKeys.BUSINESS_SETUP_TEAM_ASSIGNMENT_PENDING]: boolean;
  [BusinessSetupStepKeys.BUSINESS_SETUP_TESTING_OPTIMIZATION_PENDING]: boolean;
};

@Injectable()
export class BusinessSetupService {
  constructor(
    private readonly userVarsService: UserVarsService<BusinessSetupKeyValueTypeMap>,
    private readonly onboardingService: OnboardingService,
  ) {}

  async getBusinessSetupStatus(user: User, workspace: Workspace): Promise<BusinessSetupStatus> {
    // Проверяем завершен ли onboarding
    const onboardingStatus = await this.onboardingService.getOnboardingStatus(user, workspace);
    
    if (onboardingStatus !== OnboardingStatus.COMPLETED) {
      return BusinessSetupStatus.WELCOME;
    }

    // Получаем статус из UserVars
    const userVars = await this.userVarsService.getAll({
      userId: user.id,
      workspaceId: workspace.id,
    });

    const isWelcomePending = userVars.get(BusinessSetupStepKeys.BUSINESS_SETUP_WELCOME_PENDING) === true;
    const isBusinessAnalysisPending = userVars.get(BusinessSetupStepKeys.BUSINESS_SETUP_BUSINESS_ANALYSIS_PENDING) === true;
    const isSalesFunnelDesignPending = userVars.get(BusinessSetupStepKeys.BUSINESS_SETUP_SALES_FUNNEL_DESIGN_PENDING) === true;
    const isAgentSetupPending = userVars.get(BusinessSetupStepKeys.BUSINESS_SETUP_AGENT_SETUP_PENDING) === true;
    const isWorkflowCreationPending = userVars.get(BusinessSetupStepKeys.BUSINESS_SETUP_WORKFLOW_CREATION_PENDING) === true;
    const isTeamAssignmentPending = userVars.get(BusinessSetupStepKeys.BUSINESS_SETUP_TEAM_ASSIGNMENT_PENDING) === true;
    const isTestingOptimizationPending = userVars.get(BusinessSetupStepKeys.BUSINESS_SETUP_TESTING_OPTIMIZATION_PENDING) === true;

    if (isWelcomePending) {
      return BusinessSetupStatus.WELCOME;
    }

    if (isBusinessAnalysisPending) {
      return BusinessSetupStatus.BUSINESS_ANALYSIS;
    }

    if (isSalesFunnelDesignPending) {
      return BusinessSetupStatus.SALES_FUNNEL_DESIGN;
    }

    if (isAgentSetupPending) {
      return BusinessSetupStatus.AGENT_SETUP;
    }

    if (isWorkflowCreationPending) {
      return BusinessSetupStatus.WORKFLOW_CREATION;
    }

    if (isTeamAssignmentPending) {
      return BusinessSetupStatus.TEAM_ASSIGNMENT;
    }

    if (isTestingOptimizationPending) {
      return BusinessSetupStatus.TESTING_OPTIMIZATION;
    }

    return BusinessSetupStatus.COMPLETED;
  }

  async setBusinessSetupStatus(
    userId: string,
    workspaceId: string,
    status: BusinessSetupStatus,
  ): Promise<void> {
    // Очищаем все текущие статусы
    await this.clearAllBusinessSetupStatuses(userId, workspaceId);

    // Устанавливаем новый статус
    switch (status) {
      case BusinessSetupStatus.WELCOME:
        await this.userVarsService.set({
          userId,
          workspaceId,
          key: BusinessSetupStepKeys.BUSINESS_SETUP_WELCOME_PENDING,
          value: true,
        });
        break;
      case BusinessSetupStatus.BUSINESS_ANALYSIS:
        await this.userVarsService.set({
          userId,
          workspaceId,
          key: BusinessSetupStepKeys.BUSINESS_SETUP_BUSINESS_ANALYSIS_PENDING,
          value: true,
        });
        break;
      case BusinessSetupStatus.SALES_FUNNEL_DESIGN:
        await this.userVarsService.set({
          userId,
          workspaceId,
          key: BusinessSetupStepKeys.BUSINESS_SETUP_SALES_FUNNEL_DESIGN_PENDING,
          value: true,
        });
        break;
      case BusinessSetupStatus.AGENT_SETUP:
        await this.userVarsService.set({
          userId,
          workspaceId,
          key: BusinessSetupStepKeys.BUSINESS_SETUP_AGENT_SETUP_PENDING,
          value: true,
        });
        break;
      case BusinessSetupStatus.WORKFLOW_CREATION:
        await this.userVarsService.set({
          userId,
          workspaceId,
          key: BusinessSetupStepKeys.BUSINESS_SETUP_WORKFLOW_CREATION_PENDING,
          value: true,
        });
        break;
      case BusinessSetupStatus.TEAM_ASSIGNMENT:
        await this.userVarsService.set({
          userId,
          workspaceId,
          key: BusinessSetupStepKeys.BUSINESS_SETUP_TEAM_ASSIGNMENT_PENDING,
          value: true,
        });
        break;
      case BusinessSetupStatus.TESTING_OPTIMIZATION:
        await this.userVarsService.set({
          userId,
          workspaceId,
          key: BusinessSetupStepKeys.BUSINESS_SETUP_TESTING_OPTIMIZATION_PENDING,
          value: true,
        });
        break;
      case BusinessSetupStatus.COMPLETED:
        // Не устанавливаем никаких статусов - все завершено
        break;
    }
  }

  private async clearAllBusinessSetupStatuses(userId: string, workspaceId: string): Promise<void> {
    const keys = Object.values(BusinessSetupStepKeys);
    
    for (const key of keys) {
      await this.userVarsService.set({
        userId,
        workspaceId,
        key,
        value: false,
      });
    }
  }
}
```

### 3. Создать BusinessSetupResolver

**Файл:** `packages/twenty-server/src/engine/core-modules/business-setup/business-setup.resolver.ts`

```typescript
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AuthUser } from 'src/engine/core-modules/auth/decorators/auth-user.decorator';
import { AuthWorkspace } from 'src/engine/core-modules/auth/decorators/auth-workspace.decorator';
import { JwtAuthGuard } from 'src/engine/core-modules/auth/guards/jwt-auth.guard';
import { BusinessSetupService } from './business-setup.service';
import { BusinessSetupStatus } from './enums/business-setup-status.enum';
import { type User } from 'src/engine/core-modules/user/user.entity';
import { type Workspace } from 'src/engine/core-modules/workspace/workspace.entity';

@Resolver()
@UseGuards(JwtAuthGuard)
export class BusinessSetupResolver {
  constructor(private readonly businessSetupService: BusinessSetupService) {}

  @Query(() => BusinessSetupStatus)
  async getBusinessSetupStatus(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ): Promise<BusinessSetupStatus> {
    return await this.businessSetupService.getBusinessSetupStatus(user, workspace);
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
```

### 4. Создать BusinessSetupModule

**Файл:** `packages/twenty-server/src/engine/core-modules/business-setup/business-setup.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { BusinessSetupService } from './business-setup.service';
import { BusinessSetupResolver } from './business-setup.resolver';
import { UserVarsModule } from '../user/user-vars/user-vars.module';
import { OnboardingModule } from '../onboarding/onboarding.module';

@Module({
  imports: [UserVarsModule, OnboardingModule],
  providers: [BusinessSetupService, BusinessSetupResolver],
  exports: [BusinessSetupService],
})
export class BusinessSetupModule {}
```

### 5. Добавить поле в User entity

**Файл:** `packages/twenty-server/src/engine/core-modules/user/user.entity.ts`

```typescript
// Добавить импорт
import { BusinessSetupStatus } from 'src/engine/core-modules/business-setup/enums/business-setup-status.enum';

// Добавить в класс User
@Field(() => BusinessSetupStatus, { nullable: true })
businessSetupStatus: BusinessSetupStatus;
```

### 6. Модифицировать UserResolver

**Файл:** `packages/twenty-server/src/engine/core-modules/user/user.resolver.ts`

```typescript
// Добавить импорт
import { BusinessSetupService } from '../business-setup/business-setup.service';

// Добавить в конструктор
constructor(
  // ... существующие зависимости
  private readonly businessSetupService: BusinessSetupService,
) {}

// Добавить resolve field
@ResolveField(() => BusinessSetupStatus, {
  nullable: true,
})
async businessSetupStatus(
  @Parent() user: User,
  @AuthWorkspace({ allowUndefined: true }) workspace: Workspace | undefined,
): Promise<BusinessSetupStatus | null> {
  if (!workspace) return null;
  return this.businessSetupService.getBusinessSetupStatus(user, workspace);
}
```

---

## 🎨 Frontend Реализация

### 1. Создать GraphQL queries и mutations

**Файл:** `packages/twenty-front/src/modules/business-setup/graphql/queries.ts`

```typescript
import { gql } from '@apollo/client';

export const GET_BUSINESS_SETUP_STATUS = gql`
  query GetBusinessSetupStatus {
    getBusinessSetupStatus
  }
`;
```

**Файл:** `packages/twenty-front/src/modules/business-setup/graphql/mutations.ts`

```typescript
import { gql } from '@apollo/client';

export const SET_BUSINESS_SETUP_STATUS = gql`
  mutation SetBusinessSetupStatus($status: BusinessSetupStatus!) {
    setBusinessSetupStatus(status: $status)
  }
`;
```

### 2. Создать хуки

**Файл:** `packages/twenty-front/src/modules/business-setup/hooks/useBusinessSetupStatus.ts`

```typescript
import { useRecoilValue } from 'recoil';
import { useIsLogged } from '@/auth/hooks/useIsLogged';
import { currentUserState } from '@/auth/states/currentUserState';
import { BusinessSetupStatus } from '~/generated/graphql';

export const useBusinessSetupStatus = (): BusinessSetupStatus | null | undefined => {
  const currentUser = useRecoilValue(currentUserState);
  const isLoggedIn = useIsLogged();
  return isLoggedIn ? currentUser?.businessSetupStatus : undefined;
};
```

**Файл:** `packages/twenty-front/src/modules/business-setup/hooks/useSetNextBusinessSetupStatus.ts`

```typescript
import { useCallback } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { currentUserState } from '@/auth/states/currentUserState';
import { BusinessSetupStatus } from '~/generated/graphql';
import { useSetBusinessSetupStatusMutation } from '~/generated-metadata/graphql';

export const useSetNextBusinessSetupStatus = () => {
  const [setBusinessSetupStatus] = useSetBusinessSetupStatusMutation();
  const setCurrentUser = useSetRecoilState(currentUserState);
  const currentUser = useRecoilValue(currentUserState);

  const setNextBusinessSetupStatus = useCallback(async () => {
    if (!currentUser) return;

    const nextStatus = getNextBusinessSetupStatus(currentUser.businessSetupStatus);

    if (nextStatus && nextStatus !== currentUser.businessSetupStatus) {
      try {
        await setBusinessSetupStatus({
          variables: { status: nextStatus },
        });

        // Обновляем локальное состояние
        setCurrentUser((prev) => 
          prev ? { ...prev, businessSetupStatus: nextStatus } : null
        );
      } catch (error) {
        console.error('Failed to set next business setup status:', error);
      }
    }
  }, [currentUser, setBusinessSetupStatus, setCurrentUser]);

  return { setNextBusinessSetupStatus };
};

const getNextBusinessSetupStatus = (currentStatus: BusinessSetupStatus | null | undefined): BusinessSetupStatus | null => {
  if (!currentStatus) return null;

  switch (currentStatus) {
    case BusinessSetupStatus.WELCOME:
      return BusinessSetupStatus.BUSINESS_ANALYSIS;
    case BusinessSetupStatus.BUSINESS_ANALYSIS:
      return BusinessSetupStatus.SALES_FUNNEL_DESIGN;
    case BusinessSetupStatus.SALES_FUNNEL_DESIGN:
      return BusinessSetupStatus.AGENT_SETUP;
    case BusinessSetupStatus.AGENT_SETUP:
      return BusinessSetupStatus.WORKFLOW_CREATION;
    case BusinessSetupStatus.WORKFLOW_CREATION:
      return BusinessSetupStatus.TEAM_ASSIGNMENT;
    case BusinessSetupStatus.TEAM_ASSIGNMENT:
      return BusinessSetupStatus.TESTING_OPTIMIZATION;
    case BusinessSetupStatus.TESTING_OPTIMIZATION:
      return BusinessSetupStatus.COMPLETED;
    default:
      return null;
  }
};
```

### 3. Создать BusinessSetupWelcome компонент

**Файл:** `packages/twenty-front/src/pages/business-setup/BusinessSetupWelcome.tsx`

```typescript
import { SubTitle } from '@/auth/components/SubTitle';
import { Title } from '@/auth/components/Title';
import { useSetNextBusinessSetupStatus } from '@/business-setup/hooks/useSetNextBusinessSetupStatus';
import { useOpenAskAIPageInCommandMenu } from '@/command-menu/hooks/useOpenAskAIPageInCommandMenu';
import { AppPath } from '@/types/AppPath';
import { Modal } from '@/ui/layout/modal/components/Modal';
import styled from '@emotion/styled';
import { Trans, useLingui } from '@lingui/react/macro';
import { useNavigate } from 'react-router-dom';
import { LightButton, MainButton } from 'twenty-ui/input';
import { IconSparkles } from 'twenty-ui/display';

const StyledModalContent = styled(Modal.Content)`
  gap: ${({ theme }) => theme.spacing(8)};
`;

const StyledTitleContainer = styled.div`
  align-items: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
  text-align: center;
`;

const StyledButtonContainer = styled.div`
  align-items: center;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(4)};
  width: 100%;
`;

const StyledIconContainer = styled.div`
  display: flex;
  justify-content: center;
  margin-bottom: ${({ theme }) => theme.spacing(4)};
`;

const StyledFeaturesList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  margin: ${({ theme }) => theme.spacing(4)} 0;
  text-align: left;
`;

const StyledFeatureItem = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  color: ${({ theme }) => theme.font.color.secondary};
`;

export const BusinessSetupWelcome = () => {
  const { t } = useLingui();
  const navigate = useNavigate();
  const { setNextBusinessSetupStatus } = useSetNextBusinessSetupStatus();
  const { openAskAIPage } = useOpenAskAIPageInCommandMenu();

  const handleStartWithAI = () => {
    openAskAIPage({
      initialMessage: "I'm ready to help you set up your business automation! Let's get started.",
      context: {
        businessSetupMode: true,
        step: 'WELCOME',
        agentType: 'BUSINESS_SETUP_WELCOME',
      },
    });
  };

  const handleSkipWelcome = async () => {
    await setNextBusinessSetupStatus();
    navigate(AppPath.BusinessAnalysis);
  };

  return (
    <StyledModalContent isVerticalCentered isHorizontalCentered>
      <StyledTitleContainer>
        <StyledIconContainer>
          <IconSparkles size={48} />
        </StyledIconContainer>
        <Title noMarginTop>
          <Trans>Welcome to Business Setup Wizard!</Trans>
        </Title>
        <SubTitle>
          <Trans>
            Let's create your fully automated business system together. 
            I'll help you analyze your business, design sales funnels, 
            set up AI agents, and create automated workflows.
          </Trans>
        </SubTitle>
        
        <StyledFeaturesList>
          <StyledFeatureItem>
            <IconSparkles size={16} />
            <span>🚀 Business Analysis - Analyze your industry and processes</span>
          </StyledFeatureItem>
          <StyledFeatureItem>
            <IconSparkles size={16} />
            <span>🎯 Sales Funnel Design - Create perfect conversion funnels</span>
          </StyledFeatureItem>
          <StyledFeatureItem>
            <IconSparkles size={16} />
            <span>🤖 AI Agent Setup - Build specialized AI agents</span>
          </StyledFeatureItem>
          <StyledFeatureItem>
            <IconSparkles size={16} />
            <span>⚡ Workflow Automation - Design automated workflows</span>
          </StyledFeatureItem>
          <StyledFeatureItem>
            <IconSparkles size={16} />
            <span>👥 Team Assignment - Set up roles and permissions</span>
          </StyledFeatureItem>
          <StyledFeatureItem>
            <IconSparkles size={16} />
            <span>🧪 Testing & Optimization - Ensure everything works perfectly</span>
          </StyledFeatureItem>
        </StyledFeaturesList>
      </StyledTitleContainer>
      
      <StyledButtonContainer>
        <MainButton 
          title={t`Start with AI Assistant`} 
          onClick={handleStartWithAI}
          Icon={IconSparkles}
          width={250}
        />
        <LightButton 
          title={t`Skip Welcome`} 
          onClick={handleSkipWelcome}
        />
      </StyledButtonContainer>
    </StyledModalContent>
  );
};
```

### 4. Модифицировать FloatingAIChatButton

**Файл:** `packages/twenty-front/src/modules/ai/hooks/useFloatingAIChatButton.ts`

```typescript
import { useRecoilValue } from 'recoil';
import { useOpenAskAIPageInCommandMenu } from '@/command-menu/hooks/useOpenAskAIPageInCommandMenu';
import { useIsFeatureEnabled } from '@/workspace/hooks/useIsFeatureEnabled';
import { isCommandMenuOpenedState } from '@/command-menu/states/isCommandMenuOpenedState';
import { commandMenuPageState } from '@/command-menu/states/commandMenuPageState';
import { CommandMenuPages } from '@/command-menu/types/CommandMenuPages';
import { FeatureFlagKey } from '~/generated/graphql';
import { isFloatingAIChatButtonVisibleState } from '../states/isFloatingAIChatButtonVisibleState';
import { useBusinessSetupStatus } from '@/business-setup/hooks/useBusinessSetupStatus';
import { BusinessSetupStatus } from '~/generated/graphql';

export const useFloatingAIChatButton = () => {
  const isAiEnabled = useIsFeatureEnabled(FeatureFlagKey.IS_AI_ENABLED);
  const isVisible = useRecoilValue(isFloatingAIChatButtonVisibleState);
  const isCommandMenuOpened = useRecoilValue(isCommandMenuOpenedState);
  const commandMenuPage = useRecoilValue(commandMenuPageState);
  const businessSetupStatus = useBusinessSetupStatus();
  const { openAskAIPage } = useOpenAskAIPageInCommandMenu();

  // Проверяем, открыт ли AI чат
  const isAIChatOpen = isCommandMenuOpened && 
    (commandMenuPage === CommandMenuPages.AskAI || 
     commandMenuPage === CommandMenuPages.ViewPreviousAIChats);

  const handleClick = () => {
    // Если мы в Business Setup режиме, открываем специальный чат
    if (businessSetupStatus === BusinessSetupStatus.WELCOME) {
      openAskAIPage({
        initialMessage: "I'm ready to help you set up your business automation! Let's get started.",
        context: {
          businessSetupMode: true,
          step: 'WELCOME',
          agentType: 'BUSINESS_SETUP_WELCOME',
        },
      });
    } else {
      openAskAIPage();
    }
  };

  return {
    isVisible: isVisible && isAiEnabled && !isAIChatOpen,
    handleClick,
    businessSetupStatus,
  };
};
```

**Файл:** `packages/twenty-front/src/modules/ai/components/FloatingAIChatButton/FloatingAIChatButton.tsx`

```typescript
import { useTheme } from '@emotion/react';
import { useState } from 'react';
import { t } from '@lingui/core/macro';
import { IconSparkles } from 'twenty-ui/display';
import { FloatingIconButton } from 'twenty-ui/input';
import { useIsMobile } from 'twenty-ui/utilities';
import { useFloatingAIChatButton } from '../../hooks/useFloatingAIChatButton';
import { BusinessSetupStatus } from '~/generated/graphql';
import {
  StyledFloatingAIChatButton,
  StyledFloatingAIChatButtonContainer,
  StyledTooltip,
} from './FloatingAIChatButton.styles';

export const FloatingAIChatButton = () => {
  const theme = useTheme();
  const isMobile = useIsMobile();
  const { isVisible, handleClick, businessSetupStatus } = useFloatingAIChatButton();
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);

  const isBusinessSetupWelcome = businessSetupStatus === BusinessSetupStatus.WELCOME;

  return (
    <StyledFloatingAIChatButtonContainer
      data-testid="floating-ai-chat-button"
      className={isBusinessSetupWelcome ? 'business-setup-welcome-mode' : ''}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'scale(1)' : 'scale(0.8)',
        pointerEvents: isVisible ? 'auto' : 'none',
      }}
    >
      <StyledFloatingAIChatButton
        onMouseEnter={() => setIsTooltipVisible(true)}
        onMouseLeave={() => setIsTooltipVisible(false)}
      >
        <FloatingIconButton
          Icon={IconSparkles}
          size={isMobile ? 'small' : 'medium'}
          position="standalone"
          applyShadow={true}
          applyBlur={true}
          onClick={handleClick}
          className={isBusinessSetupWelcome ? 'business-setup-welcome-pulse' : ''}
        />
        <StyledTooltip
          style={{
            opacity: isTooltipVisible ? 1 : 0,
            transform: isTooltipVisible ? 'translateY(0)' : 'translateY(4px)',
          }}
        >
          {isBusinessSetupWelcome 
            ? t`Start Business Setup with AI` 
            : t`Ask AI (Press @)`
          }
        </StyledTooltip>
      </StyledFloatingAIChatButton>
    </StyledFloatingAIChatButtonContainer>
  );
};
```

### 5. Добавить стили для Business Setup анимации

**Файл:** `packages/twenty-front/src/modules/ai/components/FloatingAIChatButton/FloatingAIChatButton.styles.ts`

```typescript
// Добавить к существующим стилям:

export const StyledFloatingAIChatButtonContainer = styled.div`
  // ... существующие стили ...

  &.business-setup-welcome-mode {
    animation: businessSetupWelcomePulse 2s ease-in-out infinite;
  }

  @keyframes businessSetupWelcomePulse {
    0%, 100% {
      transform: scale(1);
      box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
    }
    50% {
      transform: scale(1.05);
      box-shadow: 0 6px 20px rgba(34, 197, 94, 0.5);
    }
  }

  .business-setup-welcome-pulse {
    background-color: ${({ theme }) => theme.color.green} !important;
    color: ${({ theme }) => theme.font.color.inverted} !important;
  }
`;
```

### 6. Добавить роутинг

**Файл:** `packages/twenty-front/src/types/AppPath.ts`

```typescript
// Добавить новые пути
export enum AppPath {
  // ... существующие пути ...
  BusinessSetupWelcome = '/business-setup/welcome',
  BusinessAnalysis = '/business-setup/analysis',
  SalesFunnelDesign = '/business-setup/funnel-design',
  AgentSetup = '/business-setup/agent-setup',
  WorkflowCreation = '/business-setup/workflow-creation',
  TeamAssignment = '/business-setup/team-assignment',
  TestingOptimization = '/business-setup/testing-optimization',
  BusinessSetupCompleted = '/business-setup/completed',
}
```

**Файл:** `packages/twenty-front/src/modules/business-setup/routes.tsx`

```typescript
import { Route } from 'react-router-dom';
import { AppPath } from '@/types/AppPath';
import { BusinessSetupWelcome } from '@/pages/business-setup/BusinessSetupWelcome';

export const BusinessSetupRoutes = () => (
  <>
    <Route path={AppPath.BusinessSetupWelcome} element={<BusinessSetupWelcome />} />
    {/* Другие маршруты будут добавлены позже */}
  </>
);
```

### 7. Добавить в основной роутер

**Файл:** `packages/twenty-front/src/modules/router/components/AppRouter.tsx`

```typescript
// Добавить импорт
import { BusinessSetupRoutes } from '@/business-setup/routes';

// Добавить в роутер
<BusinessSetupRoutes />
```

---

## 🔗 Интеграция с существующими системами

### 1. Модифицировать OnboardingService

**Файл:** `packages/twenty-server/src/engine/core-modules/onboarding/onboarding.service.ts`

```typescript
// Добавить в метод getOnboardingStatus
async getOnboardingStatus(user: User, workspace: Workspace) {
  // ... существующая логика ...

  if (onboardingStatus === OnboardingStatus.COMPLETED) {
    // Проверяем Business Setup статус
    const businessSetupStatus = await this.businessSetupService.getBusinessSetupStatus(user, workspace);
    if (businessSetupStatus === BusinessSetupStatus.WELCOME) {
      // Показываем Business Setup Welcome
      return OnboardingStatus.COMPLETED; // Оставляем как есть, но добавляем businessSetupStatus
    }
  }

  return onboardingStatus;
}
```

### 2. Добавить в AppModule

**Файл:** `packages/twenty-server/src/engine/core-modules/app.module.ts`

```typescript
// Добавить импорт
import { BusinessSetupModule } from './business-setup/business-setup.module';

// Добавить в imports
@Module({
  imports: [
    // ... существующие модули ...
    BusinessSetupModule,
  ],
  // ...
})
export class AppModule {}
```

---

## 🧪 Тестирование

### 1. Unit тесты для BusinessSetupService

**Файл:** `packages/twenty-server/src/engine/core-modules/business-setup/business-setup.service.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { BusinessSetupService } from './business-setup.service';
import { UserVarsService } from '../user/user-vars/services/user-vars.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import { BusinessSetupStatus } from './enums/business-setup-status.enum';
import { OnboardingStatus } from '../onboarding/enums/onboarding-status.enum';

describe('BusinessSetupService', () => {
  let service: BusinessSetupService;
  let mockUserVarsService: jest.Mocked<UserVarsService>;
  let mockOnboardingService: jest.Mocked<OnboardingService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessSetupService,
        {
          provide: UserVarsService,
          useValue: {
            getAll: jest.fn(),
            set: jest.fn(),
          },
        },
        {
          provide: OnboardingService,
          useValue: {
            getOnboardingStatus: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BusinessSetupService>(BusinessSetupService);
    mockUserVarsService = module.get(UserVarsService);
    mockOnboardingService = module.get(OnboardingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getBusinessSetupStatus', () => {
    it('should return WELCOME when onboarding is not completed', async () => {
      const user = { id: 'user-1' } as any;
      const workspace = { id: 'workspace-1' } as any;

      mockOnboardingService.getOnboardingStatus.mockResolvedValue(OnboardingStatus.PROFILE_CREATION);

      const result = await service.getBusinessSetupStatus(user, workspace);

      expect(result).toBe(BusinessSetupStatus.WELCOME);
    });

    it('should return WELCOME when welcome is pending', async () => {
      const user = { id: 'user-1' } as any;
      const workspace = { id: 'workspace-1' } as any;

      mockOnboardingService.getOnboardingStatus.mockResolvedValue(OnboardingStatus.COMPLETED);
      mockUserVarsService.getAll.mockResolvedValue(
        new Map([['BUSINESS_SETUP_WELCOME_PENDING', true]])
      );

      const result = await service.getBusinessSetupStatus(user, workspace);

      expect(result).toBe(BusinessSetupStatus.WELCOME);
    });
  });
});
```

### 2. E2E тесты

**Файл:** `packages/twenty-e2e-testing/tests/business-setup-welcome.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Business Setup Welcome', () => {
  test('should show welcome page after onboarding completion', async ({ page }) => {
    // Логин и завершение onboarding
    await page.goto('/');
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="sign-in-button"]');

    // Завершаем onboarding
    // ... логика завершения onboarding ...

    // Проверяем, что показывается Business Setup Welcome
    await expect(page).toHaveURL('/business-setup/welcome');
    await expect(page.locator('text=Welcome to Business Setup Wizard!')).toBeVisible();
  });

  test('should open AI chat when clicking Start with AI Assistant', async ({ page }) => {
    await page.goto('/business-setup/welcome');
    
    await page.click('text=Start with AI Assistant');
    
    // Проверяем, что открылся AI чат
    await expect(page.locator('[data-testid="ai-chat"]')).toBeVisible();
  });

  test('should show pulsing floating AI button in welcome mode', async ({ page }) => {
    await page.goto('/business-setup/welcome');
    
    const floatingButton = page.locator('[data-testid="floating-ai-chat-button"]');
    await expect(floatingButton).toBeVisible();
    await expect(floatingButton).toHaveClass(/business-setup-welcome-mode/);
  });
});
```

---

## 📋 Чек-лист реализации

### Backend
- [ ] Создать `BusinessSetupStatus` enum
- [ ] Создать `BusinessSetupService`
- [ ] Создать `BusinessSetupResolver`
- [ ] Создать `BusinessSetupModule`
- [ ] Добавить поле `businessSetupStatus` в `User` entity
- [ ] Модифицировать `UserResolver`
- [ ] Добавить `BusinessSetupModule` в `AppModule`

### Frontend
- [ ] Создать GraphQL queries и mutations
- [ ] Создать `useBusinessSetupStatus` хук
- [ ] Создать `useSetNextBusinessSetupStatus` хук
- [ ] Создать `BusinessSetupWelcome` компонент
- [ ] Модифицировать `useFloatingAIChatButton`
- [ ] Модифицировать `FloatingAIChatButton` компонент
- [ ] Добавить стили для Business Setup анимации
- [ ] Добавить новые пути в `AppPath`
- [ ] Создать `BusinessSetupRoutes`
- [ ] Добавить роуты в основной роутер

### Интеграция
- [ ] Модифицировать `OnboardingService`
- [ ] Протестировать переходы между статусами
- [ ] Протестировать интеграцию с AI чатом

### Тестирование
- [ ] Написать unit тесты для `BusinessSetupService`
- [ ] Написать E2E тесты для welcome страницы
- [ ] Протестировать анимации и стили

---

## 🚀 Запуск и тестирование

### 1. Запуск backend
```bash
cd packages/twenty-server
npm run start:dev
```

### 2. Запуск frontend
```bash
cd packages/twenty-front
npm run start
```

### 3. Тестирование
```bash
# Backend тесты
cd packages/twenty-server
npm run test business-setup.service.spec.ts

# Frontend тесты
cd packages/twenty-front
npm run test

# E2E тесты
cd packages/twenty-e2e-testing
npm run test business-setup-welcome.spec.ts
```

---

## 🎯 Результат

После реализации Шага 0 у вас будет:

✅ **Приветственная страница** с объяснением Business Setup процесса  
✅ **Интеграция с AI чатом** через существующий FloatingAIChatButton  
✅ **Автоматические переходы** между статусами  
✅ **Пульсирующая анимация** кнопки в Business Setup режиме  
✅ **Полная интеграция** с существующими системами onboarding и AI  

**Время реализации:** 5-7 дней  
**Сложность:** Средняя  
**Зависимости:** Существующие AI и onboarding системы  

---

## 📚 Дополнительные ресурсы

- [Onboarding компоненты](../pages/onboarding/) - примеры для создания welcome страниц
- [FloatingAIChatButton](../modules/ai/components/FloatingAIChatButton/) - существующая AI кнопка
- [UserVarsService](../core-modules/user/user-vars/) - система хранения состояний
- [GraphQL resolvers](../core-modules/) - примеры создания resolvers
