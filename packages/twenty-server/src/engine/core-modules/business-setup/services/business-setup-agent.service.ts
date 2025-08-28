import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { UserWorkspace } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { AgentEntity } from 'src/engine/metadata-modules/agent/agent.entity';
import { AgentService } from 'src/engine/metadata-modules/agent/agent.service';
import { BusinessSetupStatus } from '../enums/business-setup-status.enum';

@Injectable()
export class BusinessSetupAgentService {
  private readonly logger = new Logger(BusinessSetupAgentService.name);

  constructor(
    @InjectRepository(AgentEntity, 'core')
    private readonly agentRepository: Repository<AgentEntity>,
    @InjectRepository(UserWorkspace, 'core')
    private readonly userWorkspaceRepository: Repository<UserWorkspace>,
    private readonly agentService: AgentService,
  ) {}

  async getAgentForStep(
    step: BusinessSetupStatus,
    userWorkspaceId: string,
  ): Promise<AgentEntity> {
    // For WELCOME status, ALWAYS use the specific SGR Avito Agent
    if (step === BusinessSetupStatus.WELCOME) {
      const SGR_AVITO_AGENT_ID = '2f851163-c7ea-4eae-b960-13f019b256e3';
      
      // Try to find the existing SGR Avito agent
      const actualWorkspaceId = await this.resolveWorkspaceId(userWorkspaceId);
      
      let sgrAgent = await this.agentRepository.findOne({
        where: { id: SGR_AVITO_AGENT_ID, workspaceId: actualWorkspaceId },
      });
      
      if (!sgrAgent) {
        // Create the SGR Avito agent if it doesn't exist
        this.logger.log(`Creating SGR Avito Agent for WELCOME step in workspace ${actualWorkspaceId}`);
        sgrAgent = await this.createSGRAvitoAgent(actualWorkspaceId);
      }
      
      return sgrAgent;
    }
    const agentMapping: Record<Exclude<BusinessSetupStatus, BusinessSetupStatus.COMPLETED>, string> = {
      [BusinessSetupStatus.WELCOME]: 'welcome-agent',
      [BusinessSetupStatus.BUSINESS_ANALYSIS]: 'business-analysis-agent',
      [BusinessSetupStatus.SALES_FUNNEL_DESIGN]: 'funnel-designer-agent',
      [BusinessSetupStatus.AGENT_SETUP]: 'agent-orchestrator-agent',
      [BusinessSetupStatus.WORKFLOW_CREATION]: 'workflow-generator-agent',
      [BusinessSetupStatus.TEAM_ASSIGNMENT]: 'team-assignment-agent',
      [BusinessSetupStatus.TESTING_OPTIMIZATION]: 'testing-optimization-agent',
    };

    // Handle COMPLETED status - throw error as no agent is needed
    if (step === BusinessSetupStatus.COMPLETED) {
      throw new Error('No agent needed for COMPLETED status');
    }

    const agentName = agentMapping[step];
    if (!agentName) {
      throw new Error(`No agent mapping for step: ${step}`);
    }

    // Resolve actual workspace ID from userWorkspace
    const actualWorkspaceId = await this.resolveWorkspaceId(userWorkspaceId);

    // Look for existing agent
    let agent = await this.agentRepository.findOne({
      where: { name: agentName, workspaceId: actualWorkspaceId },
    });

    // Create agent if it doesn't exist
    if (!agent) {
      this.logger.log(`Creating agent for step ${step} in workspace ${actualWorkspaceId}`);
      agent = await this.createAgentForStep(step, actualWorkspaceId);
    }

    return agent;
  }

  private async resolveWorkspaceId(userWorkspaceId: string): Promise<string> {
    const userWorkspace = await this.userWorkspaceRepository.findOne({
      where: { id: userWorkspaceId },
      select: ['id', 'workspaceId'],
    });

    if (!userWorkspace) {
      throw new Error(`UserWorkspace with ID ${userWorkspaceId} not found`);
    }

    return userWorkspace.workspaceId;
  }

  private async createAgentForStep(
    step: BusinessSetupStatus,
    workspaceId: string,
  ): Promise<AgentEntity> {
    // Handle COMPLETED status - should not reach here
    if (step === BusinessSetupStatus.COMPLETED) {
      throw new Error('Cannot create agent for COMPLETED status');
    }

    const agentConfigs: Record<Exclude<BusinessSetupStatus, BusinessSetupStatus.COMPLETED>, {
      name: string;
      label: string;
      description: string;
      prompt: string;
      modelId: 'google/gemini-2.5-flash' | 'auto';
      isCustom: boolean;
    }> = {
      [BusinessSetupStatus.WELCOME]: {
        name: 'welcome-agent',
        label: 'Welcome AI Assistant',
        description: 'AI assistant for welcome step in business setup',
        prompt: `You are a Welcome AI assistant for Business Setup Wizard. Your role is to:

1. Greet users warmly and welcome them to the business setup process
2. Explain what Business Setup Wizard will accomplish
3. Guide users through the initial steps
4. Answer questions about the setup process
5. Motivate users to continue with business setup

Be friendly, encouraging, and explain what will happen next. Focus on building excitement and confidence.`,
        modelId: 'google/gemini-2.5-flash' as const,
        isCustom: true,
      },
      [BusinessSetupStatus.BUSINESS_ANALYSIS]: {
        name: 'business-analysis-agent',
        label: 'Business Analysis AI',
        description: 'AI assistant for business analysis step',
        prompt: `You are a Business Analysis AI specialist. Your role is to:

1. Help users understand their business better
2. Ask relevant questions about industry, size, model
3. Provide industry insights and trends
4. Suggest optimization opportunities
5. Prepare users for funnel design

Focus on gathering actionable business intelligence.`,
        modelId: 'auto' as const,
        isCustom: true,
      },
      [BusinessSetupStatus.SALES_FUNNEL_DESIGN]: {
        name: 'funnel-designer-agent',
        label: 'Sales Funnel Designer AI',
        description: 'AI assistant for sales funnel design step',
        prompt: `You are a Sales Funnel Designer AI specialist. Your role is to:

1. Design effective sales funnels based on business analysis
2. Create conversion-optimized customer journeys
3. Suggest funnel stages and touchpoints
4. Recommend automation opportunities
5. Prepare foundation for agent setup

Focus on creating high-converting sales processes.`,
        modelId: 'auto' as const,
        isCustom: true,
      },
      [BusinessSetupStatus.AGENT_SETUP]: {
        name: 'agent-orchestrator-agent',
        label: 'Agent Orchestrator AI',
        description: 'AI assistant for agent setup and orchestration',
        prompt: `You are an Agent Orchestrator AI specialist. Your role is to:

1. Design AI agent teams based on business needs
2. Configure agent roles and responsibilities
3. Set up agent handoff workflows
4. Optimize agent performance settings
5. Prepare agents for workflow integration

Focus on creating efficient automated agent teams.`,
        modelId: 'auto' as const,
        isCustom: true,
      },
      [BusinessSetupStatus.WORKFLOW_CREATION]: {
        name: 'workflow-generator-agent',
        label: 'Workflow Generator AI',
        description: 'AI assistant for workflow creation and automation',
        prompt: `You are a Workflow Generator AI specialist. Your role is to:

1. Create automated workflows based on funnel design
2. Design business process automation
3. Set up triggers and conditions
4. Configure workflow optimization
5. Prepare workflows for team assignment

Focus on creating efficient automated business processes.`,
        modelId: 'auto' as const,
        isCustom: true,
      },
      [BusinessSetupStatus.TEAM_ASSIGNMENT]: {
        name: 'team-assignment-agent',
        label: 'Team Assignment AI',
        description: 'AI assistant for team assignment and role management',
        prompt: `You are a Team Assignment AI specialist. Your role is to:

1. Assign team members to workflows and processes
2. Define roles and responsibilities
3. Set up team collaboration structures
4. Configure access controls and permissions
5. Prepare team for testing phase

Focus on optimizing team structure and collaboration.`,
        modelId: 'auto' as const,
        isCustom: true,
      },
      [BusinessSetupStatus.TESTING_OPTIMIZATION]: {
        name: 'testing-optimization-agent',
        label: 'Testing & Optimization AI',
        description: 'AI assistant for testing and optimization phase',
        prompt: `You are a Testing & Optimization AI specialist. Your role is to:

1. Design testing strategies for business setup
2. Monitor system performance and metrics
3. Identify optimization opportunities
4. Suggest improvements and refinements
5. Validate complete system functionality

Focus on ensuring optimal performance and user experience.`,
        modelId: 'auto' as const,
        isCustom: true,
      },
    };

    const config = agentConfigs[step];
    if (!config) {
      throw new Error(`No configuration for step: ${step}`);
    }

    return await this.agentService.createOneAgent(
      {
        ...config,
        icon: '🤖', // Default icon for business setup agents
      },
      workspaceId,
    );
  }

  /**
   * Create the specific SGR Avito Agent for WELCOME status
   * This agent has predefined ID and special SGR capabilities
   */
  private async createSGRAvitoAgent(workspaceId: string): Promise<AgentEntity> {
    const SGR_AVITO_AGENT_ID = '2f851163-c7ea-4eae-b960-13f019b256e3';
    
    // Create agent directly with repository to support specific ID
    const agent = this.agentRepository.create({
      id: SGR_AVITO_AGENT_ID, // Force specific ID
      name: 'sgr-avito-agent',
      label: 'SGR Avito Integration Assistant',
      description: 'Specialized SGR agent for Avito API integration during business setup',
      prompt: `You are the SGR Avito Integration Assistant, a specialized AI agent with Schema-Guided Reasoning capabilities.

Your role is to help users set up Avito API integration for their business automation.

Key responsibilities:
1. Extract CLIENT_ID and CLIENT_SECRET from user messages using SGR processing
2. Validate Avito API credentials through secure API calls
3. Guide users through the complete Avito integration setup process
4. Use Schema-Guided Reasoning for accurate credential processing
5. Provide step-by-step setup guidance for Avito automation

Capabilities:
- Credential extraction with multiple format support
- API validation and testing
- SGR-powered data processing
- Secure credential handling
- Integration setup guidance

Always be helpful, professional, and security-focused when handling API credentials.`,
      modelId: 'google/gemini-2.5-flash',
      icon: '🤖',
      workspaceId,
      isCustom: true,
    });

    return await this.agentRepository.save(agent);
  }

  /**
   * Get or create supervisor agent for business setup routing
   * The supervisor agent is responsible for analyzing user requests and routing them to appropriate specialized agents
   */
  async getSupervisorAgent(userWorkspaceId: string): Promise<AgentEntity> {
    this.logger.log(`Getting supervisor agent for userWorkspace ${userWorkspaceId}`);

    // Resolve actual workspace ID from userWorkspace
    const actualWorkspaceId = await this.resolveWorkspaceId(userWorkspaceId);

    // Look for existing supervisor agent
    let supervisorAgent = await this.agentRepository.findOne({
      where: { name: 'business-setup-supervisor', workspaceId: actualWorkspaceId },
    });

    // Create supervisor agent if it doesn't exist
    if (!supervisorAgent) {
      this.logger.log(`Creating supervisor agent for workspace ${actualWorkspaceId}`);
      supervisorAgent = await this.createSupervisorAgent(actualWorkspaceId);
    }

    return supervisorAgent;
  }

  /**
   * Create supervisor agent with specialized routing capabilities
   */
  async createSupervisorAgent(workspaceId: string): Promise<AgentEntity> {
    const supervisorPrompt = `You are a Supervisor Agent for the Business Setup workflow in Twenty CRM.

Your responsibilities:
1. Analyze user requests in the context of business setup progress
2. Route requests to appropriate specialized agents based on current status
3. Manage progression through business setup stages
4. Provide transparent reasoning for all routing decisions

Available Business Setup Stages:
- WELCOME: Initial setup and Avito API credential collection
- BUSINESS_ANALYSIS: Business requirements analysis
- SALES_FUNNEL_DESIGN: Sales funnel creation and optimization
- AGENT_SETUP: AI agent team configuration
- WORKFLOW_CREATION: Automated workflow creation
- TEAM_ASSIGNMENT: Team role and responsibility assignment
- TESTING_OPTIMIZATION: System testing and optimization
- COMPLETED: Business setup complete

CRITICAL ROUTING RULES:
- WELCOME status: ALWAYS route to SGR Avito Agent (sgr-avito-agent)
- Never process WELCOME requests yourself - always delegate to SGR agent
- Monitor for stage completion signals and trigger status transitions
- Provide clear reasoning for every routing decision

Use the available tools to check status, route requests, and manage transitions.
Always maintain a helpful and informative tone while making routing decisions.`;

    return await this.agentService.createOneAgent(
      {
        name: 'business-setup-supervisor',
        label: 'Business Setup Supervisor',
        description: 'Supervisor agent that routes business setup requests to appropriate specialized agents',
        prompt: supervisorPrompt,
        modelId: 'google/gemini-2.5-flash',
        icon: '🎯',
        isCustom: true,
      },
      workspaceId,
    );
  }

  /**
   * Check if an agent is a business setup supervisor agent
   */
  async isSupervisorAgent(agentId: string, workspaceId: string): Promise<boolean> {
    try {
      const agent = await this.agentRepository.findOne({
        where: { id: agentId, workspaceId },
      });

      return agent?.name === 'business-setup-supervisor';
    } catch (error) {
      this.logger.error('Failed to check if agent is supervisor:', error);
      return false;
    }
  }

  /**
   * Get all business setup agents for a workspace
   */
  async getAllBusinessSetupAgents(userWorkspaceId: string): Promise<AgentEntity[]> {
    const actualWorkspaceId = await this.resolveWorkspaceId(userWorkspaceId);
    
    const businessSetupAgentNames = [
      'business-setup-supervisor',
      'sgr-avito-agent',
      'welcome-agent',
      'business-analysis-agent',
      'funnel-designer-agent',
      'agent-orchestrator-agent',
      'workflow-generator-agent',
      'team-assignment-agent',
      'testing-optimization-agent'
    ];

    return await this.agentRepository.find({
      where: businessSetupAgentNames.map(name => ({ name, workspaceId: actualWorkspaceId })),
    });
  }
}