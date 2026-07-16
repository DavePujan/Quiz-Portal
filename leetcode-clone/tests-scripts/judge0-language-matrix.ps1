$tests = @(
  @{ key = 'c'; id = 50; code = @'
#include <stdio.h>
int main(){ puts("2"); return 0; }
'@ },
  @{ key = 'cpp'; id = 54; code = @'
#include <bits/stdc++.h>
using namespace std;
int main(){ cout << 2 << endl; return 0; }
'@ },
  @{ key = 'java'; id = 62; code = @'
class Main {
  public static void main(String[] args){
    System.out.println(2);
  }
}
'@ },
  @{ key = 'javascript'; id = 63; code = @'
console.log(2)
'@ },
  @{ key = 'python'; id = 71; code = @'
print(2)
'@ }
)

$results = @()
foreach ($t in $tests) {
  $body = @{ source_code = $t.code; language_id = $t.id; stdin = '' } | ConvertTo-Json -Depth 6
  try {
    $res = Invoke-RestMethod -Uri 'http://localhost:2358/submissions?base64_encoded=false&wait=true' -Method Post -ContentType 'application/json' -Body $body
    $results += [pscustomobject]@{
      language = $t.key
      language_id = $t.id
      status_id = $res.status.id
      status = $res.status.description
      message = $res.message
      compile_output = $res.compile_output
      passed = ($res.status.id -eq 3)
    }
  } catch {
    $results += [pscustomobject]@{
      language = $t.key
      language_id = $t.id
      status_id = $null
      status = 'RequestError'
      message = $_.Exception.Message
      compile_output = $null
      passed = $false
    }
  }
}

$validated = $results | Where-Object { $_.passed } | Select-Object -ExpandProperty language

[pscustomobject]@{
  validated_languages = $validated
  results = $results
} | ConvertTo-Json -Depth 8
