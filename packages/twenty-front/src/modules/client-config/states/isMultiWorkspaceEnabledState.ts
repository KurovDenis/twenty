import { createState } from 'twenty-ui/utilities';
export const isMultiWorkspaceEnabledState = createState<boolean>({
  key: 'isMultiWorkspaceEnabled',
  defaultValue: false,
});

export const singleWorkspaceBehaviorState = createState<'auto-redirect' | 'create-new' | 'show-choice'>({
  key: 'singleWorkspaceBehavior',
  defaultValue: 'auto-redirect',
});
