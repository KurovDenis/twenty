import { Injectable } from '@nestjs/common';
import { AgentMessage } from '@twenty/shared';
import { AiService } from 'src/engine/core-modules/ai/services/ai.service';
import { Repository } from 'typeorm';
import { LangGraphStateEntity } from '../entities/langgraph-state.entity';

@Injectable()
export class LangGraphMemoryService {
  constructor(
    private readonly langGraphStateRepository: Repository<LangGraphStateEntity>,
    private readonly aiService: AiService,
  ) {}

  async updateLongTermMemory(
    threadId: string,
    conversation: AgentMessage[],
    agentState: Record<string, any>,
  ): Promise<void> {
    // Extract key insights from conversation
    const insights = await this.extractInsights(conversation);
    
    // Update user preferences
    const preferences = await this.updateUserPreferences(conversation, agentState);
    
    // Create conversation summary
    const summary = await this.createConversationSummary(conversation);

    // Use transaction to ensure atomicity
    await this.langGraphStateRepository.manager.transaction(async (tm) => {
      const existing = await tm.findOne(LangGraphStateEntity, { 
        where: { threadId } 
      });
      
      const history = existing?.longTermMemory?.conversationHistory ?? [];
      
      // Append new entry to history
      history.push({
        timestamp: new Date(),
        summary,
        keyInsights: insights,
      });
      
      // Cap history at 50 entries to prevent unbounded growth
      const cappedHistory = history.slice(-50);
      
      await tm.update(LangGraphStateEntity, { threadId }, {
        longTermMemory: {
          userPreferences: { 
            ...(existing?.longTermMemory?.userPreferences ?? {}), 
            ...preferences 
          },
          conversationHistory: cappedHistory,
          learningData: {
            ...(existing?.longTermMemory?.learningData ?? {}),
            lastInteraction: new Date(),
            totalInteractions: (existing?.longTermMemory?.learningData?.totalInteractions ?? 0) + 1,
          },
        },
      });
    });
  }

  private async extractInsights(messages: AgentMessage[]): Promise<string[]> {
    const prompt = `
You are an AI conversation analyzer. Your task is to extract key insights from the provided conversation.
Follow these rules exactly:
1. Respond with valid JSON array of strings only
2. Extract 3-5 most important insights about user preferences, behavior, or intent
3. Each insight should be specific and actionable
4. If no meaningful insights, return empty array

Conversation:
${messages.map(m => `${m.role}: ${m.content}`).join('\n')}

Response format:
["insight 1", "insight 2", ...]
`;

    try {
      const response = await this.aiService.streamText(
        [{ role: 'system', content: prompt }],
        {
          temperature: 0.1,
          maxTokens: 200,
        }
      );
      
      // For now, we'll need to handle the streaming response differently
      // This is a simplified implementation
      const insights: string[] = [];
      
      // Validate that we got an array of strings
      if (Array.isArray(insights) && insights.every(insight => typeof insight === 'string')) {
        return insights;
      }
      
      console.warn('Invalid insights format received, returning empty array');
      return [];
    } catch (e) {
      console.warn('Failed to parse insights, returning empty array', e);
      return [];
    }
  }

  private async createConversationSummary(messages: AgentMessage[]): Promise<string> {
    const prompt = `
Summarize the following conversation in 2-3 sentences, focusing on:
1. Main topic or request
2. User's intent or goal
3. Key decisions or actions taken

Conversation:
${messages.map(m => `${m.role}: ${m.content}`).join('\n')}

Summary:`;

    try {
      const response = await this.aiService.streamText(
        [{ role: 'system', content: prompt }],
        {
          temperature: 0.3,
          maxTokens: 150,
        }
      );
      
      // For now, return a placeholder since we need to handle streaming
      return 'Conversation summary generated';
    } catch (e) {
      console.warn('Failed to generate conversation summary', e);
      return 'Conversation summary unavailable';
    }
  }

  private async updateUserPreferences(
    messages: AgentMessage[],
    agentState: Record<string, any>,
  ): Promise<Record<string, any>> {
    // Implementation for updating user preferences based on conversation
    return {
      preferredLanguage: this.detectLanguage(messages),
      interactionStyle: this.analyzeInteractionStyle(messages),
      expertiseLevel: this.assessExpertiseLevel(messages),
      interests: this.extractInterests(messages),
    };
  }

  private detectLanguage(messages: AgentMessage[]): string {
    // Simple language detection - could be enhanced with proper library
    const content = messages.map(m => m.content).join(' ');
    if (/[а-яё]/i.test(content)) return 'ru';
    return 'en';
  }

  private analyzeInteractionStyle(messages: AgentMessage[]): string {
    // Analyze user interaction style
    const userMessages = messages.filter(m => m.role === 'user');
    const avgLength = userMessages.reduce((sum, m) => sum + m.content.length, 0) / userMessages.length;
    
    if (avgLength > 100) return 'detailed';
    if (avgLength > 50) return 'moderate';
    return 'concise';
  }

  private assessExpertiseLevel(messages: AgentMessage[]): string {
    // Assess user expertise level based on terminology and questions
    const content = messages.map(m => m.content).join(' ').toLowerCase();
    const technicalTerms = ['api', 'integration', 'workflow', 'automation', 'webhook'];
    const technicalCount = technicalTerms.filter(term => content.includes(term)).length;
    
    if (technicalCount > 3) return 'expert';
    if (technicalCount > 1) return 'intermediate';
    return 'beginner';
  }

  private extractInterests(messages: AgentMessage[]): string[] {
    // Extract user interests from conversation
    const interests = [];
    const content = messages.map(m => m.content).join(' ').toLowerCase();
    
    if (content.includes('sales') || content.includes('crm')) interests.push('sales');
    if (content.includes('marketing') || content.includes('campaign')) interests.push('marketing');
    if (content.includes('analytics') || content.includes('report')) interests.push('analytics');
    if (content.includes('automation') || content.includes('workflow')) interests.push('automation');
    
    return interests;
  }
}
