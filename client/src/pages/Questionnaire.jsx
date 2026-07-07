import React, { useState, useEffect, useRef } from 'react';
import { Container } from '../components/layout/container';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, User, Sparkles, Loader2, GraduationCap } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { saveProfile, updateProfile, getNextQuestion, getProfile } from '../services/api';
import { ServiceBusy } from '../components/features/ServiceBusy';

// --- Static Questions Configuration ---
const STATIC_QUESTIONS = [
    {
        id: 'name',
        text: "Hello! I'm Gem, your AI academic counselor. I'm here to build your personalized path to success. First things first, what is your full name?",
        type: 'text',
        placeholder: 'e.g. Alex Johnson',
        validation: { minLength: 2, maxLength: 50 }
    },
    {
        id: 'age',
        text: "Nice to meet you! How old are you?",
        type: 'number',
        placeholder: 'e.g. 18',
        validation: { min: 14, max: 100 }
    },
    {
        id: 'currentEducation',
        text: "What is your current education level?",
        type: 'select',
        options: ['High School', 'Undergraduate', 'Postgraduate', 'Working Professional']
    },
    {
        id: 'english_proficiency',
        text: "How would you rate your English proficiency?",
        type: 'select',
        options: ['Native', 'Advanced', 'Intermediate', 'Beginner']
    },
    {
        id: 'intended_major',
        text: "What major or field of study are you aiming for?",
        type: 'text',
        placeholder: 'e.g. Computer Science',
        validation: { minLength: 2 }
    },
    {
        id: 'gpa',
        text: "What is your current GPA? (0.0 - 4.0 scale)",
        type: 'number',
        placeholder: 'e.g. 3.5',
        validation: { min: 0, max: 4.0 }
    },
    {
        id: 'country_preference',
        text: "Do you have any specific countries in mind for your studies?",
        type: 'text',
        placeholder: 'e.g. USA, UK, Germany, Canada'
    },
    {
        id: 'interests',
        text: "What are some of your specific academic interests? (Separate by comma)",
        type: 'text',
        placeholder: 'e.g. Robotics, Ethics, History'
    },
    {
        id: 'budget_range',
        text: "To help me find the best options, what is your annual budget range for tuition?",
        type: 'select',
        options: ['Less than $10k', '$10k - $30k', '$30k - $50k', '$50k+']
    },
    {
        id: 'career_goal',
        text: "What is your dream career goal?",
        type: 'text',
        placeholder: 'e.g. AI Researcher'
    }
];

const MAX_DYNAMIC_QUESTIONS = 4;

const Questionnaire = () => {
    // --- State ---
    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const [currentStep, setCurrentStep] = useState(0); // Index for STATIC_QUESTIONS
    const [formData, setFormData] = useState({});

    // Phase Management
    const [isDynamicPhase, setIsDynamicPhase] = useState(false);
    const [dynamicCount, setDynamicCount] = useState(0);
    const [currentDynamicQ, setCurrentDynamicQ] = useState(null);
    const [profileId, setProfileId] = useState(null);
    const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);

    const navigate = useNavigate();
    const location = useLocation();
    const scrollRef = useRef(null);
    const hasInitialized = useRef(false);

    // --- Effects ---

    // Initial Greeting & Resumption
    useEffect(() => {
        if (hasInitialized.current) return;
        hasInitialized.current = true;

        const initQuestionnaire = async () => {
            const resumeId = location.state?.resumeProfileId;
            if (resumeId) {
                try {
                    setIsTyping(true);
                    const res = await getProfile(resumeId);
                    if (res?.status === 'success') {
                        const profile = res.data.profile;
                        setProfileId(resumeId);
                        
                        const reconstructedMessages = [];
                        const localFormData = {};
                        let lastStep = 0;

                        // Reconstruct answered static questions
                        for (let i = 0; i < STATIC_QUESTIONS.length; i++) {
                            const q = STATIC_QUESTIONS[i];
                            const answer = profile[q.id];
                            
                            if (answer !== undefined && answer !== null && answer !== '') {
                                reconstructedMessages.push({ type: 'bot', text: q.text, timestamp: new Date() });
                                reconstructedMessages.push({ type: 'user', text: String(answer), timestamp: new Date() });
                                localFormData[q.id] = answer;
                                lastStep = i + 1;
                            } else {
                                break;
                            }
                        }

                        setFormData(localFormData);

                        if (lastStep < STATIC_QUESTIONS.length) {
                            setCurrentStep(lastStep);
                            reconstructedMessages.push({ type: 'bot', text: STATIC_QUESTIONS[lastStep].text, timestamp: new Date() });
                            setMessages(reconstructedMessages);
                            setIsTyping(false);
                        } else {
                            setIsDynamicPhase(true);
                            reconstructedMessages.push({ type: 'bot', text: "Welcome back! Retrieving your custom advising profile...", timestamp: new Date() });
                            setMessages(reconstructedMessages);
                            
                            const dynCount = profile.question_count || 1;
                            setDynamicCount(dynCount);

                            const nextQ = await getNextQuestion(resumeId);
                            setIsTyping(false);
                            setCurrentDynamicQ(nextQ.data);
                            addBotMessage(nextQ.data.question);
                        }
                    }
                } catch (e) {
                    console.error("Error resuming questionnaire:", e);
                    addBotMessage(STATIC_QUESTIONS[0].text);
                    setIsTyping(false);
                }
            } else {
                setTimeout(() => {
                    addBotMessage(STATIC_QUESTIONS[0].text);
                }, 500);
            }
        };
        initQuestionnaire();
    }, [location.state]);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isTyping]);

    // --- Helpers ---

    const addBotMessage = (text) => {
        setMessages(prev => [...prev, { type: 'bot', text, timestamp: new Date() }]);
    };

    const addUserMessage = (text) => {
        setMessages(prev => [...prev, { type: 'user', text, timestamp: new Date() }]);
    };

    const handleStaticPhase = async (answer) => {
        // 1. Store Answer
        const currentQ = STATIC_QUESTIONS[currentStep];
        const newFormData = { ...formData, [currentQ.id]: answer };
        setFormData(newFormData);

        // 2. Check if more static questions remain
        if (currentStep < STATIC_QUESTIONS.length - 1) {
            setIsTyping(true);
            setTimeout(() => {
                setCurrentStep(prev => prev + 1);
                addBotMessage(STATIC_QUESTIONS[currentStep + 1].text);
                setIsTyping(false);
            }, 800); // Simulate typing delay
        } else {
            // 3. Transition to Dynamic Phase
            setIsTyping(true);
            addBotMessage("Thanks for sharing! Analyzing your profile now to tailor my next questions...");

            try {
                // Initial Save to Backend
                const studentId = profileId || 'student_' + Math.random().toString(36).substr(2, 9);
                localStorage.setItem('currentStudentId', studentId);

                // Format interests as array
                const interestsArray = newFormData.interests && typeof newFormData.interests === 'string'
                    ? newFormData.interests.split(',').map(s => s.trim())
                    : (Array.isArray(newFormData.interests) ? newFormData.interests : []);

                const profileData = {
                    id: studentId,
                    ...newFormData,
                    interests: interestsArray,
                    risk_tolerance: 'Medium' // Default
                };

                if (profileId) {
                    await updateProfile(studentId, profileData);
                } else {
                    await saveProfile(profileData);
                    setProfileId(studentId);
                }

                // Fetch First Dynamic Question
                const aiRes = await getNextQuestion(studentId);
                const questionData = aiRes.data;

                setIsDynamicPhase(true);
                setDynamicCount(1);
                setCurrentDynamicQ(questionData);

                setIsTyping(false);
                addBotMessage(questionData.question);

            } catch (error) {
                console.error("Error starting dynamic phase:", error);

                if (error.response && error.response.status === 429) {
                    setIsQuotaExceeded(true);
                    return;
                }

                // Fallback: If AI fails, proceed to loading (where it might try again or fail gracefully)
                // But we must have a profileId. If saveProfile failed, we are in trouble.
                // If it was a 400 error, we should probably tell the user or retry.
                if (error.response && error.response.status === 400) {
                    addBotMessage("I'm having trouble understanding some details. Let's try to generate the results with what we have.");
                    navigate('/loading', { state: { profileId: 'demo_id', error: true } });
                } else {
                    navigate('/loading', { state: { profileId: 'demo_id' } });
                }
            }
        }
    };

    const handleDynamicPhase = async (answer) => {
        setIsTyping(true);

        try {
            // Save answer
            await updateProfile(profileId, {
                additional_info: (formData.additional_info || "") + `\nQ: ${currentDynamicQ.question}\nA: ${answer}`
            });

            // Update local state for accumulation if needed
            setFormData(prev => ({
                ...prev,
                additional_info: (prev.additional_info || "") + `\nQ: ${currentDynamicQ.question}\nA: ${answer}`
            }));

            if (dynamicCount < MAX_DYNAMIC_QUESTIONS) {
                // Fetch Next
                const aiRes = await getNextQuestion(profileId);
                const nextQ = aiRes.data;

                setDynamicCount(prev => prev + 1);
                setCurrentDynamicQ(nextQ);

                setIsTyping(false);
                addBotMessage(nextQ.question);
            } else {
                // Finish
                addBotMessage("Perfect! I have everything I need. Generating your roadmap now...");
                setTimeout(() => {
                    navigate('/loading', { state: { profileId } });
                }, 2000);
            }

        } catch (error) {
            console.error("Error in dynamic loop:", error);

            if (error.response && error.response.status === 429) {
                setIsQuotaExceeded(true);
                return;
            }

            // If dynamic loop fails, just go to results
            navigate('/loading', { state: { profileId } });
        }
    };

    const [error, setError] = useState(null);

    const validateInput = (value, q) => {
        if (!value) return "This field is required."; // Simplified check
        if (!q.validation) return null;
        if (q.type === 'number') {
            const num = parseFloat(value);
            if (isNaN(num)) return "Please enter a valid number.";
            if (q.validation.min !== undefined && num < q.validation.min) return `Minimum value is ${q.validation.min}.`;
            if (q.validation.max !== undefined && num > q.validation.max) return `Maximum value is ${q.validation.max}.`;
        }
        if (q.type === 'text') {
            if (q.validation.minLength && value.length < q.validation.minLength) return `Minimum ${q.validation.minLength} characters required.`;
            if (q.validation.maxLength && value.length > q.validation.maxLength) return `Maximum ${q.validation.maxLength} characters allowed.`;
        }
        return null;
    };

    const handleSend = () => {
        if (!inputValue.trim()) return;

        // Validation for Static Phase
        if (!isDynamicPhase) {
            const currentQ = STATIC_QUESTIONS[currentStep];
            const validationError = validateInput(inputValue, currentQ);
            if (validationError) {
                setError(validationError);
                return;
            }
        }

        setError(null);
        const answer = inputValue;
        setInputValue(""); // Clear input
        addUserMessage(answer);

        if (!isDynamicPhase) {
            handleStaticPhase(answer);
        } else {
            handleDynamicPhase(answer);
        }
    };

    const handleOptionSelect = (option) => {
        addUserMessage(option);
        if (!isDynamicPhase) {
            handleStaticPhase(option);
        } else {
            // Should rarely happen unless dynamic Q sends options (not implemented yet)
            handleDynamicPhase(option);
        }
    };

    // --- Render Logic ---

    // Determine Input Type
    const currentQ = isDynamicPhase ? { type: 'text', placeholder: 'Type your answer...' } : STATIC_QUESTIONS[currentStep];
    const isSelect = !isDynamicPhase && currentQ.type === 'select';

    if (isQuotaExceeded) {
        return <ServiceBusy onRetry={() => window.location.reload()} />;
    }

    return (
        <div className="min-h-screen bg-background relative overflow-hidden flex flex-col pt-16">
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand/5 rounded-full blur-[100px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/5 rounded-full blur-[100px] animate-pulse delay-1000" />
            </div>

            <Container className="flex-1 flex flex-col max-w-3xl w-full mx-auto md:py-8 h-[80vh]">

                {/* Chat History Area */}
                <div
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth"
                >
                    <AnimatePresence>
                        {messages.map((msg, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                transition={{ duration: 0.3 }}
                                className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div className={`flex items-end gap-3 max-w-[80%] ${msg.type === 'user' ? 'flex-row-reverse' : ''}`}>

                                    {/* Avatar */}
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.type === 'user'
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-gradient-to-br from-brand to-accent text-white'
                                        }`}>
                                        {msg.type === 'user' ? <User size={16} /> : <GraduationCap size={16} />}
                                    </div>

                                    {/* Bubble */}
                                    <div className={`p-4 rounded-2xl shadow-sm ${msg.type === 'user'
                                        ? 'bg-primary text-primary-foreground rounded-br-none'
                                        : 'bg-secondary/80 backdrop-blur-md border border-white/10 rounded-bl-none'
                                        }`}>
                                        <p className="text-sm md:text-base leading-relaxed">{msg.text}</p>
                                    </div>

                                </div>
                            </motion.div>
                        ))}

                        {/* Typing Indicator */}
                        {isTyping && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex justify-start"
                            >
                                <div className="flex items-end gap-3">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand to-accent flex items-center justify-center text-white shrink-0">
                                        <Sparkles size={16} className="animate-spin-slow" />
                                    </div>
                                    <div className="bg-secondary/50 p-4 rounded-2xl rounded-bl-none">
                                        <div className="flex gap-1.5">
                                            <div className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                            <div className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                            <div className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce" />
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Input Area */}
                <div className="p-4 bg-background/80 backdrop-blur-md border-t border-border/50 sticky bottom-0">
                    <div className="max-w-3xl mx-auto w-full">
                        {isSelect ? (
                            <div className="flex flex-wrap gap-2 justify-end">
                                {currentQ.options.map((opt) => (
                                    <Button
                                        key={opt}
                                        variant="outline"
                                        className="rounded-full hover:bg-primary hover:text-primary-foreground transition-all"
                                        onClick={() => handleOptionSelect(opt)}
                                    >
                                        {opt}
                                    </Button>
                                ))}
                            </div>
                        ) : (
                            <form
                                onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                                className="relative flex flex-col gap-2"
                            >
                                {error && (
                                    <div className="absolute -top-8 left-4 px-3 py-1 bg-error/10 border border-error/20 text-error text-xs rounded-full backdrop-blur-md animate-in fade-in slide-in-from-bottom-2">
                                        {error}
                                    </div>
                                )}
                                <div className="flex items-center gap-2 relative">
                                    <Input
                                        value={inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        placeholder={currentQ.placeholder || "Type a message..."}
                                        className="pr-12 h-14 rounded-full text-base bg-secondary/30 border-secondary-foreground/10 focus-visible:ring-brand/20"
                                        autoFocus
                                        disabled={isTyping}
                                        type={currentQ.type || 'text'}
                                        step={currentQ.type === 'number' ? "any" : undefined}
                                    />
                                    <Button
                                        type="submit"
                                        size="icon"
                                        disabled={!inputValue.trim() || isTyping}
                                        className="absolute right-2 top-2 h-10 w-10 rounded-full bg-brand hover:bg-brand/90 text-white shadow-md shadow-brand/20"
                                    >
                                        {isTyping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>

            </Container>
        </div>
    );
};

export default Questionnaire;
