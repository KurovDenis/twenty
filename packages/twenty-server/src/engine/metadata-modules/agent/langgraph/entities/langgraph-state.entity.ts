import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { AgentState } from '@twenty/shared/langgraph/types';

@Entity('langgraph_state')
export class LangGraphStateEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  threadId: string;

  @Column('uuid')
  agentId: string;

  @Column('uuid')
  workspaceId: string;

  @Column({ type: 'jsonb' })
  state: AgentState;

  @Column({ type: 'jsonb', nullable: true })
  longTermMemory: {
    userPreferences: Record<string, any>;
    conversationHistory: Array<{
      timestamp: Date;
      summary: string;
      keyInsights: string[];
    }>;
    learningData: {
      lastInteraction: Date;
      totalInteractions: number;
    };
  };

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  expiresAt: Date;
}
