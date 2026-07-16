const LANG = {
    js: 63,
    cpp: 54,
    c: 50,
    python: 71,
    java: 62,
    php: 68
};

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

module.exports = {
    LANG,
    TYPE_CAPABILITIES,
    "add-two": {
        title: "Add Two",
        functionName: "addTwo",
        signatureVersion: 1,
        signature: {
            params: [
                { name: "a", type: "int" },
                { name: "b", type: "int" }
            ],
            returnType: "int"
        },
        langMap: LANG,
        testCases: {
            public: [
                { input: "2 3", output: "5" }
            ],
            hidden: [
                { input: "999 1", output: "1000" },
                { input: "-5 5", output: "0" },
                { input: "1000000000 1000000000", output: "2000000000" },
                { input: "0 0", output: "0" }
            ]
        }
    },
    "reverse-string": {
        title: "Reverse String",
        functionName: "reverseString",
        signatureVersion: 1,
        signature: {
            params: [
                { name: "s", type: "string" }
            ],
            returnType: "string"
        },
        langMap: LANG,
        testCases: {
            public: [
                { input: "hello", output: "olleh" },
                { input: "hello world", output: "dlrow olleh" }
            ],
            hidden: [
                { input: "नमस्ते", output: "ेत्समन" }, // Depending on how we handle unicode graphemes vs chars, this might be tricky, but basic char reverse is fine for now
                { input: "a", output: "a" }
            ]
        }
    },
    "sum-array": {
        title: "Sum Array",
        functionName: "sumArray",
        signatureVersion: 1,
        signature: {
            params: [
                { name: "nums", type: "int[]" }
            ],
            returnType: "int"
        },
        langMap: LANG,
        testCases: {
            public: [
                { input: "1 2 3 4 5", output: "15" },
                { input: "", output: "0" } // empty array
            ],
            hidden: [
                { input: "-1 1", output: "0" }
            ]
        }
    }
};
