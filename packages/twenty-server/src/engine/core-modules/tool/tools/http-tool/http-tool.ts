import { Injectable, Logger } from '@nestjs/common';

import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';

import axios, { type AxiosRequestConfig } from 'axios';

import { HttpToolParametersZodSchema } from 'src/engine/core-modules/tool/tools/http-tool/http-tool.schema';
import { type HttpRequestInput } from 'src/engine/core-modules/tool/tools/http-tool/types/http-request-input.type';
import { type ToolInput } from 'src/engine/core-modules/tool/types/tool-input.type';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';

@Injectable()
export class HttpTool implements Tool {
  private readonly logger = new Logger(HttpTool.name);

  description =
    'Make an HTTP request to any URL with configurable method, headers, and body.';
  parameters = HttpToolParametersZodSchema;

  async execute(parameters: ToolInput): Promise<ToolOutput> {
    const { url, method, headers, body } = parameters as HttpRequestInput;

    this.logger.debug(`Making ${method} request to: ${url}`);

    // Validate and correct Avito API URLs to prevent SSL certificate issues
    if (url.includes('avito.com') || url.includes('api.avito')) {
      // Correct any incorrect Avito URLs to use the proper Russian domain
      const correctedUrl = this.validateAndCorrectAvitoUrl(url);

      if (correctedUrl !== url) {
        this.logger.warn(`Corrected Avito URL from ${url} to ${correctedUrl}`);
      }
      this.logger.debug('Using direct Node.js HTTPS for Avito API');

      return this.executeWithNodeHttps(correctedUrl, method, headers, body);
    }

    try {
      const axiosConfig: AxiosRequestConfig = {
        url,
        method: method,
        headers,
        timeout: 30000, // 30 seconds timeout
        maxRedirects: 5, // Follow redirects
        validateStatus: (status) => status < 500, // Accept 4xx as valid responses
        // Configure SSL/TLS settings for better certificate handling
        httpsAgent: new https.Agent({
          rejectUnauthorized: true, // Keep security enabled
          servername: undefined, // Let Node.js determine from URL
        }),
      };

      if (['POST', 'PUT', 'PATCH'].includes(method) && body) {
        axiosConfig.data = body;
      }

      const response = await axios(axiosConfig);

      this.logger.debug(`Request completed with status: ${response.status}`);

      return { result: response.data };
    } catch (error) {
      this.logger.error(`HTTP request failed for ${url}:`, error.message);

      if (axios.isAxiosError(error)) {
        // Enhanced error handling for SSL/certificate issues
        if (error.code === 'CERT_HAS_EXPIRED') {
          return {
            error: 'SSL certificate has expired for the target server',
          };
        }

        if (error.code === 'ERR_TLS_CERT_ALTNAME_INVALID') {
          return {
            error: `SSL certificate hostname mismatch. Requested: ${url}, Error: ${error.message}`,
          };
        }

        return {
          error: error.response?.data || error.message || 'HTTP request failed',
        };
      }

      return {
        error: error instanceof Error ? error.message : 'HTTP request failed',
      };
    }
  }

  /**
   * Validate and correct Avito API URLs to prevent SSL certificate issues
   */
  private validateAndCorrectAvitoUrl(url: string): string {
    try {
      const parsedUrl = new URL(url);

      // Fix common Avito URL issues
      if (parsedUrl.hostname === 'api.avito.com') {
        parsedUrl.hostname = 'api.avito.ru';
      }

      // Ensure we're using the correct Avito API endpoints
      if (parsedUrl.hostname === 'api.avito.ru') {
        // Map common incorrect paths to correct ones
        if (parsedUrl.pathname.includes('/integrations/credentials')) {
          parsedUrl.pathname = '/token';
        }
        // Ensure we're using the token endpoint for OAuth
        if (!parsedUrl.pathname || parsedUrl.pathname === '/') {
          parsedUrl.pathname = '/token';
        }
      }

      return parsedUrl.toString();
    } catch (error) {
      this.logger.warn(
        `Could not parse URL ${url}, using as-is: ${error.message}`,
      );

      return url;
    }
  }

  /**
   * Direct Node.js HTTPS implementation for cases where axios has issues
   */
  private async executeWithNodeHttps(
    url: string,
    method: string,
    headers: Record<string, string> = {},
    body?: string | Record<string, unknown>,
  ): Promise<ToolOutput> {
    return new Promise((resolve) => {
      try {
        const parsedUrl = new URL(url);
        const isHttps = parsedUrl.protocol === 'https:';
        const httpModule = isHttps ? https : http;

        const options = {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || (isHttps ? 443 : 80),
          path: parsedUrl.pathname + parsedUrl.search,
          method: method.toUpperCase(),
          headers: {
            'User-Agent': 'Twenty CRM Avito Integration v1.0',
            ...headers,
          },
          timeout: 30000,
          // SSL/TLS options for better certificate handling
          rejectUnauthorized: true,
          servername: parsedUrl.hostname, // Ensure SNI is set correctly
        };

        this.logger.debug(
          `Direct HTTPS request to ${parsedUrl.hostname}:${options.port}${options.path}`,
        );

        const req = httpModule.request(options, (res) => {
          let data = '';

          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            try {
              const result = JSON.parse(data);

              this.logger.debug(
                `Direct HTTPS request completed with status: ${res.statusCode}`,
              );
              resolve({ result });
            } catch (parseError) {
              this.logger.debug(
                `Direct HTTPS request completed with non-JSON response: ${data}`,
              );
              resolve({ result: data });
            }
          });
        });

        req.on('error', (error) => {
          this.logger.error(`Direct HTTPS request failed:`, error.message);
          resolve({
            error: `Direct HTTPS request failed: ${error.message}`,
          });
        });

        req.on('timeout', () => {
          this.logger.error('Direct HTTPS request timed out');
          req.destroy();
          resolve({
            error: 'Request timed out after 30 seconds',
          });
        });

        // Write body data if present
        if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) && body) {
          req.write(typeof body === 'string' ? body : JSON.stringify(body));
        }

        req.end();
      } catch (error) {
        this.logger.error('Failed to create direct HTTPS request:', error);
        resolve({
          error: `Failed to create request: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    });
  }
}
