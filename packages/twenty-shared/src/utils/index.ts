/*
 * _____                    _
 *|_   _|_      _____ _ __ | |_ _   _
 *  | | \ \ /\ / / _ \ '_ \| __| | | | Auto-generated file
 *  | |  \ V  V /  __/ | | | |_| |_| | Any edits to this will be overridden
 *  |_|   \_/\_/ \___|_| |_|\__|\__, |
 *                              |___/
 */

export { assertUnreachable } from './assertUnreachable';
export { deepMerge } from './deepMerge';
export { extractAndSanitizeObjectStringFields } from './extractAndSanitizeObjectStringFields';
export { isFieldMetadataDateKind } from './fieldMetadata/isFieldMetadataDateKind';
export { fromArrayToUniqueKeyRecord } from './from-array-to-unique-key-record.util';
export { fromArrayToValuesByKeyRecord } from './fromArrayToValuesByKeyRecord.util';
export { getURLSafely } from './getURLSafely';
export { getImageAbsoluteURI } from './image/getImageAbsoluteURI';
export {
  sanitizeURL,
  getLogoUrlFromDomainName,
} from './image/getLogoUrlFromDomainName';
export { getUniqueConstraintsFields } from './indexMetadata/getUniqueConstraintsFields';
export {
  InvariantError,
  invariant,
  debug,
  log,
  warn,
  error,
  setVerbosity,
  getVerbosity,
} from './invariant';
export type {
  VerbosityLevel,
  ConsoleMethodName,
  ErrorCategory,
  ValidationErrorCode,
  AuthenticationErrorCode,
  DatabaseErrorCode,
  BusinessLogicErrorCode,
  SystemErrorCode,
  KnownErrorCode,
  InvariantMessage,
  InvariantConfig,
  ErrorContext,
  ErrorReportingOptions,
  AssertFunction,
  SafeAssertFunction,
  LoggingFunction,
  Logger,
  ErrorHandler,
  ErrorRecoveryFunction,
  MigrationOptions,
  ValidationResult,
  ErrorCodeGuard,
  ErrorCodeMapper,
  EnvironmentConfig,
  PerformanceMetrics,
  InvariantHookOptions,
  ErrorInfo,
  ErrorBoundaryProps,
  ExceptionFilterOptions,
  Optional,
  DeepReadonly,
  ValidatedErrorCode,
  FormattedMessage,
} from './invariant/types';
export { verbosityLevels, ERROR_CODE_RANGES } from './invariant/types';
export type { LegacyAssertFunction } from './migration';
export {
  legacyAssert,
  enhancedAssert,
  migrateToInvariant,
  validateCondition,
  createErrorCodeMigrator,
  batchMigrate,
  typeSafeMigrate,
} from './migration';
export { parseJson } from './parseJson';
export { removePropertiesFromRecord } from './removePropertiesFromRecord';
export { removeUndefinedFields } from './removeUndefinedFields';
export { getGenericOperationName } from './sentry/getGenericOperationName';
export { getHumanReadableNameFromCode } from './sentry/getHumanReadableNameFromCode';
export { capitalize } from './strings/capitalize';
export type { StringPropertyKeys } from './trim-and-remove-duplicated-whitespaces-from-object-string-properties';
export { trimAndRemoveDuplicatedWhitespacesFromObjectStringProperties } from './trim-and-remove-duplicated-whitespaces-from-object-string-properties';
export { trimAndRemoveDuplicatedWhitespacesFromString } from './trim-and-remove-duplicated-whitespaces-from-string';
export { absoluteUrlSchema } from './url/absoluteUrlSchema';
export { buildSignedPath } from './url/buildSignedPath';
export { getAbsoluteUrl } from './url/getAbsoluteUrl';
export { getAbsoluteUrlOrThrow } from './url/getAbsoluteUrlOrThrow';
export { getUrlHostnameOrThrow } from './url/getUrlHostnameOrThrow';
export { isValidHostname } from './url/isValidHostname';
export { isValidUrl } from './url/isValidUrl';
export { lowercaseUrlOriginAndRemoveTrailingSlash } from './url/lowercaseUrlOriginAndRemoveTrailingSlash';
export { uuidToBase36 } from './uuidToBase36';
export { isDefined } from './validation/isDefined';
export { isLabelIdentifierFieldMetadataTypes } from './validation/isLabelIdentifierFieldMetadataTypes';
export { isValidLocale } from './validation/isValidLocale';
export { isValidUuid } from './validation/isValidUuid';
export { isValidVariable } from './validation/isValidVariable';
export { normalizeLocale } from './validation/normalizeLocale';
export { getCountryCodesForCallingCode } from './validation/phones-value/getCountryCodesForCallingCode';
export { isValidCountryCode } from './validation/phones-value/isValidCountryCode';
export { resolveInput } from './variable-resolver';
