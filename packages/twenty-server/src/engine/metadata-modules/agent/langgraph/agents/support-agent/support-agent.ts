import { Injectable } from '@nestjs/common';
import { AgentContext, AgentExecutionResult, AgentState } from '@twenty/shared';

@Injectable()
export class SupportAgent {
  private readonly tools: any[] = [
    {
      name: 'search_knowledge_base',
      description: 'Search the knowledge base for relevant articles and solutions',
      func: async (input: string) => {
        const articles = await this.searchKnowledgeBase(input);
        return JSON.stringify(articles);
      },
    },
    {
      name: 'create_ticket',
      description: 'Create a support ticket for complex issues',
      func: async (input: string) => {
        const ticket = await this.createTicket(input);
        return JSON.stringify(ticket);
      },
    },
    {
      name: 'check_account_status',
      description: 'Check the status of a user account',
      func: async (input: string) => {
        const status = await this.checkAccountStatus(input);
        return JSON.stringify(status);
      },
    },
    {
      name: 'escalate_issue',
      description: 'Escalate an issue to a senior support agent',
      func: async (input: string) => {
        const escalation = await this.escalateIssue(input);
        return JSON.stringify(escalation);
      },
    },
  ];

  private readonly stateSchema = {
    type: 'object',
    properties: {
      workflowStep: { type: 'number' },
      issueType: { type: 'string' },
      priority: { type: 'string' },
      ticketCreated: { type: 'boolean' },
      escalationNeeded: { type: 'boolean' },
      resolutionAttempted: { type: 'boolean' },
      userSatisfaction: { type: 'number' },
    },
  };

  private readonly systemPrompt = `You are a professional technical support agent for Twenty CRM. Your goal is to:

1. Understand and diagnose user issues quickly
2. Provide immediate solutions when possible
3. Escalate complex issues appropriately
4. Ensure user satisfaction and resolution

Always be patient, empathetic, and solution-focused. Follow these workflow steps:

- Step 1: Greet and gather initial information
- Step 2: Diagnose the issue
- Step 3: Attempt resolution
- Step 4: Escalate if needed
- Step 5: Confirm resolution and satisfaction

Use the available tools to provide the best possible support experience.`;

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
        promptTokens: 0,
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
      // Initial greeting - move to diagnosis
      updatedState.workflowStep = 2;
      updatedState.context = {
        ...state.context,
        initialContact: new Date().toISOString(),
        workspaceId: context.workspaceId,
      };
    } else if (state.workflowStep === 2) {
      // Issue diagnosis
      const diagnosis = this.diagnoseIssue(content);
      updatedState.context = {
        ...state.context,
        issueType: diagnosis.type,
        priority: diagnosis.priority,
        symptoms: diagnosis.symptoms,
      };
      updatedState.workflowStep = 3; // Move to resolution
    } else if (state.workflowStep === 3) {
      // Resolution attempt
      const resolution = await this.attemptResolution(content, updatedState.context);
      updatedState.context = {
        ...state.context,
        resolutionAttempted: true,
        resolutionMethod: resolution.method,
        success: resolution.success,
      };
      
      if (resolution.success) {
        updatedState.workflowStep = 5; // Move to confirmation
      } else {
        updatedState.workflowStep = 4; // Move to escalation
      }
    } else if (state.workflowStep === 4) {
      // Escalation
      updatedState.context = {
        ...state.context,
        escalationNeeded: true,
        escalationReason: this.determineEscalationReason(content),
      };
      updatedState.workflowStep = 5; // Move to confirmation
    }

    updatedState.metadata.lastUpdated = new Date();
    return updatedState;
  }

  private async generateResponse(
    state: AgentState,
    messages: any[],
  ): Promise<string> {
    const step = state.workflowStep;
    const context = state.context;

    switch (step) {
      case 1:
        return `Hello! I'm your technical support specialist for Twenty CRM. I'm here to help you resolve any issues you're experiencing.

Could you please describe the problem you're encountering? Please include any error messages, steps you've already tried, and what you were trying to accomplish.`;

      case 2:
        const issueType = context.issueType || 'general';
        const priority = context.priority || 'medium';
        
        return `Thank you for the details. I understand you're experiencing a ${issueType} issue. This has been classified as a ${priority} priority.

Let me search our knowledge base for relevant solutions and check your account status to better assist you.`;

      case 3:
        if (context.success) {
          return `Great! I've found a solution for your issue. Here's what you need to do:

${context.resolutionMethod}

Please try this solution and let me know if it resolves your problem. If you encounter any issues or need clarification, I'm here to help!`;
        } else {
          return `I've attempted to resolve your issue, but it seems more complex than initially thought. Let me escalate this to our senior support team who will be able to provide more specialized assistance.

In the meantime, I've created a support ticket for you. You'll receive an email confirmation with the ticket number and next steps.`;
        }

      case 4:
        return `I understand this issue requires specialized attention. I've escalated your case to our senior support team. Here's what happens next:

1. A senior support agent will review your case within 2-4 hours
2. You'll receive an email with the escalation details
3. The senior agent will contact you directly to resolve the issue

Your ticket number is: ${this.generateTicketNumber()}

Is there anything else I can help you with while you wait?`;

      case 5:
        return `Perfect! I'm glad we could help resolve your issue. 

To ensure we're providing the best support possible, could you rate your satisfaction with this interaction on a scale of 1-10? Also, feel free to share any additional feedback about your experience.

Is there anything else you need assistance with today?`;

      default:
        return `Thank you for contacting Twenty CRM support. I'm here to help with any questions or issues you may have.`;
    }
  }

  private diagnoseIssue(content: string): any {
    const lowerContent = content.toLowerCase();
    
    // Determine issue type
    let type = 'general';
    if (lowerContent.includes('login') || lowerContent.includes('password') || lowerContent.includes('auth')) {
      type = 'authentication';
    } else if (lowerContent.includes('data') || lowerContent.includes('import') || lowerContent.includes('export')) {
      type = 'data';
    } else if (lowerContent.includes('api') || lowerContent.includes('integration')) {
      type = 'integration';
    } else if (lowerContent.includes('performance') || lowerContent.includes('slow')) {
      type = 'performance';
    } else if (lowerContent.includes('billing') || lowerContent.includes('payment')) {
      type = 'billing';
    }

    // Determine priority
    let priority = 'medium';
    if (lowerContent.includes('urgent') || lowerContent.includes('critical') || lowerContent.includes('broken')) {
      priority = 'high';
    } else if (lowerContent.includes('minor') || lowerContent.includes('question')) {
      priority = 'low';
    }

    return {
      type,
      priority,
      symptoms: this.extractSymptoms(content),
    };
  }

  private extractSymptoms(content: string): string[] {
    const symptoms = [];
    const lowerContent = content.toLowerCase();
    
    if (lowerContent.includes('error')) symptoms.push('error_message');
    if (lowerContent.includes('crash')) symptoms.push('application_crash');
    if (lowerContent.includes('slow')) symptoms.push('performance_issue');
    if (lowerContent.includes('not working')) symptoms.push('functionality_broken');
    if (lowerContent.includes('can\'t access')) symptoms.push('access_denied');
    
    return symptoms;
  }

  private async attemptResolution(content: string, context: any): Promise<any> {
    const issueType = context.issueType;
    
    // Simple resolution logic based on issue type
    switch (issueType) {
      case 'authentication':
        return {
          success: true,
          method: 'Please try clearing your browser cache and cookies, then log in again. If the issue persists, you can reset your password using the "Forgot Password" link.',
        };
      case 'data':
        return {
          success: true,
          method: 'For data import/export issues, please check that your file format is supported (CSV, JSON) and that the file size is under 10MB. You can find detailed instructions in our documentation.',
        };
      case 'performance':
        return {
          success: false,
          method: 'Performance issues require investigation of your specific setup and usage patterns.',
        };
      default:
        return {
          success: false,
          method: 'This issue requires specialized investigation.',
        };
    }
  }

  private determineEscalationReason(content: string): string {
    const lowerContent = content.toLowerCase();
    
    if (lowerContent.includes('complex') || lowerContent.includes('advanced')) {
      return 'complex_technical_issue';
    } else if (lowerContent.includes('urgent') || lowerContent.includes('critical')) {
      return 'high_priority_escalation';
    } else if (lowerContent.includes('billing') || lowerContent.includes('account')) {
      return 'account_management_issue';
    }
    
    return 'general_escalation';
  }

  private generateTicketNumber(): string {
    return `TKT-${Date.now().toString().slice(-6)}`;
  }

  private async searchKnowledgeBase(query: string): Promise<any[]> {
    // Mock knowledge base search
    return [
      {
        id: 'kb-001',
        title: 'How to reset your password',
        relevance: 0.9,
        url: '/help/reset-password',
      },
      {
        id: 'kb-002',
        title: 'Data import troubleshooting',
        relevance: 0.8,
        url: '/help/data-import',
      },
    ];
  }

  private async createTicket(description: string): Promise<any> {
    return {
      id: this.generateTicketNumber(),
      status: 'open',
      priority: 'medium',
      createdAt: new Date().toISOString(),
      description,
    };
  }

  private async checkAccountStatus(userId: string): Promise<any> {
    return {
      status: 'active',
      plan: 'pro',
      lastLogin: new Date().toISOString(),
      issues: [],
    };
  }

  private async escalateIssue(description: string): Promise<any> {
    return {
      escalated: true,
      escalationId: `ESC-${Date.now().toString().slice(-6)}`,
      assignedTo: 'senior-support',
      estimatedResponse: '2-4 hours',
    };
  }
}
