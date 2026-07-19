import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Sparkles, ArrowRight, X, Rocket, ChevronDown, Settings, AlertCircle } from "lucide-react";
import { supabase } from "../../lib/supabase";
import api, { createFullQuiz, getAcademicCatalog, getAiProviders } from "../../utils/api";
import { FEATURES } from "../../config/features";

export default function CreateQuiz() {
    const hasValidSupabaseUploadConfig =
        Boolean(import.meta.env.VITE_SUPABASE_URL) &&
        Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY) &&
        !String(import.meta.env.VITE_SUPABASE_ANON_KEY).includes("placeholder");

    // Quiz Metadata
    const [quizDetails, setQuizDetails] = useState({
        title: "",
        subjectId: "",
        courseOfferingId: "",
        departmentId: "",
        semesterId: "",
        duration: "",
        totalMarks: "",
        description: "",
        scheduledAt: "" // New field
    });

    // List of Questions
    const [questions, setQuestions] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [academicCatalog, setAcademicCatalog] = useState({ departments: [], semesters: [], subjects: [], courseOfferings: [] });
    const [catalogError, setCatalogError] = useState("");

    // Current Question Form State
    const [currentQ, setCurrentQ] = useState({
        question: "", // Title/Question Text
        type: "code", // 'mcq' or 'code'
        marks: 5,
        // Code specific
        language: "javascript",
        functionName: "",
        inputFormat: "",
        outputFormat: "",
        testCases: [{ input: "", output: "", isHidden: false }],
        // MCQ specific
        options: ["", "", "", ""],
        answer: "",
        image: "" // Optional Image URL
    });



    const [showAiSidebar, setShowAiSidebar] = useState(false);

    useEffect(() => {
        getAcademicCatalog()
            .then(({ data }) => setAcademicCatalog(data))
            .catch((err) => setCatalogError(err.response?.data?.error || "Could not load departments and subjects."));
    }, []);

    const handleQuizChange = (e) => {
        const { name, value } = e.target;
        setQuizDetails((current) => {
            if (name === "departmentId") {
                return { ...current, departmentId: value, semesterId: "", subjectId: "" };
            }
            if (name === "semesterId") {
                return { ...current, semesterId: value, subjectId: "" };
            }
            return { ...current, [name]: value };
        });
    };

    const availableSubjects = academicCatalog.subjects?.filter((subject) =>
        String(subject.department_id) === String(quizDetails.departmentId) &&
        String(subject.semester_id) === String(quizDetails.semesterId)
    ) || [];

    const useNewAcademicModel = FEATURES.NEW_ACADEMIC_MODEL;

    // --- Question Form Handlers ---
    const handleQChange = (field, value) => {
        setCurrentQ({ ...currentQ, [field]: value });
    };

    const handleOptionChange = (idx, val) => {
        const newOpts = [...currentQ.options];
        newOpts[idx] = val;
        setCurrentQ({ ...currentQ, options: newOpts });
    };

    const handleTestCaseChange = (idx, field, val) => {
        const newTC = [...currentQ.testCases];
        newTC[idx][field] = val;
        setCurrentQ({ ...currentQ, testCases: newTC });
    };

    const addTestCase = () => {
        setCurrentQ({
            ...currentQ,
            testCases: [...currentQ.testCases, { input: "", output: "", isHidden: false }]
        });
    };

    const removeTestCase = (idx) => {
        const newTC = currentQ.testCases.filter((_, i) => i !== idx);
        setCurrentQ({ ...currentQ, testCases: newTC });
    };

    const addQuestion = () => {
        if (currentQ.type === "code" && !String(currentQ.functionName || "").trim()) {
            alert("Please enter the function name for this code question.");
            return;
        }

        // Validation could go here
        setQuestions([...questions, { ...currentQ }]);
        // Reset Current Question safely
        setCurrentQ({
            question: "",
            type: "code",
            marks: 5,
            language: "javascript",
            functionName: "",
            inputFormat: "",
            outputFormat: "",
            testCases: [{ input: "", output: "", isHidden: false }],
            options: ["", "", "", ""],
            answer: "",
            image: ""
        });
    };

    const deleteQuestion = (idx) => {
        setQuestions(questions.filter((_, i) => i !== idx));
    };

    const handleSubmit = async () => {
        if (questions.length === 0) {
            alert("Please add at least one question.");
            return;
        }
        // Validation: All fields required except description
        if (useNewAcademicModel) {
            if (!quizDetails.title || !quizDetails.courseOfferingId || !quizDetails.duration || !quizDetails.totalMarks) {
                alert("Please fill in all Quiz Details, including a course offering.");
                return;
            }
        } else {
            if (!quizDetails.title || !quizDetails.subjectId || !quizDetails.duration || !quizDetails.totalMarks) {
                alert("Please fill in all Quiz Details, including a subject.");
                return;
            }
        }

        setSubmitting(true);
        try {
            const hasImageUpload = questions.some(q => q.image instanceof File);
            if (hasImageUpload && !hasValidSupabaseUploadConfig) {
                throw new Error("Supabase image upload is not configured. Set VITE_SUPABASE_ANON_KEY in frontend/.env with your real anon key.");
            }

            // Process questions: Upload images if they are File objects
            const processedQuestions = await Promise.all(questions.map(async (q) => {
                if (q.image && q.image instanceof File) {
                    const fileName = `${Date.now()}_${q.image.name}`;
                    const { error } = await supabase.storage
                        .from("quiz_images")
                        .upload(fileName, q.image);

                    if (error) throw error;

                    const { data } = supabase.storage
                        .from("quiz_images")
                        .getPublicUrl(fileName);

                    return { ...q, image: data.publicUrl };
                }
                return q; // Already a URL or empty
            }));

            const payload = {
                ...quizDetails,
                questions: processedQuestions
            };

            await createFullQuiz(payload);
            alert("Quiz and Questions Created Successfully!");
            // Optional: Redirect or reset
            setQuestions([]);
            setQuizDetails({ title: "", subjectId: "", courseOfferingId: "", departmentId: "", semesterId: "", duration: "", totalMarks: "", description: "", scheduledAt: "" });
        } catch (error) {
            console.error(error);
            const rawMessage = error.response?.data?.error || error.message;
            const normalizedMessage = String(rawMessage || "");
            if (normalizedMessage.includes("Invalid Compact JWS")) {
                alert("Error creating quiz: Invalid Supabase key detected. Update VITE_SUPABASE_ANON_KEY in frontend/.env with your real Supabase anon key and restart Vite.");
            } else {
                alert("Error creating quiz: " + normalizedMessage);
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="p-8 max-w-5xl mx-auto bg-black min-h-screen text-gray-300 font-sans">
            <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-2">
                <h1 className="text-3xl font-bold text-white">Create New Quiz</h1>
                <button 
                    onClick={() => setShowAiSidebar(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-linear-to-r from-purple-600 to-pink-600 rounded text-white font-bold hover:opacity-90 transition"
                >
                    <Sparkles className="w-4 h-4 mr-2" /><span>Ask AI</span>
                </button>
            </div>

            <AiSidebar 
                isOpen={showAiSidebar}
                onClose={() => setShowAiSidebar(false)}
                onPopulateForm={(q) => {
                        setCurrentQ({
                            question: q.question,
                            type: q.type.toLowerCase(),
                            marks: q.marks || 5,
                            language: q.language || "javascript",
                            functionName: q.functionName || "",
                            inputFormat: q.inputFormat || "",
                            outputFormat: q.outputFormat || "",
                            testCases: q.testCases || [{ input: "", output: "", isHidden: false }],
                            options: q.options || ["", "", "", ""],
                            answer: q.answer || "",
                            image: ""
                        });
                        // Optional: Scroll to form
                        document.querySelector("h2.text-blue-400")?.scrollIntoView({ behavior: "smooth" });
                }}
            />

            {/* Quiz Details Section */}
            <div className="bg-[#1e1e1e] p-6 rounded-lg mb-8 shadow-lg">
                <h2 className="text-xl font-semibold mb-4 text-pink-400">1. Quiz Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input name="title" placeholder="Quiz Title" value={quizDetails.title} onChange={handleQuizChange} className="input bg-[#252526] border-gray-700 text-white" />
                    {useNewAcademicModel ? (
                        <select name="courseOfferingId" value={quizDetails.courseOfferingId} onChange={handleQuizChange} className="input bg-[#252526] border-gray-700 text-white col-span-1 md:col-span-2">
                            <option value="">Select Course Offering</option>
                            {academicCatalog.courseOfferings?.map((co) => (
                                <option key={co.id} value={co.id}>
                                    {co.subject_code ? `${co.subject_code} — ` : ""}{co.subject_name} ({co.term_type} {co.term_number}, {co.program_name})
                                </option>
                            ))}
                        </select>
                    ) : (
                        <>
                            <select name="departmentId" value={quizDetails.departmentId} onChange={handleQuizChange} className="input bg-[#252526] border-gray-700 text-white">
                                <option value="">Select Department</option>
                                {academicCatalog.departments?.map((department) => (
                                    <option key={department.id} value={department.id}>
                                        {department.code} — {department.name}
                                    </option>
                                ))}
                            </select>

                            <select name="semesterId" value={quizDetails.semesterId} onChange={handleQuizChange} disabled={!quizDetails.departmentId} className="input bg-[#252526] border-gray-700 text-white disabled:opacity-50">
                                <option value="">Select Semester</option>
                                {academicCatalog.semesters?.map((semester) => (
                                    <option key={semester.id} value={semester.id}>Semester {semester.semester_no}</option>
                                ))}
                            </select>

                            <select name="subjectId" value={quizDetails.subjectId} onChange={handleQuizChange} disabled={!quizDetails.semesterId} className="input bg-[#252526] border-gray-700 text-white disabled:opacity-50">
                                <option value="">Select Subject</option>
                                {availableSubjects.map((subject) => (
                                    <option key={subject.id} value={subject.id}>
                                        {subject.code ? `${subject.code} — ` : ""}{subject.name}
                                    </option>
                                ))}
                            </select>
                        </>
                    )}

                    <input name="duration" placeholder="Duration (mins)" type="number" value={quizDetails.duration} onChange={handleQuizChange} className="input bg-[#252526] border-gray-700 text-white" />
                    <input name="totalMarks" type="number" placeholder="Total Marks" value={quizDetails.totalMarks} onChange={handleQuizChange} className="input bg-[#252526] border-gray-700 text-white" />

                    {/* Schedule Quiz */}
                    <div className="flex flex-col">
                        <label className="text-xs text-gray-500 mb-1 ml-1 uppercase font-bold tracking-wider">Schedule Start (Optional)</label>
                        <input
                            name="scheduledAt"
                            type="datetime-local"
                            min={new Date().toISOString().slice(0, 16)}
                            value={quizDetails.scheduledAt}
                            onChange={handleQuizChange}
                            className="input bg-[#252526] border-gray-700 text-white"
                        />
                    </div>
                    <textarea name="description" placeholder="Description" value={quizDetails.description} onChange={handleQuizChange} className="input bg-[#252526] border-gray-700 text-white col-span-2 h-20" />
                </div>
                {catalogError && <p className="mt-3 text-sm text-red-400">{catalogError}</p>}
            </div>

            {/* Add Question Section */}
            <div className="bg-[#1e1e1e] p-6 rounded-lg mb-8 shadow-lg border border-gray-700">
                <h2 className="text-xl font-semibold mb-4 text-blue-400">2. Add Questions</h2>

                {/* Question Type Selector */}
                <div className="mb-4">
                    <label className="mr-3 font-bold">Question Type:</label>
                    <select
                        value={currentQ.type}
                        onChange={(e) => handleQChange("type", e.target.value)}
                        className="bg-[#252526] border border-gray-600 rounded p-1 text-white"
                    >
                        <option value="code">Code</option>
                        <option value="mcq">MCQ</option>
                    </select>

                    <label className="ml-6 mr-3 font-bold">Weightage:</label>
                    <input
                        type="number"
                        value={currentQ.marks}
                        onChange={(e) => handleQChange("marks", e.target.value)}
                        className="bg-[#252526] border border-gray-600 rounded p-1 text-white w-20 text-center"
                    />
                </div>

                <div className="mb-4">
                    <label className="block mb-1 text-gray-400">Question Title / Prompt:</label>
                    <input
                        value={currentQ.question}
                        onChange={(e) => handleQChange("question", e.target.value)}
                        className="w-full bg-[#252526] border border-gray-600 rounded p-2 text-white"
                        placeholder="e.g. Write a function to add two numbers..."
                    />
                </div>

                {/* Conditional Form Fields */}
                {currentQ.type === "code" ? (
                    <div className="bg-[#1e1e1e] border-l-4 border-blue-500 pl-4 py-2">
                        <div className="grid grid-cols-3 gap-4 mb-4">
                            <select value={currentQ.language} onChange={e => handleQChange("language", e.target.value)} className="input bg-[#252526] border-gray-600 text-white">
                                <option value="javascript">JavaScript</option>
                                <option value="python">Python</option>
                                <option value="c">C</option>
                                <option value="cpp">C++</option>
                                <option value="java">Java</option>
                                <option value="php">PHP</option>
                            </select>
                        </div>
                        <div className="mb-4">
                            <label className="block mb-1 text-gray-400">Function Name:</label>
                            <input
                                placeholder="e.g. addTwo"
                                value={currentQ.functionName}
                                onChange={e => handleQChange("functionName", e.target.value)}
                                className="w-full bg-[#252526] border border-gray-600 rounded p-2 text-white"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <input placeholder="Input Format (e.g. a, b)" value={currentQ.inputFormat} onChange={e => handleQChange("inputFormat", e.target.value)} className="input bg-[#252526] border-gray-600 text-white" />
                            <input placeholder="Output Format (e.g. sum)" value={currentQ.outputFormat} onChange={e => handleQChange("outputFormat", e.target.value)} className="input bg-[#252526] border-gray-600 text-white" />
                        </div>

                        <div className="mb-2">
                            <p className="mb-2 font-semibold">Test Cases:</p>
                            {currentQ.testCases.map((tc, i) => (
                                <div key={i} className="flex gap-2 mb-2 items-center">
                                    <span className="text-gray-500">{i + 1})</span>
                                    <input placeholder="Input" value={tc.input} onChange={e => handleTestCaseChange(i, "input", e.target.value)} className="flex-1 bg-[#2d2d2d] border border-gray-600 rounded p-1 text-green-400 font-mono text-sm" />
                                    <ArrowRight className="text-gray-500 w-4 h-4 mx-2" />
                                    <input placeholder="Output" value={tc.output} onChange={e => handleTestCaseChange(i, "output", e.target.value)} className="flex-1 bg-[#2d2d2d] border border-gray-600 rounded p-1 text-green-400 font-mono text-sm" />
                                    <button onClick={() => removeTestCase(i)} className="text-red-500 hover:text-red-400 px-2"><X className="w-4 h-4" /></button>
                                </div>
                            ))}
                            <button onClick={addTestCase} className="text-sm text-blue-400 hover:underline">+ Add Test Case</button>
                        </div>
                    </div>
                ) : (
                    <div className="bg-[#1e1e1e] border-l-4 border-yellow-500 pl-4 py-2">
                        <div className="mb-4">
                            <label className="block mb-1 text-gray-400">Optional Image:</label>
                            {currentQ.image ? (
                                <div className="flex items-center gap-4 bg-[#252526] p-2 rounded border border-green-500">
                                    <span className="text-green-400 text-sm truncate max-w-xs">
                                        {currentQ.image instanceof File ? currentQ.image.name : "Image Uploaded"}
                                    </span>
                                    <button
                                        onClick={() => handleQChange("image", "")}
                                        className="text-red-400 hover:text-red-300 text-sm font-bold"
                                    >
                                        Remove
                                    </button>
                                </div>
                            ) : (
                                <div>
                                    <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded inline-flex items-center transition">
                                        <span>+ Select Image</span>
                                        <input
                                            type="file"
                                            className="hidden"
                                            accept="image/*"
                                            onChange={(e) => {
                                                if (e.target.files[0]) {
                                                    handleQChange("image", e.target.files[0]);
                                                }
                                            }}
                                        />
                                    </label>
                                    <p className="text-xs text-gray-500 mt-1">Supported: JPG, PNG, GIF</p>
                                </div>
                            )}
                        </div>

                        <p className="mb-2 font-semibold">Options:</p>
                        {currentQ.options.map((opt, i) => (
                            <div key={i} className="mb-2 flex items-center gap-2">
                                <span className="text-gray-400">Option {i + 1}:</span>
                                <input value={opt} onChange={e => handleOptionChange(i, e.target.value)} className="flex-1 bg-[#252526] border border-gray-600 rounded p-2 text-white" />
                            </div>
                        ))}
                        <p className="mt-2 mb-1 font-semibold">Correct Answer (must match option text exactly):</p>
                        <input value={currentQ.answer} onChange={e => handleQChange("answer", e.target.value)} className="w-full bg-[#252526] border border-gray-600 rounded p-2 text-white" placeholder="Copy correct option here" />
                    </div>
                )}

                <button onClick={addQuestion} className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded transition">
                    + Add Question to Quiz
                </button>
            </div>

            {/* Questions List Review */}
            {questions.length > 0 && (
                <div className="bg-[#1e1e1e] p-6 rounded-lg mb-8 shadow-lg">
                    <h2 className="text-xl font-semibold mb-4 text-green-400">3. Review Questions ({questions.length})</h2>
                    <div className="space-y-4">
                        {questions.map((q, i) => (
                            <div key={i} className="bg-[#252526] p-4 rounded border border-gray-700 flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-white text-lg"><span className="text-gray-500">Q{i + 1}.</span> {q.question}</h3>
                                    <p className="text-sm text-gray-400">Type: <span className="uppercase text-yellow-500">{q.type}</span> | Marks: {q.marks}</p>
                                    {q.type === 'mcq' && <p className="text-xs text-gray-500 mt-1">Answer: {q.answer}</p>}
                                    {q.type === 'code' && <p className="text-xs text-gray-500 mt-1">Lang: {q.language} | Function: {q.functionName || "N/A"} | Cases: {q.testCases.length}</p>}
                                </div>
                                <button onClick={() => deleteQuestion(i)} className="text-red-500 hover:text-red-400">Delete</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Final Submit */}
            <button
                onClick={handleSubmit}
                disabled={submitting}
                className={`w-full font-bold py-4 rounded-lg text-xl shadow-lg transition transform hover:scale-[1.01] ${submitting
                    ? "bg-gray-600 cursor-wait"
                    : "bg-green-600 hover:bg-green-700 text-white"
                    }`}
            >
                {submitting ? "Uploading & Creating Quiz..." : <><Rocket className="w-5 h-5 mr-2 inline" /> Create Full Quiz</>}
            </button>
        </div>
    );
}

// AI Sidebar Component
function AiSidebar({ onPopulateForm, onClose, isOpen }) {
    const [prompt, setPrompt] = useState("");
    const [loading, setLoading] = useState(false);
    const [generatedQuestions, setGeneratedQuestions] = useState([]);
    const [expandedQ, setExpandedQ] = useState(null);
    const [generateError, setGenerateError] = useState(null);

    // Provider state
    const [providers, setProviders] = useState([]);
    const [selectedProvider, setSelectedProvider] = useState("gemini");
    const [providersLoading, setProvidersLoading] = useState(true);

    const DEFAULT_MODELS = {
        gemini: "gemini-2.5-flash",
        openrouter: "google/gemma-4-31b-it:free",
        cerebras: "gpt-oss-120b",
        mistral: "mistral-small-latest"
    };

    React.useEffect(() => {
        if (isOpen && providers.length === 0) {
            getAiProviders()
                .then(res => {
                    setProviders(res.data.providers);
                    // Auto-select the first configured provider
                    const configured = res.data.providers.find(p => p.configured);
                    if (configured) setSelectedProvider(configured.id);
                })
                .catch(err => console.error("Provider check failed", err))
                .finally(() => setProvidersLoading(false));
        }
    }, [isOpen]);

    const currentProvider = providers.find(p => p.id === selectedProvider);
    const isConfigured = currentProvider?.configured ?? false;
    const configuredProviders = providers.filter(p => p.configured);
    const hasConfiguredProviders = configuredProviders.length > 0;

    const handleGenerate = async () => {
        if (!prompt.trim() || !isConfigured) return;
        setLoading(true);
        setGenerateError(null);
        try {
            const res = await api.post("/api/teacher/ai/generate", {
                prompt,
                provider: selectedProvider,
                model: DEFAULT_MODELS[selectedProvider]
            });
            setGeneratedQuestions(res.data.questions);
            setExpandedQ(null);
        } catch (err) {
            console.error(err);
            const status = err.response?.status;
            const msg = err.response?.data?.error || err.message;
            if (status === 429) {
                setGenerateError("⏳ Rate limit reached — " + msg);
            } else {
                setGenerateError("❌ " + msg);
            }
        } finally {
            setLoading(false);
        }
    };

    const toggleExpand = (i) => {
        setExpandedQ(expandedQ === i ? null : i);
    };

    return (
        <div className={`fixed right-0 top-0 h-full w-125 bg-[#18181b] border-l border-gray-700 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-[#252526]">
                <h3 className="text-lg font-bold text-transparent bg-clip-text bg-linear-to-r from-purple-400 to-pink-600 flex items-center"><Sparkles className="w-5 h-5 mr-2 text-purple-400" /> AI Assistant</h3>
                <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="p-4 flex-1 overflow-y-auto">
                {providersLoading ? (
                    <div className="text-center text-gray-500 mt-10">Loading providers...</div>
                ) : (
                    <>
                        {/* Provider Selector */}
                        {hasConfiguredProviders && (
                            <div className="mb-4">
                                <label className="block text-xs text-gray-500 uppercase tracking-wider font-bold mb-2">AI Provider</label>
                                <div className="relative">
                                    <select
                                        value={selectedProvider}
                                        onChange={(e) => setSelectedProvider(e.target.value)}
                                        className="w-full appearance-none bg-[#2a2a2b] border border-gray-600 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 cursor-pointer pr-10"
                                    >
                                        {configuredProviders.map(p => (
                                            <option key={p.id} value={p.id}>
                                                {p.name}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                </div>
                                {currentProvider && (
                                    <p className="text-xs text-gray-500 mt-1.5">{currentProvider.description}</p>
                                )}
                            </div>
                        )}

                        {/* Not Configured Warning */}
                        {!isConfigured ? (
                            <div className="bg-yellow-900/20 border border-yellow-700/50 p-4 rounded-lg text-sm text-yellow-200 space-y-3">
                                <div className="flex items-start gap-2">
                                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-semibold">
                                            {!hasConfiguredProviders ? "No AI Providers Configured" : `${currentProvider?.name || selectedProvider} is not configured.`}
                                        </p>
                                        <p className="text-yellow-300/70 mt-1">
                                            {!hasConfiguredProviders ? "Please configure at least one API key in Settings to use the AI assistant." : "Add your API key in Settings to use this provider."}
                                        </p>
                                    </div>
                                </div>
                                <Link
                                    to="/teacher/settings"
                                    onClick={onClose}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-700/30 hover:bg-yellow-700/50 border border-yellow-600/30 rounded-lg text-sm font-medium text-yellow-200 transition-colors"
                                >
                                    <Settings className="w-4 h-4" />
                                    Go to Settings
                                </Link>
                            </div>
                        ) : (
                            <>
                                {/* Prompt Input */}
                                <div className="mb-4">
                                    <textarea 
                                        value={prompt}
                                        onChange={(e) => setPrompt(e.target.value)}
                                        placeholder="Describe your questions..."
                                        className="w-full bg-[#2a2a2b] border border-gray-600 rounded p-3 text-sm text-white h-32 resize-none"
                                    />
                                    <button 
                                        onClick={handleGenerate}
                                        disabled={loading || !prompt.trim()}
                                        className={`w-full mt-2 py-2 rounded font-bold text-sm transition ${loading ? 'bg-gray-700' : 'bg-purple-600 hover:bg-purple-700 text-white'}`}
                                    >
                                        {loading ? "Generating..." : `Generate with ${currentProvider?.name || selectedProvider}`}
                                    </button>
                                </div>

                                {/* Inline Error Banner */}
                                {generateError && (
                                    <div className="mb-3 p-3 rounded-lg bg-red-950/60 border border-red-700/50 text-red-300 text-xs leading-relaxed">
                                        {generateError}
                                        <button onClick={() => setGenerateError(null)} className="ml-2 text-red-400 hover:text-white font-bold">✕</button>
                                    </div>
                                )}

                                {/* Generated Questions */}
                                <div className="space-y-4">
                                    {generatedQuestions.map((q, i) => (
                                        <div key={i} className="bg-[#2a2a2b] border border-gray-700 rounded p-3 relative group">
                                            <div className="pr-16 cursor-pointer" onClick={() => toggleExpand(i)}>
                                                <p className="font-semibold text-sm text-white">{q.question}</p>
                                                <p className="text-xs text-gray-400 mt-1 uppercase font-bold">{q.type} • {q.marks} Marks</p>
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="absolute top-2 right-2 flex gap-2">
                                                 <button 
                                                    onClick={() => onPopulateForm(q)}
                                                    className="bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white px-2 py-1 rounded text-xs font-bold transition"
                                                    title="Edit in Form"
                                                >
                                                    Edit
                                                </button>
                                            </div>

                                            {/* Expanded Details */}
                                            {expandedQ === i && (
                                                <div className="mt-3 pt-3 border-t border-gray-700 text-xs text-gray-300 space-y-2">
                                                    {q.type === 'mcq' && (
                                                        <>
                                                            <p><span className="text-gray-500">Options:</span> {q.options?.join(", ")}</p>
                                                            <p><span className="text-green-400">Answer:</span> {q.answer}</p>
                                                        </>
                                                    )}
                                                    {q.type === 'code' && (
                                                        <>
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <p><span className="text-gray-500">Lang:</span> {q.language}</p>
                                                                <p><span className="text-gray-500">Function:</span> <span className="text-mono text-yellow-500">{q.functionName || "N/A"}</span></p>
                                                            </div>
                                                            <p><span className="text-gray-500">Input:</span> {q.inputFormat}</p>
                                                            <p><span className="text-gray-500">Output:</span> {q.outputFormat}</p>
                                                            <div className="bg-[#202021] p-2 rounded">
                                                                <p className="text-gray-500 mb-1">Test Cases:</p>
                                                                {q.testCases?.map((tc, idx) => (
                                                                    <div key={idx} className="flex gap-2 font-mono text-[10px] text-green-400">
                                                                        <span>in: {tc.input}</span>
                                                                        <ArrowRight className="w-4 h-4 mx-2 text-gray-500 inline" />
                                                                        <span>out: {tc.output}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
