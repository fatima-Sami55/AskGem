import React, { useState, useEffect } from 'react';
import { Container } from '../components/layout/container';
import { Button } from '../components/ui/button';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Globe, BookOpen, Award, Calendar, FolderOpen, ArrowUpRight } from 'lucide-react';
import { getProfiles, getProfile } from '../services/api';

const Landing = () => {
    const [profiles, setProfiles] = useState([]);
    const [loadingProfiles, setLoadingProfiles] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const loadProfiles = async () => {
            try {
                const res = await getProfiles();
                if (res?.status === 'success') {
                    setProfiles(res.data.profiles || []);
                }
            } catch (err) {
                console.error("Error loading profiles:", err);
            } finally {
                setLoadingProfiles(false);
            }
        };
        loadProfiles();
    }, []);

    const handleResume = async (studentId) => {
        try {
            const res = await getProfile(studentId);
            if (res?.status === 'success') {
                const profile = res.data.profile;
                localStorage.setItem('currentStudentId', studentId);
                
                if (profile.report_generated && profile.lastRecommendations) {
                    localStorage.setItem('reportGenerated', 'true');
                    
                    const recData = { 
                        recommendations: profile.lastRecommendations,
                        summary: profile.lastRecommendationsSummary || "Matched options"
                    };
                    localStorage.setItem('recommendationsData', JSON.stringify(recData));
                    
                    const roadmapData = { 
                        roadmap: profile.lastRoadmap 
                    };
                    if (profile.lastRoadmap) {
                        localStorage.setItem('roadmapData', JSON.stringify(roadmapData));
                    }
                    
                    navigate('/results', {
                        state: {
                            recommendations: recData,
                            roadmap: roadmapData,
                            profileId: studentId
                        }
                    });
                } else {
                    localStorage.setItem('reportGenerated', 'false');
                    navigate('/questionnaire', { 
                        state: { 
                            resumeProfileId: studentId, 
                            questionCount: profile.question_count || 0 
                        } 
                    });
                }
            }
        } catch (err) {
            console.error("Error resuming profile:", err);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return 'Recent';
        const date = new Date(dateStr);
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    };
    return (
        <div className="bg-background relative overflow-hidden">
            {/* Animated Background Mesh */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-brand/10 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-accent/10 rounded-full blur-[120px] animate-pulse delay-1000" />
            </div>

            {/* Hero Section */}
            <section className="relative pt-32 pb-40">
                <Container className="relative z-10 flex flex-col items-center text-center">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5 }}
                        className="mb-8"
                    >
                        <span className="px-4 py-1.5 rounded-full border border-brand/30 bg-brand/10 text-brand text-sm font-medium">
                            🚀 AI-Powered Career Planning
                        </span>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                    >
                        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8">
                            Your Future Designed <br className="hidden md:block" />
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand via-accent to-pink-500">
                                Powered by Intelligence.
                            </span>
                        </h1>
                        <p className="max-w-[700px] text-xl text-muted-foreground mb-10 mx-auto leading-relaxed">
                            Stop guessing your next move. AskGem analyzes your unique profile to build a personalized roadmap to your dream university and scholarship.
                        </p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="flex flex-col sm:flex-row gap-4"
                    >
                        <Link to="/questionnaire">
                            <Button size="lg" className="h-14 px-10 text-lg rounded-full shadow-lg shadow-brand/20 hover:shadow-brand/40 transition-all bg-gradient-to-r from-brand to-accent border-0 hover:scale-105">
                                Start Your Journey <ArrowRight className="ml-2 h-5 w-5" />
                            </Button>
                        </Link>
                        {/* <Button variant="outline" size="lg" className="h-14 px-10 text-lg rounded-full border-2 hover:bg-secondary/50">
                            View Demo
                        </Button> */}
                    </motion.div>
                </Container>
            </section>

            {/* Resume Session Section */}
            {profiles.length > 0 && (
                <section className="py-16 bg-secondary/30 relative border-y border-border/50">
                    <Container>
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                            <div>
                                <h2 className="text-2xl font-bold tracking-tight mb-2 flex items-center gap-2 text-foreground">
                                    <FolderOpen className="text-brand h-6 w-6" /> Resume Your Planning Sessions
                                </h2>
                                <p className="text-muted-foreground text-sm">
                                    Select one of your previously created student profiles to continue mapping your career.
                                </p>
                            </div>
                        </div>

                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {profiles.slice(0, 6).map((p) => (
                                <div 
                                    key={p.id}
                                    className="bg-card border border-border/60 hover:border-brand/40 hover:shadow-lg transition-all rounded-2xl p-6 flex flex-col justify-between group relative overflow-hidden"
                                >
                                    <div className="absolute top-0 right-0 p-3 text-muted-foreground/30 group-hover:text-brand/50 transition-colors">
                                        <ArrowUpRight className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="w-8 h-8 rounded-full bg-brand/10 text-brand flex items-center justify-center font-bold text-xs uppercase">
                                                {(p.name || "S").charAt(0)}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-foreground text-base leading-snug group-hover:text-brand transition-colors">
                                                    {p.name || "Unnamed Student"}
                                                </h3>
                                                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                                    <Calendar size={12} /> Updated {formatDate(p.lastUpdated)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="space-y-1.5 text-sm my-4 bg-secondary/30 p-3 rounded-xl border border-border/50">
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs text-muted-foreground uppercase tracking-wider">Major:</span>
                                                <span className="font-medium text-foreground truncate max-w-[150px]">{p.intended_major || "General"}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs text-muted-foreground uppercase tracking-wider">Goal:</span>
                                                <span className="font-medium text-foreground truncate max-w-[150px]">{p.career_goal || "Advising"}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <Button 
                                        onClick={() => handleResume(p.id)}
                                        variant="outline" 
                                        className="w-full rounded-full hover:bg-brand hover:text-white transition-all text-xs h-9 mt-2"
                                    >
                                        {p.report_generated ? "Open Dashboard" : "Resume Questionnaire"}
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </Container>
                </section>
            )}

            {/* Features Preview with Glassmorphism */}
            <section id="features" className="py-32 relative">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-secondary/20 -z-10" />
                <Container>
                    <div className="text-center mb-20">
                        <h2 className="text-4xl font-bold tracking-tight mb-6">Why students trust AskGem</h2>
                        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                            We don't just list universities. We create a strategy.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        <FeatureCard
                            icon={<Globe className="h-10 w-10 text-brand" />}
                            title="Global Discovery"
                            description="Access a database of top international universities tailored to your academic profile and budget constraints."
                            delay={0.1}
                        />
                        <FeatureCard
                            icon={<Award className="h-10 w-10 text-warning" />}
                            title="Smart Scholarships"
                            description="Don't just apply—qualify. We identify high-value scholarships where you have the highest winning probability."
                            delay={0.2}
                        />
                        <FeatureCard
                            icon={<BookOpen className="h-10 w-10 text-success" />}
                            title="Actionable Roadmap"
                            description="A month-by-month timeline telling you exactly what exams to take, essays to write, and deadlines to meet."
                            delay={0.3}
                        />
                    </div>
                </Container>
            </section>

            {/* Testimonials Carousel */}
            <section id="testimonials" className="py-24 bg-background relative overflow-hidden">
                <Container>
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold tracking-tight mb-4">Trusted by ambitious students</h2>
                        <p className="text-muted-foreground">Join thousands who have found their path with AskGem.</p>
                    </div>

                    {/* Carousel Container - Infinite Scroll */}
                    <div className="relative w-full overflow-hidden mask-gradient-to-r from-transparent via-black to-transparent">
                        <motion.div
                            className="flex gap-6 w-max"
                            animate={{ x: ["0%", "-50%"] }}
                            transition={{
                                repeat: Infinity,
                                ease: "linear",
                                duration: 30
                            }}
                        >
                            {[...testimonials, ...testimonials].map((t, i) => (
                                <TestimonialCard
                                    key={i}
                                    {...t}
                                />
                            ))}
                        </motion.div>
                    </div>

                    {/* Gradient Masks for fading edges */}
                    <div className="absolute top-0 left-0 h-full w-20 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
                    <div className="absolute top-0 right-0 h-full w-20 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
                </Container>
            </section>
        </div>
    );
};

const testimonials = [
    {
        quote: "I found my dream scholarship in Germany within minutes. AskGem showed me options I didn't know existed.",
        author: "Areesha H.",
        role: "Computer Science Student"
    },
    {
        quote: "The roadmap feature is a game changer. It told me exactly what exams to take and when to apply.",
        author: "Maryam Z.",
        role: "Engineering Applicant"
    },
    {
        quote: "Honestly, the AI university matching is scary accurate. It matched me with schools that fit my budget perfectly.",
        author: "Ahmed J.",
        role: "MBA Candidate"
    },
    {
        quote: "Process was so smooth. The question flow felt like talking to a real counselor.",
        author: "Mufaza U.",
        role: "Medical Student"
    },
    {
        quote: "Saved me months of research. The step-by-step guide is invaluable.",
        author: "Michael T.",
        role: "Law Student"
    }
];

const FeatureCard = ({ icon, title, description, delay }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay }}
            className="group relative p-8 rounded-3xl bg-background/50 backdrop-blur-sm border border-white/10 hover:border-brand/30 transition-all hover:shadow-2xl hover:shadow-brand/10 hover:-translate-y-1"
        >
            <div className="absolute inset-0 bg-gradient-to-br from-brand/5 to-accent/5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10">
                <div className="mb-6 bg-secondary/50 w-16 h-16 rounded-2xl flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform">
                    {icon}
                </div>
                <h3 className="text-2xl font-bold mb-4">{title}</h3>
                <p className="text-muted-foreground leading-relaxed">{description}</p>
            </div>
        </motion.div>
    )
}

const TestimonialCard = ({ quote, author, role, delay }) => {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay }}
            className="min-w-[85vw] md:min-w-[400px] snap-center bg-secondary/10 p-8 rounded-3xl border border-border/50 hover:border-brand/20 transition-colors"
        >
            <div className="flex flex-col h-full justify-between">
                <div>
                    <div className="flex gap-1 mb-4 text-warning">
                        {"★★★★★".split("").map((star, i) => <span key={i}>{star}</span>)}
                    </div>
                    <p className="text-lg italic text-muted-foreground mb-6 leading-relaxed">"{quote}"</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand to-accent flex items-center justify-center text-white font-bold text-sm">
                        {author.charAt(0)}
                    </div>
                    <div>
                        <p className="font-bold text-foreground">{author}</p>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">{role}</p>
                    </div>
                </div>
            </div>
        </motion.div>
    )
}

const Stat = ({ number, label }) => (
    <div>
        <div className="text-4xl font-extrabold text-foreground mb-2">{number}</div>
        <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{label}</div>
    </div>
)

export default Landing;
