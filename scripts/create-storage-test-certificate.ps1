param([string]$OutputPath = 'work/storage-concurrency-tls/localhost-test.pfx')
$ErrorActionPreference = 'Stop'
# Standalone test credential only. No system certificate store is read or changed.
$resolvedOutput = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $OutputPath))
[System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($resolvedOutput)) | Out-Null
$keyPair = [System.Security.Cryptography.RSA]::Create(2048)
try {
  $request = [System.Security.Cryptography.X509Certificates.CertificateRequest]::new('CN=localhost', $keyPair, [System.Security.Cryptography.HashAlgorithmName]::SHA256, [System.Security.Cryptography.RSASignaturePadding]::Pkcs1)
  $names = [System.Security.Cryptography.X509Certificates.SubjectAlternativeNameBuilder]::new()
  $names.AddDnsName('localhost')
  $names.AddIpAddress([System.Net.IPAddress]::Loopback)
  $request.CertificateExtensions.Add($names.Build())
  $certificate = $request.CreateSelfSigned([System.DateTimeOffset]::Now.AddMinutes(-1), [System.DateTimeOffset]::Now.AddDays(1))
  try { [System.IO.File]::WriteAllBytes($resolvedOutput, $certificate.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Pfx, 'local-concurrency-test')) }
  finally { $certificate.Dispose() }
  Write-Output "Created local test PFX: $resolvedOutput"
  Write-Output 'REFINEMENT_TLS_PASSPHRASE=local-concurrency-test; no system certificate installed.'
} finally { $keyPair.Dispose() }
