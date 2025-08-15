import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { type Readable } from 'stream';

import {
  type CoreMessage,
  type CoreUserMessage,
  type FilePart,
  generateObject,
  generateText,
  type ImagePart,
  streamText,
  type UserContent,
} from 'ai';
import { In, Repository } from 'typeorm';

import { ModelProvider } from 'src/engine/core-modules/ai/constants/ai-models.const';
import { AiModelRegistryService } from 'src/engine/core-modules/ai/services/ai-model-registry.service';
import { DomainManagerService } from 'src/engine/core-modules/domain-manager/services/domain-manager.service';
import { FileEntity } from 'src/engine/core-modules/file/entities/file.entity';
import { FileService } from 'src/engine/core-modules/file/services/file.service';
import { extractFolderPathAndFilename } from 'src/engine/core-modules/file/utils/extract-folderpath-and-filename.utils';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { type Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import {
  type AgentChatMessageEntity,
  AgentChatMessageRole,
} from 'src/engine/metadata-modules/agent/agent-chat-message.entity';
import { AgentToolService } from 'src/engine/metadata-modules/agent/agent-tool.service';
import { AGENT_CONFIG } from 'src/engine/metadata-modules/agent/constants/agent-config.const';
import { AGENT_SYSTEM_PROMPTS } from 'src/engine/metadata-modules/agent/constants/agent-system-prompts.const';
import { type RecordIdsByObjectMetadataNameSingularType } from 'src/engine/metadata-modules/agent/types/recordIdsByObjectMetadataNameSingular.type';
import { convertOutputSchemaToZod } from 'src/engine/metadata-modules/agent/utils/convert-output-schema-to-zod';
import { WorkspacePermissionsCacheService } from 'src/engine/metadata-modules/workspace-permissions-cache/workspace-permissions-cache.service';
import { TwentyORMGlobalManager } from 'src/engine/twenty-orm/twenty-orm-global.manager';
import { type OutputSchema } from 'src/modules/workflow/workflow-builder/workflow-schema/types/output-schema.type';
import { streamToBuffer } from 'src/utils/stream-to-buffer';

import { AgentEntity } from './agent.entity';
import { AgentException, AgentExceptionCode } from './agent.exception';
import { LangGraphExecutionService } from './langgraph/services/langgraph-execution.service';
import { AgentContext } from './langgraph/types/langgraph-agent.types';

export interface AgentExecutionResult {
  result: object;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

@Injectable()
export class AgentExecutionService {
  private readonly logger = new Logger(AgentExecutionService.name);

  constructor(
    private readonly twentyConfigService: TwentyConfigService,
    private readonly agentToolService: AgentToolService,
    private readonly fileService: FileService,
    private readonly domainManagerService: DomainManagerService,
    private readonly twentyORMGlobalManager: TwentyORMGlobalManager,
    private readonly workspacePermissionsCacheService: WorkspacePermissionsCacheService,
    private readonly aiModelRegistryService: AiModelRegistryService,
    private readonly langGraphExecutionService: LangGraphExecutionService, // Add LangGraph service
    @InjectRepository(AgentEntity, 'core')
    private readonly agentRepository: Repository<AgentEntity>,
    @InjectRepository(FileEntity, 'core')
    private readonly fileRepository: Repository<FileEntity>,
  ) {}

  private async validateApiKey(provider: ModelProvider): Promise<void> {
    let apiKey: string | undefined;

    switch (provider) {
      case ModelProvider.OPENAI:
        apiKey = this.twentyConfigService.get('OPENAI_API_KEY');
        break;
      case ModelProvider.ANTHROPIC:
        apiKey = this.twentyConfigService.get('ANTHROPIC_API_KEY');
        break;
      default:
        return;
    }
    if (!apiKey) {
      throw new AgentException(
        `${provider.toUpperCase()} API key not configured`,
        AgentExceptionCode.API_KEY_NOT_CONFIGURED,
      );
    }
  }

  async prepareAIRequestConfig({
    messages,
    prompt,
    system,
    agent,
  }: {
    system: string;
    agent: AgentEntity | null;
    prompt?: string;
    messages?: CoreMessage[];
  }) {
    try {
      if (agent) {
        this.logger.log(
          `Preparing AI request config for agent ${agent.id} with model ${agent.modelId}`,
        );
      }

      const aiModel = this.aiModelRegistryService.getEffectiveModelConfig(
        agent?.modelId ?? 'auto',
      );

      if (agent && !aiModel) {
        const error = `AI model with id ${agent.modelId} not found`;

        this.logger.error(error);
        throw new AgentException(
          error,
          AgentExceptionCode.AGENT_EXECUTION_FAILED,
        );
      }

      this.logger.log(
        `Resolved model: ${aiModel.modelId} (provider: ${aiModel.provider})`,
      );

      const provider = aiModel.provider;

      await this.validateApiKey(provider);

      const tools = agent
        ? await this.agentToolService.generateToolsForAgent(
            agent.id,
            agent.workspaceId,
          )
        : {};

      this.logger.log(`Generated ${Object.keys(tools).length} tools for agent`);

      const registeredModel = this.aiModelRegistryService.getModel(
        aiModel.modelId,
      );

      if (!registeredModel) {
        throw new AgentException(
          `Model ${aiModel.modelId} not found in registry`,
          AgentExceptionCode.AGENT_EXECUTION_FAILED,
        );
      }

      return {
        system,
        tools,
        model: registeredModel.model,
        ...(messages && { messages }),
        ...(prompt && { prompt }),
        maxSteps: AGENT_CONFIG.MAX_STEPS,
      };
    } catch (error) {
      this.logger.error(
        `Failed to prepare AI request config for agent ${agent?.id ?? 'no agent'}`,
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }
  }

  private async buildUserMessageWithFiles(
    fileIds: string[],
  ): Promise<(ImagePart | FilePart)[]> {
    const files = await this.fileRepository.find({
      where: {
        id: In(fileIds),
      },
    });

    return await Promise.all(files.map((file) => this.createFilePart(file)));
  }

  private async buildUserMessage(
    userMessage: string,
    fileIds: string[],
  ): Promise<CoreUserMessage> {
    const content: Exclude<UserContent, string> = [
      {
        type: 'text',
        text: userMessage,
      },
    ];

    if (fileIds.length !== 0) {
      content.push(...(await this.buildUserMessageWithFiles(fileIds)));
    }

    return {
      role: AgentChatMessageRole.USER,
      content,
    };
  }

  private async getContextForSystemPrompt(
    workspace: Workspace,
    recordIdsByObjectMetadataNameSingular: RecordIdsByObjectMetadataNameSingularType,
    userWorkspaceId: string,
  ) {
    const roleId =
      await this.workspacePermissionsCacheService.getRoleIdFromUserWorkspaceId({
        workspaceId: workspace.id,
        userWorkspaceId,
      });

    if (!roleId) {
      throw new AgentException(
        'Failed to retrieve user role.',
        AgentExceptionCode.ROLE_NOT_FOUND,
      );
    }

    const workspaceDataSource =
      await this.twentyORMGlobalManager.getDataSourceForWorkspace({
        workspaceId: workspace.id,
      });

    const contextObject = (
      await Promise.all(
        recordIdsByObjectMetadataNameSingular.map(
          async (recordsWithObjectMetadataNameSingular) => {
            if (recordsWithObjectMetadataNameSingular.recordIds.length === 0) {
              return [];
            }

            const repository = workspaceDataSource.getRepository(
              recordsWithObjectMetadataNameSingular.objectMetadataNameSingular,
              false,
              roleId,
            );

            return (
              await repository.find({
                where: {
                  id: In(recordsWithObjectMetadataNameSingular.recordIds),
                },
              })
            ).map((record) => {
              return {
                ...record,
                resourceUrl: this.domainManagerService.buildWorkspaceURL({
                  workspace,
                  pathname: `object/${recordsWithObjectMetadataNameSingular.objectMetadataNameSingular}/${record.id}`,
                }),
              };
            });
          },
        ),
      )
    ).flat(2);

    return JSON.stringify(contextObject);
  }

  private async createFilePart(
    file: FileEntity,
  ): Promise<ImagePart | FilePart> {
    const { folderPath, filename } = extractFolderPathAndFilename(
      file.fullPath,
    );
    const fileStream = await this.fileService.getFileStream(
      folderPath,
      filename,
      file.workspaceId,
    );
    const fileBuffer = await streamToBuffer(fileStream as Readable);

    if (file.type.startsWith('image')) {
      return {
        type: 'image',
        image: fileBuffer,
        mimeType: file.type,
      };
    } else {
      return {
        type: 'file',
        data: fileBuffer,
        mimeType: file.type,
      };
    }
  }

  async streamChatResponse({
    workspace,
    userWorkspaceId,
    agentId,
    userMessage,
    messages,
    fileIds,
    recordIdsByObjectMetadataNameSingular,
  }: {
    workspace: Workspace;
    userWorkspaceId: string;
    agentId: string;
    userMessage: string;
    messages: AgentChatMessageEntity[];
    fileIds: string[];
    recordIdsByObjectMetadataNameSingular: RecordIdsByObjectMetadataNameSingularType;
  }) {
    const agent = await this.agentRepository.findOneOrFail({
      where: { id: agentId },
    });

    const llmMessages: CoreMessage[] = messages.map(({ role, content }) => ({
      role,
      content,
    }));

    let contextString = '';

    if (recordIdsByObjectMetadataNameSingular.length > 0) {
      const contextPart = await this.getContextForSystemPrompt(
        workspace,
        recordIdsByObjectMetadataNameSingular,
        userWorkspaceId,
      );

      contextString = `\n\nCONTEXT:\n${contextPart}`;
    }

    const userMessageWithFiles = await this.buildUserMessage(
      userMessage,
      fileIds,
    );

    llmMessages.push(userMessageWithFiles);

    const aiRequestConfig = await this.prepareAIRequestConfig({
      system: `${AGENT_SYSTEM_PROMPTS.AGENT_CHAT}\n\n${agent.prompt}${contextString}`,
      agent,
      messages: llmMessages,
    });

    this.logger.log(
      `Sending request to AI model with ${llmMessages.length} messages`,
    );

    return streamText(aiRequestConfig);
  }

  async executeAgent(
    agentId: string,
    messages: CoreMessage[],
    workspaceId: string,
    userWorkspaceId: string,
    threadId: string,
  ): Promise<AgentExecutionResult> {
    const agent = await this.agentRepository.findOne({
      where: { id: agentId, workspaceId },
    });

    if (!agent) {
      throw new AgentException(
        'Agent not found',
        AgentExceptionCode.AGENT_NOT_FOUND,
      );
    }

    // Check if this is a LangGraph agent
    if (agent.agentType === 'langgraph') {
      const context: AgentContext = {
        workspaceId,
        userId: userWorkspaceId, // TODO: get userId from userWorkspaceId
        threadId,
        userWorkspaceId,
      };

      const result = await this.langGraphExecutionService.execute(
        agentId,
        messages as any, // Convert to AgentMessage format
        context,
      );

      return {
        result: { content: result.content },
        usage: result.usage,
      };
    }

    // Existing logic for standard agents
    return this.executeStandardAgent(agent, messages, workspaceId);
  }

  private async executeStandardAgent(
    agent: AgentEntity,
    messages: CoreMessage[],
    workspaceId: string,
  ): Promise<AgentExecutionResult> {
    try {
      const aiRequestConfig = await this.prepareAIRequestConfig({
        system: `You are executing as part of a workflow automation. ${agent ? agent.prompt : ''}`,
        agent,
        prompt: messages.map((msg) => msg.content).join('\n'), // Use messages for prompt
      });
      const textResponse = await generateText(aiRequestConfig);

      return {
        result: { response: textResponse.text },
        usage: textResponse.usage,
      };
    } catch (error) {
      if (error instanceof AgentException) {
        throw error;
      }
      throw new AgentException(
        error instanceof Error ? error.message : 'Agent execution failed',
        AgentExceptionCode.AGENT_EXECUTION_FAILED,
      );
    }
  }
}
