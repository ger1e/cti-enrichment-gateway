const table = columns => Object.freeze([...new Set(columns)].sort((a, b) => a.localeCompare(b)));

export const MISSION_KQL_SCHEMA_VERSION = 'microsoft-hunt-schema-v1.0';

export const MISSION_KQL_SCHEMA = Object.freeze({
  DeviceProcessEvents: table([
    'Timestamp', 'DeviceId', 'DeviceName', 'ActionType', 'FileName', 'FolderPath', 'ProcessCommandLine', 'ProcessId',
    'SHA1', 'SHA256', 'MD5', 'AccountName', 'AccountDomain', 'InitiatingProcessFileName', 'InitiatingProcessFolderPath',
    'InitiatingProcessCommandLine', 'InitiatingProcessId', 'InitiatingProcessSHA1', 'InitiatingProcessSHA256', 'InitiatingProcessMD5',
    'InitiatingProcessAccountName', 'InitiatingProcessAccountDomain', 'ReportId',
  ]),
  DeviceNetworkEvents: table([
    'Timestamp', 'DeviceId', 'DeviceName', 'ActionType', 'RemoteIP', 'RemotePort', 'RemoteUrl', 'LocalIP', 'LocalPort',
    'Protocol', 'InitiatingProcessFileName', 'InitiatingProcessFolderPath', 'InitiatingProcessCommandLine', 'InitiatingProcessId',
    'InitiatingProcessSHA1', 'InitiatingProcessSHA256', 'InitiatingProcessMD5', 'InitiatingProcessAccountName',
    'InitiatingProcessAccountDomain', 'ReportId',
  ]),
  DeviceFileEvents: table([
    'Timestamp', 'DeviceId', 'DeviceName', 'ActionType', 'FileName', 'FolderPath', 'SHA1', 'SHA256', 'MD5', 'FileSize',
    'InitiatingProcessFileName', 'InitiatingProcessCommandLine', 'InitiatingProcessSHA1', 'InitiatingProcessSHA256',
    'InitiatingProcessAccountName', 'InitiatingProcessAccountDomain', 'ReportId',
  ]),
  DeviceRegistryEvents: table([
    'Timestamp', 'DeviceId', 'DeviceName', 'ActionType', 'RegistryKey', 'RegistryValueName', 'RegistryValueData', 'RegistryValueType',
    'InitiatingProcessFileName', 'InitiatingProcessCommandLine', 'InitiatingProcessSHA1', 'InitiatingProcessSHA256',
    'InitiatingProcessAccountName', 'InitiatingProcessAccountDomain', 'ReportId',
  ]),
  DeviceImageLoadEvents: table([
    'Timestamp', 'DeviceId', 'DeviceName', 'ActionType', 'FileName', 'FolderPath', 'SHA1', 'SHA256', 'MD5',
    'InitiatingProcessFileName', 'InitiatingProcessCommandLine', 'InitiatingProcessSHA1', 'InitiatingProcessSHA256', 'ReportId',
  ]),
  DeviceLogonEvents: table([
    'Timestamp', 'DeviceId', 'DeviceName', 'ActionType', 'LogonType', 'AccountName', 'AccountDomain', 'RemoteIP', 'RemoteDeviceName',
    'InitiatingProcessFileName', 'InitiatingProcessCommandLine', 'ReportId',
  ]),
  DeviceEvents: table([
    'Timestamp', 'DeviceId', 'DeviceName', 'ActionType', 'AccountName', 'AccountDomain', 'AdditionalFields',
    'InitiatingProcessFileName', 'InitiatingProcessCommandLine', 'InitiatingProcessSHA1', 'InitiatingProcessSHA256', 'ReportId',
  ]),
  SecurityEvent: table([
    'TimeGenerated', 'Computer', 'EventID', 'Activity', 'Account', 'AccountType', 'SubjectAccount', 'TargetAccount', 'IpAddress',
    'Process', 'CommandLine', 'ParentProcessName', 'LogonType', 'WorkstationName', 'SubjectUserName', 'TargetUserName',
  ]),
  WindowsEvent: table(['TimeGenerated', 'Computer', 'EventID', 'EventData', 'RenderedDescription', 'Provider', 'Channel']),
  IdentityLogonEvents: table([
    'Timestamp', 'ActionType', 'Application', 'LogonType', 'AccountName', 'AccountDomain', 'AccountUpn', 'DeviceName', 'IPAddress',
    'Location', 'Protocol', 'FailureReason',
  ]),
  IdentityDirectoryEvents: table([
    'Timestamp', 'ActionType', 'Application', 'AccountName', 'AccountDomain', 'AccountUpn', 'TargetAccountUpn', 'DeviceName', 'AdditionalFields',
  ]),
  EmailEvents: table([
    'Timestamp', 'NetworkMessageId', 'InternetMessageId', 'SenderFromAddress', 'SenderMailFromAddress', 'RecipientEmailAddress',
    'Subject', 'DeliveryAction', 'DeliveryLocation', 'ThreatTypes', 'ThreatNames', 'SenderIPv4', 'SenderIPv6', 'UrlCount', 'AttachmentCount',
  ]),
  EmailUrlInfo: table(['Timestamp', 'NetworkMessageId', 'Url', 'UrlDomain']),
  UrlClickEvents: table([
    'Timestamp', 'Url', 'AccountUpn', 'Workload', 'ActionType', 'IsClickedThrough', 'NetworkMessageId', 'IPAddress',
  ]),
  AADSignInEventsBeta: table([
    'Timestamp', 'AccountUpn', 'AccountObjectId', 'IPAddress', 'Application', 'ApplicationId', 'LogonType', 'ErrorCode', 'FailureReason',
    'RiskLevelAggregated', 'RiskState', 'ConditionalAccessStatus', 'DeviceName', 'Country', 'City', 'SessionId', 'UserAgent',
  ]),
  SigninLogs: table([
    'TimeGenerated', 'UserPrincipalName', 'UserId', 'IPAddress', 'AppDisplayName', 'AppId', 'ResultType', 'ResultDescription',
    'ConditionalAccessStatus', 'DeviceDetail', 'Location', 'LocationDetails', 'UserAgent', 'RiskLevelAggregated', 'RiskState',
    'AuthenticationRequirement', 'AuthenticationDetails', 'ClientAppUsed', 'CorrelationId',
  ]),
});
