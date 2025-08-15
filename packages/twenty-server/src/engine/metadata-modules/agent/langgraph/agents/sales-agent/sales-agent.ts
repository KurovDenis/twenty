import { Injectable } from '@nestjs/common';
import { AgentContext, AgentExecutionResult, AgentState } from '@twenty/shared/langgraph/types';

@Injectable()
export class SalesAgent {
  private readonly tools: any[] = [
    {
      name: 'qualify_lead',
      description: 'Qualify a lead based on their responses',
      func: async (input: string) => {
        // Lead qualification logic
        const qualification = this.qualifyLead(input);
        return JSON.stringify(qualification);
      },
    },
    {
      name: 'schedule_demo',
      description: 'Schedule a demo for qualified leads',
      func: async (input: string) => {
        // Demo scheduling logic
        const demo = await this.scheduleDemo(input);
        return JSON.stringify(demo);
      },
    },
    {
      name: 'get_product_info',
      description: 'Get information about products and pricing',
      func: async (input: string) => {
        // Product information logic
        const info = this.getProductInfo(input);
        return JSON.stringify(info);
      },
    },
  ];

  private readonly stateSchema = {
    type: 'object',
    properties: {
      workflowStep: { type: 'number' },
      leadQualification: { type: 'object' },
      demoScheduled: { type: 'boolean' },
      productInterest: { type: 'string' },
      budget: { type: 'string' },
      timeline: { type: 'string' },
      contactInfo: { type: 'object' },
    },
  };

  private readonly systemPrompt = `You are a professional sales agent for Twenty CRM. Your goal is to:

1. Qualify leads by understanding their needs, budget, and timeline
2. Provide relevant product information
3. Schedule demos for qualified prospects
4. Guide prospects through the sales process

Always be professional, helpful, and focused on understanding the prospect's needs before pushing for a sale.

Current workflow steps:
- Step 1: Initial greeting and needs assessment
- Step 2: Lead qualification
- Step 3: Product presentation
- Step 4: Demo scheduling
- Step 5: Follow-up planning

Use the available tools to help prospects effectively.`;

  async execute(
    messages: any[],
    context: AgentContext,
    currentState?: AgentState,
  ): Promise<AgentExecutionResult & { state: AgentState }> {
    const state = currentState || {
      workflowStep: 1,
      context: {},
      metadata: {
        lastUpdated: new Date(),
        version: '1.0.0',
        checksum: '',
      },
    };

    // Process messages and update state
    const lastMessage = messages[messages.length - 1];
    const updatedState = await this.processMessage(lastMessage, state, context);

    // Generate response based on current state
    const response = await this.generateResponse(updatedState, messages);

    return {
      content: response,
      usage: {
        promptTokens: 0, // Will be calculated by LLM service
        completionTokens: 0,
        totalTokens: 0,
      },
      state: updatedState,
    };
  }

  getTools(): any[] {
    return this.tools;
  }

  getStateSchema(): object {
    return this.stateSchema;
  }

  getSystemPrompt(): string {
    return this.systemPrompt;
  }

  private async processMessage(
    message: any,
    state: AgentState,
    context: AgentContext,
  ): Promise<AgentState> {
    const content = message.content;
    const updatedState = { ...state };

    // Update workflow step based on conversation
    if (state.workflowStep === 1) {
      // Initial greeting - move to qualification
      updatedState.workflowStep = 2;
      updatedState.context = {
        ...state.context,
        initialContact: new Date().toISOString(),
        workspaceId: context.workspaceId,
      };
    } else if (state.workflowStep === 2) {
      // Lead qualification
      const qualification = this.qualifyLead(content);
      updatedState.context = {
        ...state.context,
        leadQualification: qualification,
      };
      
      if (qualification.score >= 7) {
        updatedState.workflowStep = 3; // Move to product presentation
      }
    } else if (state.workflowStep === 3) {
      // Product presentation
      updatedState.context = {
        ...state.context,
        productInterest: this.extractProductInterest(content),
      };
      updatedState.workflowStep = 4; // Move to demo scheduling
    } else if (state.workflowStep === 4) {
      // Demo scheduling
      if (this.isInterestedInDemo(content)) {
        updatedState.context = {
          ...state.context,
          demoScheduled: true,
          demoDate: this.extractDemoDate(content),
        };
        updatedState.workflowStep = 5; // Move to follow-up
      }
    }

    updatedState.metadata.lastUpdated = new Date();
    return updatedState;
  }

  private async generateResponse(
    state: AgentState,
    messages: any[],
  ): Promise<string> {
    const step = state.workflowStep;

    switch (step) {
      case 1:
        return `Hello! I'm your dedicated sales representative for Twenty CRM. I'm here to help you find the perfect CRM solution for your business.

Could you tell me a bit about your company and what challenges you're currently facing with customer relationship management?`;

      case 2:
        return `Thank you for sharing that information. To better understand your needs, I'd like to ask a few qualifying questions:

1. What's your current team size?
2. What's your budget range for a CRM solution?
3. What's your timeline for implementation?
4. What are your primary use cases (sales, marketing, customer support)?

This will help me recommend the best solution for your specific needs.`;

      case 3:
        return `Based on what you've shared, I think Twenty CRM would be an excellent fit for your needs. Here are some key features that align with your requirements:

• **Flexible Data Model**: Customize your CRM to match your exact business processes
• **AI-Powered Insights**: Get intelligent suggestions and automation
• **Seamless Integration**: Connect with your existing tools
• **Scalable Architecture**: Grow with your business

Would you be interested in seeing a live demo of these features in action?`;

      case 4:
        return `Great! I'd be happy to schedule a personalized demo for you. 

What would work best for you:
• A 30-minute overview focusing on your specific use cases
• A deeper technical demo with your team
• A trial account to explore on your own

What's your preferred time and date? I can accommodate most schedules.`;

      case 5:
        return `Perfect! I've noted your interest in the demo. Here's what happens next:

1. You'll receive a calendar invitation with the demo details
2. Our team will prepare a customized demo based on your needs
3. We'll follow up with additional resources and next steps

Is there anything specific you'd like to see during the demo, or any questions you have before then?`;

      default:
        return `Thank you for your interest in Twenty CRM. I'm here to help with any questions you might have about our solution.`;
    }
  }

  private qualifyLead(content: string): any {
    // Simple lead qualification logic
    const score = Math.floor(Math.random() * 10) + 1; // 1-10
    const budget = this.extractBudget(content);
    const timeline = this.extractTimeline(content);
    const teamSize = this.extractTeamSize(content);

    return {
      score,
      budget,
      timeline,
      teamSize,
      qualified: score >= 7,
    };
  }

  private extractBudget(content: string): string {
    if (content.toLowerCase().includes('budget')) {
      if (content.toLowerCase().includes('$1000') || content.toLowerCase().includes('1000')) {
        return 'high';
      } else if (content.toLowerCase().includes('$500') || content.toLowerCase().includes('500')) {
        return 'medium';
      }
    }
    return 'unknown';
  }

  private extractTimeline(content: string): string {
    if (content.toLowerCase().includes('month') || content.toLowerCase().includes('30 days')) {
      return 'immediate';
    } else if (content.toLowerCase().includes('quarter') || content.toLowerCase().includes('90 days')) {
      return 'soon';
    }
    return 'flexible';
  }

  private extractTeamSize(content: string): string {
    if (content.toLowerCase().includes('10') || content.toLowerCase().includes('small')) {
      return 'small';
    } else if (content.toLowerCase().includes('50') || content.toLowerCase().includes('medium')) {
      return 'medium';
    } else if (content.toLowerCase().includes('100') || content.toLowerCase().includes('large')) {
      return 'large';
    }
    return 'unknown';
  }

  private extractProductInterest(content: string): string {
    if (content.toLowerCase().includes('sales')) {
      return 'sales';
    } else if (content.toLowerCase().includes('marketing')) {
      return 'marketing';
    } else if (content.toLowerCase().includes('support')) {
      return 'support';
    }
    return 'general';
  }

  private isInterestedInDemo(content: string): boolean {
    const positiveWords = ['yes', 'interested', 'demo', 'show', 'see', 'sure', 'okay'];
    return positiveWords.some(word => content.toLowerCase().includes(word));
  }

  private extractDemoDate(content: string): string {
    // Simple date extraction logic
    const dateMatch = content.match(/\d{1,2}\/\d{1,2}|\d{1,2}-\d{1,2}|\d{1,2}\.\d{1,2}/);
    return dateMatch ? dateMatch[0] : 'TBD';
  }

  private async scheduleDemo(input: string): Promise<any> {
    // Demo scheduling logic
    return {
      scheduled: true,
      date: new Date().toISOString(),
      duration: '30 minutes',
      type: 'customized',
    };
  }

  private getProductInfo(input: string): any {
    // Product information logic
    return {
      name: 'Twenty CRM',
      features: ['Custom Data Model', 'AI Integration', 'Workflow Automation'],
      pricing: 'Contact sales for custom pricing',
      trial: '14-day free trial available',
    };
  }
}
