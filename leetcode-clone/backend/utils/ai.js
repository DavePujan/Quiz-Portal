const { GoogleGenerativeAI } = require("@google/generative-ai");
const OpenAI = require("openai");
const Cerebras = require("@cerebras/cerebras_cloud_sdk");
const Anthropic = require("@anthropic-ai/sdk");

// ─── Provider Registry ───────────────────────────────────────────────
const ALLOWED_PROVIDERS = ["gemini", "openrouter", "cerebras", "mistral", "openai", "claude", "grok"];

// NOTE: API keys are stored in user_api_keys table (normalized), NOT in profiles columns.

const DEFAULT_MODELS = {
    gemini: "gemini-2.5-flash",
    openrouter: "google/gemma-4-31b-it:free",
    cerebras: "gpt-oss-120b",
    mistral: "mistral-small-latest",
    openai: "gpt-4o-mini",
    claude: "claude-3-5-haiku-20241022",
    grok: "grok-3-mini"
};

// ─── Provider Implementations ────────────────────────────────────────

async function generateGeminiResponse(prompt, apiKey, { isJson = true, model } = {}) {
    if (!apiKey) throw new Error("Gemini API Key is required.");
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const config = isJson ? { responseMimeType: "application/json" } : {};
        const selectedModel = model || DEFAULT_MODELS.gemini;
        console.log("[Gemini] Sending request to model:", selectedModel);
        const geminiModel = genAI.getGenerativeModel({
            model: selectedModel,
            generationConfig: config
        });
        const result = await geminiModel.generateContent(prompt);
        if (!result || !result.response) {
            throw new Error("Gemini returned an empty response. Check your API key or try again.");
        }
        const text = result.response.text();
        console.log("[Gemini] Response received. Length:", text?.length || 0);
        return text;
    } catch (err) {
        // Re-throw with a cleaner message for common Gemini errors
        const msg = err.message || String(err);
        if (msg.includes("API_KEY_INVALID") || msg.includes("PERMISSION_DENIED")) {
            throw new Error("Invalid Gemini API key. Please update it in Settings.");
        }
        if (msg.includes("Could not find model") || msg.includes("is not found")) {
            throw new Error(`Gemini model "${model || DEFAULT_MODELS.gemini}" not found. It may have been deprecated.`);
        }
        throw err;
    }
}

async function generateOpenRouterResponse(prompt, apiKey, { isJson = true, model } = {}) {
    if (!apiKey) throw new Error("OpenRouter API Key is required.");

    const client = new OpenAI.default({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: apiKey,
        timeout: 120000, // 2 minute timeout for free models
        defaultHeaders: {
            "HTTP-Referer": process.env.CLIENT_URL || "http://localhost:5173",
            "X-Title": "Quiz Portal"
        }
    });

    const messages = [{ role: "user", content: prompt }];
    if (isJson) {
        messages.unshift({
            role: "system",
            content: "You are a helpful assistant. Always respond with valid JSON only. No markdown fences, no extra text."
        });
    }

    const selectedModel = model || DEFAULT_MODELS.openrouter;
    console.log("[OpenRouter] Sending request to model:", selectedModel);

    try {
        const completion = await client.chat.completions.create({
            model: selectedModel,
            messages,
            temperature: 0.7,
            max_tokens: 4096
        });

        console.log("[OpenRouter] Response received. choices:", completion?.choices?.length ?? "MISSING");

        if (!completion?.choices || completion.choices.length === 0) {
            console.error("[OpenRouter] Unexpected response shape:", JSON.stringify(completion).substring(0, 500));
            throw new Error("OpenRouter returned an empty or invalid response. The free model may be overloaded — try again.");
        }

        return completion.choices[0]?.message?.content || "";
    } catch (err) {
        const status = err?.status || err?.response?.status;
        const msg = err?.message || String(err);

        if (status === 429 || msg.includes("429") || msg.toLowerCase().includes("rate limit") || msg.toLowerCase().includes("too many requests")) {
            throw new Error("RATE_LIMIT: OpenRouter free tier rate limit hit. Please wait 10–30 seconds and try again, or switch to a paid model.");
        }
        if (status === 402 || msg.toLowerCase().includes("payment") || msg.toLowerCase().includes("credits")) {
            throw new Error("RATE_LIMIT: OpenRouter account has insufficient credits. Please top up or use a free model.");
        }
        throw err;
    }
}

async function generateCerebrasResponse(prompt, apiKey, { isJson = true, model } = {}) {
    if (!apiKey) throw new Error("Cerebras API Key is required.");

    const client = new Cerebras({
        apiKey: apiKey
    });

    const messages = [{ role: "user", content: prompt }];
    if (isJson) {
        messages.unshift({
            role: "system",
            content: "You are a helpful assistant. Always respond with valid JSON only. No markdown fences, no extra text."
        });
    }

    const selectedModel = model || DEFAULT_MODELS.cerebras;
    console.log("[Cerebras] Sending request to model:", selectedModel);
    
    try {
        const completion = await client.chat.completions.create({
            model: selectedModel,
            messages,
            temperature: 0.7,
            max_completion_tokens: 4096
        });

        console.log("[Cerebras] Response received. choices:", completion?.choices?.length ?? "MISSING");

        if (!completion?.choices || completion.choices.length === 0) {
            console.error("[Cerebras] Unexpected response shape:", JSON.stringify(completion).substring(0, 500));
            throw new Error("Cerebras returned an empty or invalid response.");
        }

        return completion.choices[0]?.message?.content || "";
    } catch (err) {
        const status = err?.status || err?.response?.status;
        const msg = err?.message || String(err);
        if (status === 429 || msg.includes("429") || msg.toLowerCase().includes("rate limit") || msg.toLowerCase().includes("too many requests")) {
            throw new Error("RATE_LIMIT: Cerebras rate limit reached. Please wait a moment and try again.");
        }
        console.error("[Cerebras] API Error:", msg);
        throw err;
    }
}

async function generateMistralResponse(prompt, apiKey, { isJson = true, model } = {}) {
    if (!apiKey) throw new Error("Mistral API Key is required.");

    const { Mistral } = await import("@mistralai/mistralai");
    const client = new Mistral({ apiKey: apiKey });

    const messages = [{ role: "user", content: prompt }];
    if (isJson) {
        messages.unshift({
            role: "system",
            content: "You are a helpful assistant. Always respond with valid JSON only. No markdown fences, no extra text."
        });
    }

    const selectedModel = model || DEFAULT_MODELS.mistral;
    console.log("[Mistral] Sending request to model:", selectedModel);

    try {
        const response = await client.chat.complete({
            model: selectedModel,
            messages: messages,
            temperature: 0.7,
            maxTokens: 4096,
            responseFormat: isJson ? { type: "json_object" } : { type: "text" }
        });

        console.log("[Mistral] Response received. choices:", response?.choices?.length ?? "MISSING");

        if (!response?.choices || response.choices.length === 0) {
            console.error("[Mistral] Unexpected response shape:", JSON.stringify(response).substring(0, 500));
            throw new Error("Mistral returned an empty or invalid response.");
        }

        return response.choices[0]?.message?.content || "";
    } catch (err) {
        const status = err?.status || err?.httpStatus || err?.response?.status;
        const msg = err?.message || String(err);
        if (status === 429 || msg.includes("429") || msg.toLowerCase().includes("rate limit") || msg.toLowerCase().includes("too many requests")) {
            throw new Error("RATE_LIMIT: Mistral rate limit reached. Please wait a moment and try again.");
        }
        console.error("[Mistral] API Error:", msg);
        throw err;
    }
}

// Provider dispatch map
const providers = {
    gemini: generateGeminiResponse,
    openrouter: generateOpenRouterResponse,
    cerebras: generateCerebrasResponse,
    mistral: generateMistralResponse,
    openai: generateOpenAIResponse,
    claude: generateClaudeResponse,
    grok: generateGrokResponse
};

// ─── OpenAI (GPT) ────────────────────────────────────────────────────
async function generateOpenAIResponse(prompt, apiKey, { isJson = true, model } = {}) {
    if (!apiKey) throw new Error("OpenAI API Key is required.");

    const client = new OpenAI.default({ apiKey });
    const selectedModel = model || DEFAULT_MODELS.openai;
    console.log("[OpenAI] Sending request to model:", selectedModel);

    const messages = [{ role: "user", content: prompt }];
    if (isJson) {
        messages.unshift({
            role: "system",
            content: "You are a helpful assistant. Always respond with valid JSON only. No markdown fences, no extra text."
        });
    }

    try {
        const completion = await client.chat.completions.create({
            model: selectedModel,
            messages,
            temperature: 0.7,
            max_tokens: 4096,
            ...(isJson ? { response_format: { type: "json_object" } } : {})
        });

        console.log("[OpenAI] Response received. choices:", completion?.choices?.length ?? "MISSING");

        if (!completion?.choices || completion.choices.length === 0) {
            throw new Error("OpenAI returned an empty response.");
        }
        return completion.choices[0]?.message?.content || "";
    } catch (err) {
        const status = err?.status || err?.response?.status;
        const msg = err?.message || String(err);
        if (status === 429 || msg.includes("429") || msg.toLowerCase().includes("rate limit")) {
            throw new Error("RATE_LIMIT: OpenAI rate limit or quota exceeded. Check your usage at platform.openai.com.");
        }
        if (status === 401 || msg.toLowerCase().includes("invalid api key")) {
            throw new Error("Invalid OpenAI API key. Please update it in Settings.");
        }
        console.error("[OpenAI] API Error:", msg);
        throw err;
    }
}

// ─── Claude (Anthropic) ───────────────────────────────────────────────
async function generateClaudeResponse(prompt, apiKey, { isJson = true, model } = {}) {
    if (!apiKey) throw new Error("Anthropic (Claude) API Key is required.");

    const client = new Anthropic.default({ apiKey });
    const selectedModel = model || DEFAULT_MODELS.claude;
    console.log("[Claude] Sending request to model:", selectedModel);

    const systemPrompt = isJson
        ? "You are a helpful assistant. Always respond with valid JSON only. No markdown fences, no extra text."
        : "You are a helpful assistant.";

    try {
        const response = await client.messages.create({
            model: selectedModel,
            max_tokens: 4096,
            system: systemPrompt,
            messages: [{ role: "user", content: prompt }]
        });

        console.log("[Claude] Response received. stop_reason:", response?.stop_reason);

        const content = response?.content?.[0]?.text;
        if (!content) throw new Error("Claude returned an empty response.");
        return content;
    } catch (err) {
        const status = err?.status || err?.error?.type;
        const msg = err?.message || String(err);
        if (status === 429 || msg.includes("429") || msg.toLowerCase().includes("rate limit") || msg.toLowerCase().includes("overloaded")) {
            throw new Error("RATE_LIMIT: Claude is overloaded or rate limit reached. Please wait and try again.");
        }
        if (status === 401 || msg.toLowerCase().includes("authentication")) {
            throw new Error("Invalid Claude API key. Please update it in Settings.");
        }
        console.error("[Claude] API Error:", msg);
        throw err;
    }
}

// ─── Grok (xAI — OpenAI-compatible API) ──────────────────────────────
async function generateGrokResponse(prompt, apiKey, { isJson = true, model } = {}) {
    if (!apiKey) throw new Error("xAI Grok API Key is required.");

    const client = new OpenAI.default({
        apiKey,
        baseURL: "https://api.x.ai/v1"
    });
    const selectedModel = model || DEFAULT_MODELS.grok;
    console.log("[Grok] Sending request to model:", selectedModel);

    const messages = [{ role: "user", content: prompt }];
    if (isJson) {
        messages.unshift({
            role: "system",
            content: "You are a helpful assistant. Always respond with valid JSON only. No markdown fences, no extra text."
        });
    }

    try {
        const completion = await client.chat.completions.create({
            model: selectedModel,
            messages,
            temperature: 0.7,
            max_tokens: 4096
        });

        console.log("[Grok] Response received. choices:", completion?.choices?.length ?? "MISSING");

        if (!completion?.choices || completion.choices.length === 0) {
            throw new Error("Grok returned an empty response.");
        }
        return completion.choices[0]?.message?.content || "";
    } catch (err) {
        const status = err?.status || err?.response?.status;
        const msg = err?.message || String(err);
        if (status === 429 || msg.includes("429") || msg.toLowerCase().includes("rate limit")) {
            throw new Error("RATE_LIMIT: Grok rate limit reached. Please wait a moment and try again.");
        }
        if (status === 401 || msg.toLowerCase().includes("invalid") || msg.toLowerCase().includes("unauthorized")) {
            throw new Error("Invalid Grok API key. Please update it in Settings.");
        }
        console.error("[Grok] API Error:", msg);
        throw err;
    }
}

// ─── Shared Utilities ────────────────────────────────────────────────

// Safe JSON parser — handles markdown fencing, invisible chars, and common quirks
function safeParseJSON(raw) {
    try {
        if (!raw) return null;
        // Remove invisible chars & markdown code fences
        const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
        const parsed = JSON.parse(cleaned);

        // Auto-fix logic_score 0-10 → 0-1 if present
        if (typeof parsed.logic_score === "number" && parsed.logic_score > 1 && parsed.logic_score <= 10) {
            parsed.logic_score /= 10;
        }
        return parsed;
    } catch (e) {
        return null;
    }
}

// Normalize quiz generation response into a clean array
function normalizeQuizResponse(raw) {
    const parsed = safeParseJSON(raw);

    if (!parsed) {
        throw new Error("Failed to parse AI response as JSON. Raw: " + (raw || "").substring(0, 200));
    }

    // Direct array
    if (Array.isArray(parsed)) return parsed;

    // Common named wrappers: { questions, data, results, items, quiz, mcqs, problems }
    const KNOWN_KEYS = ["questions", "data", "results", "items", "quiz", "mcqs", "problems", "quizQuestions", "quiz_questions"];
    for (const key of KNOWN_KEYS) {
        if (parsed[key] && Array.isArray(parsed[key]) && parsed[key].length > 0) {
            return parsed[key];
        }
    }

    // Last resort: find the first array-valued key in the object
    const arrayEntry = Object.values(parsed).find(v => Array.isArray(v) && v.length > 0);
    if (arrayEntry) return arrayEntry;

    throw new Error("AI response is valid JSON but not in expected format (array or {questions: []}).");
}

// ─── Exported Functions ──────────────────────────────────────────────

exports.ALLOWED_PROVIDERS = ALLOWED_PROVIDERS;
exports.DEFAULT_MODELS = DEFAULT_MODELS;

exports.generateQuiz = async ({ prompt, apiKey, provider = "gemini", model }) => {
    try {
        if (!ALLOWED_PROVIDERS.includes(provider)) {
            throw new Error(`Invalid provider: ${provider}. Allowed: ${ALLOWED_PROVIDERS.join(", ")}`);
        }

        const aiPrompt = `
You are a quiz generation assistant.
User Request: "${prompt}"

Generate a list of questions based on the user's request. 
Format the output as a valid JSON array of objects.

Each object should follow this schema:
{
  "question": "Question text...",
  "type": "mcq" | "code",
  "marks": number,
  "options": ["Opt1", "Opt2", "Opt3", "Opt4"], // Only for MCQ (4 options)
  "answer": "Correct Option Text", // Matches one of the options exactly
    "language": "javascript" | "python" | "c" | "cpp" | "java" | "php", // Only for Code
    "functionName": "addTwo", // Only for Code (Use a meaningful LeetCode-style function name)
  "inputFormat": "e.g. n lines of integers", // Only for Code
  "outputFormat": "e.g. a single integer", // Only for Code
  "testCases": [ // Only for Code (provide 2-3 examples)
    { "input": "...", "output": "...", "isHidden": false }
  ]
}

IMPORTANT Rules:
- If type is 'mcq', ensure 'options' has 4 items and 'answer' matches one exactly.
- If type is 'code', ensure 'testCases' are provided and valid.
- If type is 'code', choose a concise meaningful functionName that matches the problem, like addTwo, reverseString, findMax, isPalindrome.
- Be creative with the content but strict with the JSON structure.
- Return ONLY a valid JSON array. No markdown, no explanation.
`;

        const generateFn = providers[provider];
        const raw = await generateFn(aiPrompt, apiKey, { isJson: true, model });
        return normalizeQuizResponse(raw);

    } catch (err) {
        console.error(`AI Generate Error [${provider}]:`, err.message);
        throw new Error("Failed to generate quiz from AI: " + err.message);
    }
};

exports.analyzeCode = async ({ code, question, language, input_format, output_format, max_marks, apiKey, provider = "gemini", model }) => {
    try {
        const prompt = `
You are an academic code evaluator for beginners.

Question:
${question}

Language: ${language}
Input Format: ${input_format || "Not specified"}
Output Format: ${output_format || "Not specified"}
Max Marks: ${max_marks}

Student Code:
${code}

Evaluation Rules:
- Assume beginner/student level (1st/2nd year CSE).
- Do NOT deduct marks for minor syntax or style issues.
- Focus primarily on the CORRECTNESS OF LOGIC and ALGORITHM.
- If the logic is correct but there are minor syntax errors or missing imports, give a HIGH logic_score (0.8 - 1.0).
- Ignore performance optimizations unless the code is fundamentally broken.
- Be generous. If the student clearly understands the concept, award full marks for logic.

Return ONLY a valid JSON object with EXACT keys:
{
  "logic_score": number between 0 and 1,
  "feedback": "Short, student-friendly explanation",
  "suggestions": "Simple improvement tips or empty string"
}
`;

        const generateFn = providers[provider] || providers.gemini;
        const raw = await generateFn(prompt, apiKey, { isJson: true, model });
        const parsed = safeParseJSON(raw);

        if (!parsed) throw new Error("Invalid AI response: " + raw);

        return parsed;

    } catch (err) {
        console.error("AI Code Analysis Error:", err.message);
        // Fallback
        return {
            logic_score: 0,
            feedback: "AI evaluation skipped due to system error: " + err.message,
            suggestions: ""
        };
    }
};

exports.classifyQuestion = async ({ questionText, apiKey, provider = "gemini", model }) => {
    try {
        const prompt = `
You are an expert computer science educator.

Your task is to classify the following quiz question into exactly ONE topic
from the allowed list below.

Allowed topics:
- Algorithms
- Data Structures
- Correctness
- Complexity
- Logic & Reasoning
- Recursion
- Mathematical Foundations
- Programming Basics
- Edge Cases & Testing
- Other

Question:
"${questionText}"

Rules:
- Return ONLY the topic name
- Do NOT explain your answer
- Do NOT invent new topics
- If unsure, return "Other"
`;

        const generateFn = providers[provider] || providers.gemini;
        const rawTopic = await generateFn(prompt, apiKey, { isJson: false, model });
        const topic = rawTopic.trim();

        // Basic validation against allowed list
        const allowed = [
            "Algorithms", "Data Structures", "Correctness", "Complexity",
            "Logic & Reasoning", "Recursion", "Mathematical Foundations",
            "Programming Basics", "Edge Cases & Testing", "Other"
        ];

        const normalized = allowed.find(t => t.toLowerCase() === topic.toLowerCase()) || "Other";
        return normalized;

    } catch (err) {
        console.error("AI Classification Error:", err.message);
        return "Other"; // Fallback
    }
};
