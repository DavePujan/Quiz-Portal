const TYPE_CAPABILITIES = {
    int: true,
    long: true,
    float: true,
    double: true,
    bool: true,
    char: true,
    string: true,
    "int[]": true,
    "char[]": true,
    "string[]": true
};

function normalizeLanguage(language) {
    const normalized = String(language || "").trim().toLowerCase();
    if (normalized === "js") return "javascript";
    if (normalized === "py") return "python";
    return normalized;
}

function sanitizeFunctionName(functionName) {
    const candidate = String(functionName || "").trim();
    if (!candidate) return "";
    return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(candidate) ? candidate : "";
}

function extractFunctionNameFromCode(code, language) {
    const source = String(code || "");
    const normalized = normalizeLanguage(language);

    if (normalized === "javascript") {
        const match = source.match(/function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/) || source.match(/const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s*)?\(/) || source.match(/let\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s*)?\(/) || source.match(/var\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s*)?\(/);
        return sanitizeFunctionName(match?.[1]) || "solution";
    }
    if (normalized === "python") {
        const match = source.match(/def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/);
        return sanitizeFunctionName(match?.[1]) || "solution";
    }
    if (normalized === "cpp" || normalized === "c") {
        const match = source.match(/(?:int|long|double|float|auto|void|string|char|bool|vector<.*>)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/);
        return sanitizeFunctionName(match?.[1]) || "solution";
    }
    if (normalized === "java") {
        const match = source.match(/(?:public|private|protected)?\s*(?:static\s+)?(?:int|long|double|float|String|char|boolean|void|int\[\]|String\[\]|char\[\])\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/);
        return sanitizeFunctionName(match?.[1]) || "solution";
    }
    if (normalized === "php") {
        const match = source.match(/function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/);
        return sanitizeFunctionName(match?.[1]) || "solution";
    }
    return "solution";
}

function resolveFunctionName({ functionName, code, language }) {
    // Priority: User's code > DB specified function > "solution"
    return extractFunctionNameFromCode(code, language) || sanitizeFunctionName(functionName) || "solution";
}

function normalizeInputFormat(rawInput) {
    if (!rawInput) return "";
    return rawInput.split(/\r?\n/).map(line => {
        const trimmed = line.trim();
        if (!trimmed) return "";
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
                return parsed.flat(Infinity).join(" ");
            } else if (typeof parsed === "string") {
                return parsed;
            }
            return String(parsed);
        } catch {
            return line;
        }
    }).join("\n");
}

function buildWrappedCode(code, language, functionName, input = "", signature = null) {
    const normalizedInput = normalizeInputFormat(input);
    const normalized = normalizeLanguage(language);
    const resolvedFunctionName = resolveFunctionName({ functionName, code, language: normalized });
    const fnLiteral = JSON.stringify(resolvedFunctionName);
    const inputLiteral = JSON.stringify(String(normalizedInput || ""));

    // Default basic signature if missing (for backwards compatibility)
    if (!signature) {
        signature = {
            params: [{ name: "a", type: "int" }, { name: "b", type: "int" }],
            returnType: "int"
        };
    }

    const { params, returnType } = signature;
    const isSingleString = params.length === 1 && params[0].type === "string";

    if (normalized === "javascript") {
        let readCode = `const __lines = input.split(/\\r?\\n/);\nconst args = [];\n` + params.map((p, i) => {
            let lineVar = `__line_${i}`;
            let extract = `const ${lineVar} = __lines.length > ${i} ? __lines[${i}].trim() : "";\n`;
            if (p.type === 'int' || p.type === 'long' || p.type === 'float' || p.type === 'double') {
                extract += `args.push(Number(${lineVar}));`;
            } else if (p.type === 'bool') {
                extract += `args.push(${lineVar} === 'true');`;
            } else if (p.type === 'string' || p.type === 'char') {
                extract += `args.push(__lines.length > ${i} ? __lines[${i}] : "");`; // keep original whitespace!
            } else if (p.type === 'int[]' || p.type === 'long[]' || p.type === 'float[]' || p.type === 'double[]') {
                extract += `args.push(${lineVar} ? ${lineVar}.split(/\\s+/).map(Number) : []);`;
            } else if (p.type === 'string[]' || p.type === 'char[]') {
                extract += `args.push(${lineVar} ? ${lineVar}.split(/\\s+/) : []);`;
            } else {
                extract += `args.push(${lineVar});`;
            }
            return extract;
        }).join("\n");

        let printCode = returnType.endsWith("[]") && returnType !== "char[]" 
            ? `console.log(Array.isArray(result) ? result.join(" ") : result);`
            : returnType === "char[]"
                ? `console.log(Array.isArray(result) ? result.join("") : result);`
                : `console.log(result);`;

        return `
const input = ${inputLiteral};

${code}

try {
  ${readCode}
  
  const candidate = typeof ${resolvedFunctionName} === "function"
    ? ${resolvedFunctionName}
    : typeof globalThis[${fnLiteral}] === "function"
      ? globalThis[${fnLiteral}]
      : null;

  if (!candidate) {
    throw new Error("Function " + ${fnLiteral} + " not found");
  }

  const result = candidate(...args);
  ${printCode}
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
`;
    }

    if (normalized === "python") {
        let readCode = `__lines = input_data_raw.split('\\n')\n    args = []\n    ` + params.map((p, i) => {
            let lineVar = `__line_${i}`;
            let extract = `${lineVar} = __lines[${i}].strip() if len(__lines) > ${i} else ""\n    `;
            if (p.type === 'int' || p.type === 'long') extract += `args.append(int(${lineVar}) if ${lineVar} else 0)`;
            else if (p.type === 'float' || p.type === 'double') extract += `args.append(float(${lineVar}) if ${lineVar} else 0.0)`;
            else if (p.type === 'bool') extract += `args.append(${lineVar} == 'true' if ${lineVar} else False)`;
            else if (p.type === 'string' || p.type === 'char') extract += `args.append(__lines[${i}] if len(__lines) > ${i} else "")`;
            else if (p.type === 'int[]' || p.type === 'long[]') extract += `args.append([int(x) for x in ${lineVar}.split()] if ${lineVar} else [])`;
            else if (p.type === 'string[]' || p.type === 'char[]') extract += `args.append(${lineVar}.split() if ${lineVar} else [])`;
            else extract += `args.append(${lineVar})`;
            return extract;
        }).join("\n    ");

        let printCode = returnType.endsWith("[]") && returnType !== "char[]"
            ? `print(" ".join(map(str, result)) if isinstance(result, list) else result)`
            : returnType === "char[]"
                ? `print("".join(map(str, result)) if isinstance(result, list) else result)`
                : `print(str(result).lower() if isinstance(result, bool) else result)`;

        return `
import sys

${code}

try:
    input_data_raw = ${inputLiteral}
    ${readCode}
    
    fn = globals().get(${fnLiteral})
    if fn is None:
        raise Exception("Function " + ${fnLiteral} + " not found")
    
    result = fn(*args)
    ${printCode}
except Exception as err:
    print(err, file=sys.stderr)
    sys.exit(1)
`;
    }

    if (normalized === "java") {
        let readCode = `String[] __lines = __input.split("\\\\r?\\\\n");\n            ` + params.map((p, i) => {
            let lineVar = `__line_${i}`;
            let extract = `String ${lineVar} = __lines.length > ${i} ? __lines[${i}].trim() : "";\n            `;
            if (p.type === 'int') extract += `int p${i} = ${lineVar}.isEmpty() ? 0 : Integer.parseInt(${lineVar});`;
            else if (p.type === 'long') extract += `long p${i} = ${lineVar}.isEmpty() ? 0L : Long.parseLong(${lineVar});`;
            else if (p.type === 'float') extract += `float p${i} = ${lineVar}.isEmpty() ? 0.0f : Float.parseFloat(${lineVar});`;
            else if (p.type === 'double') extract += `double p${i} = ${lineVar}.isEmpty() ? 0.0 : Double.parseDouble(${lineVar});`;
            else if (p.type === 'bool') extract += `boolean p${i} = ${lineVar}.equals("true");`;
            else if (p.type === 'string') extract += `String p${i} = __lines.length > ${i} ? __lines[${i}] : "";`;
            else if (p.type === 'char') extract += `char p${i} = __lines.length > ${i} && !__lines[${i}].isEmpty() ? __lines[${i}].charAt(0) : ' ';`;
            else if (p.type === 'int[]') extract += `String[] __toks${i} = ${lineVar}.isEmpty() ? new String[0] : ${lineVar}.split("\\\\s+");\n            int[] p${i} = new int[__toks${i}.length];\n            for(int j=0; j<__toks${i}.length; j++) p${i}[j] = Integer.parseInt(__toks${i}[j]);`;
            else if (p.type === 'long[]') extract += `String[] __toks${i} = ${lineVar}.isEmpty() ? new String[0] : ${lineVar}.split("\\\\s+");\n            long[] p${i} = new long[__toks${i}.length];\n            for(int j=0; j<__toks${i}.length; j++) p${i}[j] = Long.parseLong(__toks${i}[j]);`;
            else if (p.type === 'string[]') extract += `String[] p${i} = ${lineVar}.isEmpty() ? new String[0] : ${lineVar}.split("\\\\s+");`;
            else if (p.type === 'char[]') extract += `String[] __toks${i} = ${lineVar}.isEmpty() ? new String[0] : ${lineVar}.split("\\\\s+");\n            char[] p${i} = new char[__toks${i}.length];\n            for(int j=0; j<__toks${i}.length; j++) p${i}[j] = __toks${i}[j].charAt(0);`;
            else extract += `String p${i} = ${lineVar};`;
            return extract;
        }).join("\n            ");
            
        let invokeArgs = params.map((_, i) => `p${i}`).join(", ");
        
        let printCode = returnType === "int[]" || returnType === "long[]" || returnType === "double[]" || returnType === "float[]"
            ? `if (result != null) { for(int i=0; i<result.length; i++) System.out.print(result[i] + (i == result.length-1 ? "" : " ")); }`
            : returnType === "string[]"
                ? `if (result != null) { for(int i=0; i<result.length; i++) System.out.print(result[i] + (i == result.length-1 ? "" : " ")); }`
                : returnType === "char[]"
                    ? `if (result != null) { System.out.print(new String(result)); }`
                    : `System.out.print(result);`;

        let javaRetType = returnType;
        if (javaRetType === 'string') javaRetType = 'String';
        if (javaRetType === 'string[]') javaRetType = 'String[]';
        if (javaRetType === 'bool') javaRetType = 'boolean';
        if (javaRetType === 'bool[]') javaRetType = 'boolean[]';

        return `
import java.util.*;

public class Main {
${code}

    public static void main(String[] args) {
        try {
            String __input = ${inputLiteral};
            ${readCode}
            
            ${javaRetType === 'void' ? '' : javaRetType + ' result = '} ${resolvedFunctionName}(${invokeArgs});
            ${javaRetType === 'void' ? '' : printCode}
        } catch (Exception e) {
            System.err.println(e.getMessage());
            System.exit(1);
        }
    }
}
`;
    }

    if (normalized === "cpp") {
        let readCode = `vector<string> __lines;\n        string __ln;\n        stringstream __ins(__input);\n        while(getline(__ins, __ln)) { __lines.push_back(__ln); }\n        ` + params.map((p, i) => {
            let lineVar = `__line_${i}`;
            let extract = `string ${lineVar} = __lines.size() > ${i} ? __lines[${i}] : "";\n        `;
            let strCopy = `string __orig_${i} = ${lineVar};\n        `;
            extract += strCopy + `if(!${lineVar}.empty()) { ${lineVar}.erase(0, ${lineVar}.find_first_not_of(" \\t\\r\\n")); ${lineVar}.erase(${lineVar}.find_last_not_of(" \\t\\r\\n") + 1); }\n        `;
            
            let cppType = p.type;
            if (cppType === 'int') cppType = 'int';
            if (cppType === 'long') cppType = 'long long';
            if (cppType === 'string') cppType = 'string';
            if (cppType === 'char') cppType = 'char';
            if (cppType === 'bool') cppType = 'bool';
            if (cppType === 'float') cppType = 'float';
            if (cppType === 'double') cppType = 'double';
            
            if (p.type.endsWith('[]')) {
                let baseType = p.type.replace('[]', '');
                if (baseType === 'long') baseType = 'long long';
                if (baseType === 'string') baseType = 'string';
                extract += `vector<${baseType}> p${i};\n        stringstream __ss${i}(${lineVar});\n        __ss${i} >> boolalpha;\n        ${baseType} __t${i};\n        while(__ss${i} >> __t${i}) p${i}.push_back(__t${i});`;
            } else if (p.type === 'string') {
                extract += `${cppType} p${i} = __orig_${i};`;
            } else if (p.type === 'char') {
                extract += `${cppType} p${i} = __orig_${i}.empty() ? ' ' : __orig_${i}[0];`;
            } else {
                extract += `${cppType} p${i};\n        stringstream __ss${i}(${lineVar});\n        __ss${i} >> boolalpha >> p${i};`;
            }
            
            return extract;
        }).join("\n        ");
            
        let invokeArgs = params.map((_, i) => `p${i}`).join(", ");
        
        let printCode = returnType.endsWith("[]") && returnType !== "char[]"
            ? `for(size_t i=0; i<result.size(); i++) cout << result[i] << (i == result.size()-1 ? "" : " ");`
            : returnType === "char[]"
                ? `for(size_t i=0; i<result.size(); i++) cout << result[i];`
                : returnType === "bool"
                    ? `cout << (result ? "true" : "false");`
                    : `cout << result;`;

        return `
#include <bits/stdc++.h>
using namespace std;

${code}

int main() {
    try {
        string __input = ${inputLiteral};
        ${readCode}
        
        ${returnType === 'void' ? '' : 'auto result = '} ${resolvedFunctionName}(${invokeArgs});
        ${returnType === 'void' ? '' : printCode}
    } catch (const exception& e) {
        cerr << e.what() << endl;
        return 1;
    }
    return 0;
}
`;
    }

    if (normalized === "c") {
        // C dynamic arrays are harder to serialize/deserialize generic logic,
        // Will fallback to static sizing for primitives tests for now to maintain API compatibility
        return `
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>

${code}

int main() {
    // For now, C wrapper supports minimal standard tests like addTwo correctly
    int a=0, b=0;
    sscanf(${inputLiteral}, "%d %d", &a, &b);
    printf("%d", ${resolvedFunctionName}(a, b));
    return 0;
}
`;
    }

    if (normalized === "php") {
        let readCode = `$__lines = explode("\\n", $input_data_raw);\n    $args = [];\n    ` + params.map((p, i) => {
            let lineVar = `$__line_${i}`;
            let extract = `${lineVar} = count($__lines) > ${i} ? trim($__lines[${i}]) : "";\n    `;
            if (p.type === 'int' || p.type === 'long') extract += `$args[] = ${lineVar} !== "" ? intval(${lineVar}) : 0;`;
            else if (p.type === 'float' || p.type === 'double') extract += `$args[] = ${lineVar} !== "" ? floatval(${lineVar}) : 0.0;`;
            else if (p.type === 'bool') extract += `$args[] = (${lineVar} === 'true');`;
            else if (p.type === 'string' || p.type === 'char') extract += `$args[] = count($__lines) > ${i} ? rtrim($__lines[${i}], "\\r\\n") : "";`;
            else if (p.type === 'int[]') extract += `$args[] = ${lineVar} !== "" ? array_map('intval', preg_split('/\\s+/', ${lineVar})) : [];`;
            else if (p.type === 'string[]' || p.type === 'char[]') extract += `$args[] = ${lineVar} !== "" ? preg_split('/\\s+/', ${lineVar}) : [];`;
            else extract += `$args[] = ${lineVar};`;
            return extract;
        }).join("\n    ");

        let printCode = returnType.endsWith("[]") && returnType !== "char[]"
            ? `echo is_array($result) ? implode(" ", $result) : $result;`
            : returnType === "char[]"
                ? `echo is_array($result) ? implode("", $result) : $result;`
                : returnType === "bool"
                    ? `echo $result ? 'true' : 'false';`
                    : `echo $result;`;

        return `<?php
${code}

try {
    $input_data_raw = ${inputLiteral};
    ${readCode}
    
    if (!function_exists('${resolvedFunctionName}')) {
        throw new Exception("Function ${resolvedFunctionName} not found");
    }
    
    $result = call_user_func_array('${resolvedFunctionName}', $args);
    ${printCode}
} catch (Throwable $e) {
    fwrite(STDERR, $e->getMessage());
    exit(1);
}
?>`;
    }

    return code;
}

module.exports = {
    normalizeLanguage,
    sanitizeFunctionName,
    extractFunctionNameFromCode,
    resolveFunctionName,
    buildWrappedCode,
    TYPE_CAPABILITIES
};