import { expect, test } from '@playwright/test';

/**
 * End-to-end test for Business Setup with SGR Streaming
 * 
 * This test validates the complete user journey from creating a new business setup chat
 * through providing Avito credentials to successful validation with real-time SGR streaming.
 */
test('Business Setup with SGR Streaming', async ({ page }) => {
  const validClientId = 'R3cTDMk9rEJ2lh5A9_QF';
  const validClientSecret = 'ehAWb-RBQrLmgoJWfgtst737eQV6KIBHzmV1NmIc';

  // Navigate to the application
  await page.goto('/');

  // Navigate to the business setup section
  // Note: This path may need to be adjusted based on the actual routing
  await page.goto('/business-setup');

  // Wait for the chat interface to load
  await page.waitForSelector('[data-testid="ai-chat-container"]', { timeout: 10000 });

  // Verify that no automatic welcome message is present
  const initialMessages = await page.locator('[data-testid="ai-chat-message"]').count();
  expect(initialMessages).toBe(0);

  // User sends a message with Avito credentials
  const chatInput = page.getByTestId('ai-chat-input');
  await chatInput.fill(`
Привет! Вот мои данные для Avito:
CLIENT_ID = '${validClientId}'
CLIENT_SECRET = '${validClientSecret}'
`);
  
  const sendButton = page.getByTestId('send-message-button');
  await sendButton.click();

  // Wait for the SGR streaming to begin
  await page.waitForSelector('[data-testid="sgr-progress-indicator"]', { timeout: 5000 });

  // Verify that SGR progress indicator is visible
  const progressIndicator = page.getByTestId('sgr-progress-indicator');
  await expect(progressIndicator).toBeVisible();

  // Wait for the streaming to complete
  await page.waitForSelector('[data-testid="sgr-progress-indicator"]', { 
    state: 'detached', 
    timeout: 15000 
  });

  // Verify that multiple messages were received showing the SGR process
  const messagesAfterStreaming = await page.locator('[data-testid="ai-chat-message"]').count();
  expect(messagesAfterStreaming).toBeGreaterThan(2); // At least thinking, tool execution, and final response

  // Verify that thinking messages are present
  const thinkingMessages = page.locator('[data-testid="ai-chat-message"]', {
    hasText: 'Анализ'
  });
  await expect(thinkingMessages.first()).toBeVisible();

  // Verify that tool execution messages are present
  const toolExecutionMessages = page.locator('[data-testid="ai-chat-message"]', {
    hasText: 'Выполняю'
  });
  await expect(toolExecutionMessages.first()).toBeVisible();

  // Verify that success message is present
  const successMessage = page.locator('[data-testid="ai-chat-message"]', {
    hasText: '✅'
  });
  await expect(successMessage).toBeVisible();

  // Verify that the chat shows the complete process
  const finalMessage = page.locator('[data-testid="ai-chat-message"]').last();
  await expect(finalMessage).toContainText('успешно');
});

test('Business Setup with Invalid Credentials', async ({ page }) => {
  const invalidClientId = 'invalid_client_id';
  const invalidClientSecret = 'invalid_client_secret';

  // Navigate to the application
  await page.goto('/');

  // Navigate to the business setup section
  await page.goto('/business-setup');

  // Wait for the chat interface to load
  await page.waitForSelector('[data-testid="ai-chat-container"]', { timeout: 10000 });

  // User sends a message with invalid Avito credentials
  const chatInput = page.getByTestId('ai-chat-input');
  await chatInput.fill(`
CLIENT_ID = '${invalidClientId}'
CLIENT_SECRET = '${invalidClientSecret}'
`);
  
  const sendButton = page.getByTestId('send-message-button');
  await sendButton.click();

  // Wait for processing
  await page.waitForTimeout(5000);

  // Verify that error message is present
  const errorMessage = page.locator('[data-testid="ai-chat-message"]', {
    hasText: '❌'
  });
  await expect(errorMessage).toBeVisible();

  // Verify that the chat shows the error handling
  const lastMessage = page.locator('[data-testid="ai-chat-message"]').last();
  await expect(lastMessage).toContainText('ошибка');
});