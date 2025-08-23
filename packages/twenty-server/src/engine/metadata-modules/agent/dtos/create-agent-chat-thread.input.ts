import { Field, InputType } from '@nestjs/graphql';

import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';

@InputType()
export class CreateAgentChatThreadInput {
  @IsNotEmpty()
  @Field(() => UUIDScalarType)
  agentId: string;

  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  businessSetupStep?: string;
}
