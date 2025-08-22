import { Field, InputType } from '@nestjs/graphql';
import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

@InputType()
export class ChatContinuationInput {
  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  threadId: string;

  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  message: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  context?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  fileIds?: string[];
}

@InputType()
export class BusinessSetupTransitionInput {
  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  fromStep: string;

  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  toStep: string;

  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  reason: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  context?: string;
}
