import { getTokenPair } from '@/apollo/utils/getTokenPair';
import { useRedirectToWorkspaceDomain } from '@/domain-manager/hooks/useRedirectToWorkspaceDomain';
import { AppPath } from '@/types/AppPath';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { ApolloError } from '@apollo/client';
import { useSignUpInNewWorkspaceMutation } from '~/generated-metadata/graphql';
import { getWorkspaceUrl } from '~/utils/getWorkspaceUrl';

export const useSignUpInNewWorkspace = () => {
  const { redirectToWorkspaceDomain } = useRedirectToWorkspaceDomain();
  const { enqueueErrorSnackBar } = useSnackBar();

  const [signUpInNewWorkspaceMutation] = useSignUpInNewWorkspaceMutation();

  const createWorkspace = async ({ newTab, maxRetries = 3 } = { newTab: true, maxRetries: 3 }) => {
    console.log('[Workspace Creation] Starting workspace creation process');
    console.log('[Workspace Creation] Parameters:', { newTab, maxRetries });
    
    // Check if user has valid tokens before attempting
    const tokenPair = getTokenPair();
    console.log('[Workspace Creation] Token pair:', { 
      hasAccessToken: !!tokenPair?.accessOrWorkspaceAgnosticToken?.token,
      tokenType: tokenPair?.accessOrWorkspaceAgnosticToken?.token ? 'present' : 'missing'
    });
    
    if (!tokenPair?.accessOrWorkspaceAgnosticToken?.token) {
      const error = new Error('No valid authentication token found');
      console.error('[Workspace Creation] Authentication error:', error);
      enqueueErrorSnackBar({ 
        message: 'Authentication required. Please sign in again.'
      });
      throw error;
    }
    
    console.log('[Workspace Creation] Token validation passed');
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[Workspace Creation] Attempt ${attempt}/${maxRetries}`);
        console.log('[Workspace Creation] Using token:', tokenPair.accessOrWorkspaceAgnosticToken.token.substring(0, 20) + '...');
        
        return await new Promise<void>((resolve, reject) => {
          signUpInNewWorkspaceMutation({
            onCompleted: async (data) => {
              try {
                console.log('[Workspace Creation] Success, redirecting to workspace');
                await redirectToWorkspaceDomain(
                  getWorkspaceUrl(data.signUpInNewWorkspace.workspace.workspaceUrls),
                  AppPath.Verify,
                  {
                    loginToken: data.signUpInNewWorkspace.loginToken.token,
                  },
                  newTab ? '_blank' : '_self',
                );
                resolve();
              } catch (error) {
                console.error('[Workspace Creation] Redirect failed:', error);
                reject(error);
              }
            },
            onError: (error: ApolloError) => {
              console.error(`[Workspace Creation] Attempt ${attempt} failed:`, error);
              console.error('[Workspace Creation] Error details:', {
                message: error.message,
                graphQLErrors: error.graphQLErrors,
                networkError: error.networkError,
                extensions: error.graphQLErrors?.[0]?.extensions
              });
              
              // Log the specific error code and message for debugging
              if (error.graphQLErrors?.[0]) {
                const graphQLError = error.graphQLErrors[0];
                console.error('[Workspace Creation] GraphQL Error Code:', graphQLError.extensions?.code);
                console.error('[Workspace Creation] GraphQL Error Message:', graphQLError.message);
                console.error('[Workspace Creation] User Friendly Message:', graphQLError.extensions?.userFriendlyMessage);
              }
              
              // Handle workspace limit errors specifically
              if (error.graphQLErrors?.[0]?.extensions?.code === 'SIGNUP_DISABLED') {
                console.error('[Workspace Creation] Workspace limit reached');
                const graphQLError = error.graphQLErrors[0];
                const userFriendlyMessage: string = 
                  (graphQLError?.extensions?.userFriendlyMessage as string) || 
                  graphQLError?.message || 
                  'You have reached the maximum number of workspaces allowed.';
                enqueueErrorSnackBar({ 
                  message: userFriendlyMessage
                });
                reject(error);
                return;
              }
              
              // Handle any server errors with better messages
              if (error.graphQLErrors?.[0]?.extensions?.code === 'INTERNAL_SERVER_ERROR') {
                console.error('[Workspace Creation] Internal server error detected');
                enqueueErrorSnackBar({ 
                  message: 'Server error occurred. Please try again or check server logs.'
                });
                reject(error);
                return;
              }
              
              // Handle authentication/forbidden errors
              if (error.message === 'Forbidden resource' || 
                  error.graphQLErrors?.[0]?.extensions?.code === 'FORBIDDEN' ||
                  error.graphQLErrors?.[0]?.extensions?.code === 'UNAUTHENTICATED') {
                console.error('[Workspace Creation] Authentication/authorization error detected');
                
                // For authentication errors, don't retry if it's not the first attempt
                if (attempt > 1) {
                  console.error('[Workspace Creation] Authentication error on retry, stopping');
                  enqueueErrorSnackBar({ 
                    message: 'Authentication failed. Please sign in again.'
                  });
                  reject(error);
                  return;
                }
              }
              
              reject(error);
            },
          });
        });
      } catch (error) {
        console.error(`[Workspace Creation] Attempt ${attempt} failed:`, error);
        console.error('[Workspace Creation] Error details:', error);
        
        if (attempt === maxRetries) {
          console.error('[Workspace Creation] All attempts failed');
          enqueueErrorSnackBar({ 
            message: 'Failed to create workspace. Please try again or contact support.'
          });
          throw error;
        }
        
        // For authentication errors, add a longer delay to allow token propagation
        const isAuthError = error instanceof ApolloError && (
          error.message === 'Forbidden resource' ||
          error.graphQLErrors?.[0]?.extensions?.code === 'FORBIDDEN' ||
          error.graphQLErrors?.[0]?.extensions?.code === 'UNAUTHENTICATED'
        );
        
        const delay = isAuthError ? 2000 : Math.pow(2, attempt) * 1000;
        console.log(`[Workspace Creation] Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    console.error('[Workspace Creation] All attempts failed');
    throw new Error('Workspace creation failed after all attempts');
  };

  return {
    createWorkspace,
  };
};
