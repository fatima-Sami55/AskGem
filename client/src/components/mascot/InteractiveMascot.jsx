import React, { useEffect, useState, useRef, useMemo, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useMascot } from '../../context/MascotContext';
import './InteractiveMascot.css';

// Shown on hover — general tips Peri gives unprompted
const HOVER_TIPS = [
  "💡 Tip: IELTS 6.5+ opens doors to most European universities!",
  "🎓 Did you know? Germany has 400+ tuition-free universities!",
  "📋 Your profile score improves when you add your test scores.",
  "✈️ Applying to several well-matched universities can improve your options.",
  "💰 Many Canadian universities offer merit scholarships — check yours!",
  "🌍 Your GPA converts differently per country. I handle that for you!",
  "📅 Most fall deadlines are in January–March. Plan early!",
];

// Shown on click — slightly more personal / action-prompting
const CLICK_MESSAGES = [
  "Click on any suggestion below to explore it! 👇",
  "Ask me anything — universities, scholarships, visa requirements!",
  "I can compare programs for you. Just tell me what you're looking for!",
  "Want to know your chances for a specific university? Just ask! 🎯",
  "Tell me your budget and I'll find the best countries for you! 💸",
];

export default function InteractiveMascot({ size = 120, interactive = true, isLoginPage = false }) {
  const { mood, action, accessories, speechText, clearSpeech, setSpeech, setAccessories, resetInactivityTimer, triggerMascotAction } = useMascot();
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isBlinking, setIsBlinking] = useState(false);
  const [randomIdle, setRandomIdle] = useState(null); // 'blink' | 'yawn' | 'shift' | null
  const [reducedMotion, setReducedMotion] = useState(false);

  const containerRef = useRef(null);
  const blinkTimerRef = useRef(null);
  const idleBehaviorTimerRef = useRef(null);

  const [bubbleStyle, setBubbleStyle] = useState({});

  const updateBubblePosition = useCallback(() => {
    if (!containerRef.current || !speechText) return;
    const rect = containerRef.current.getBoundingClientRect();

    let hatOffset = 0;
    if (accessories?.party_hat) {
      hatOffset = -81;
    } else if (accessories?.sleeping_cap) {
      hatOffset = -125;
    }

    const headTopInContainer = ((60 + hatOffset) / 512) * size;
    const screenHeadTop = rect.top + headTopInContainer;

    let bubbleTop;
    if (isLoginPage) {
      bubbleTop = Math.max(screenHeadTop - 2, 80);
    } else {
      bubbleTop = Math.max(screenHeadTop - 6, 142);
    }

    const bubbleLeft = rect.left + (300 / 512) * size - 18;

    setBubbleStyle({
      position: 'fixed',
      top: `${bubbleTop}px`,
      left: `${bubbleLeft}px`,
      transform: 'translateY(-100%)',
      zIndex: 9999,
      maxWidth: '240px',
      width: 'max-content',
      background: 'rgba(15, 23, 42, 0.95)',
      border: '1px solid rgba(255, 255, 255, 0.12)',
      borderRadius: '16px',
      padding: '10px 14px',
      color: '#ffffff',
      fontSize: '12px',
      lineHeight: '1.55',
      fontWeight: '550',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 1px rgba(255,255,255,0.15) inset',
      backdropFilter: 'blur(12px)',
      cursor: 'pointer',
      textAlign: 'left',
      whiteSpace: 'pre-wrap',
      pointerEvents: 'auto',
    });
  }, [speechText, accessories, size, isLoginPage]);

  useLayoutEffect(() => {
    if (!speechText) return;
    updateBubblePosition();

    window.addEventListener('scroll', updateBubblePosition, { capture: true, passive: true });
    window.addEventListener('resize', updateBubblePosition, { passive: true });

    return () => {
      window.removeEventListener('scroll', updateBubblePosition, { capture: true });
      window.removeEventListener('resize', updateBubblePosition);
    };
  }, [speechText, updateBubblePosition]);

  const hoverTipIndexRef = useRef(0);
  const speechDismissTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (speechDismissTimerRef.current) clearTimeout(speechDismissTimerRef.current);
    };
  }, []);

  const showTip = (pool) => {
    if (!interactive) return;
    if (speechDismissTimerRef.current) clearTimeout(speechDismissTimerRef.current);

    // Verify page state: filter out chat-only messages if on login page
    let filteredPool = pool;
    if (isLoginPage) {
      filteredPool = pool.filter(
        (msg) => msg !== "Click on any suggestion below to explore it! 👇"
      );
    }

    const idx = hoverTipIndexRef.current % filteredPool.length;
    hoverTipIndexRef.current += 1;
    setSpeech(filteredPool[idx]);

    // Auto-dismiss after 4s
    speechDismissTimerRef.current = setTimeout(() => {
      clearSpeech();
    }, 4000);
  };

  const handleMascotHover = () => {
    if (action === 'sleeping') {
      resetInactivityTimer();
      return;
    }
    if (action === 'idle' && !speechText) {
      showTip(HOVER_TIPS);
    }
  };

  const handleMascotClick = () => {
    const wasSleeping = action === 'sleeping';
    resetInactivityTimer();
    showTip(CLICK_MESSAGES);
    if (!wasSleeping && action === 'idle') {
      triggerMascotAction({
        type: 'waving',
        mood: 'happy',
        duration: 900,
        priority: 'LOW',
      });
    }
  };

  const handleKeyDown = (e) => {
    if (interactive && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      handleMascotClick();
    }
  };

  // Party hat during celebrating action (do not touch sleeping_cap — owned by MascotContext)
  useEffect(() => {
    if (action === 'celebrating') {
      setAccessories((prev) => ({ ...prev, party_hat: true }));
    } else if (action !== 'sleeping') {
      setAccessories((prev) => ({ ...prev, party_hat: false }));
    }
  }, [action, setAccessories]);

  // Check prefers-reduced-motion
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);

    const listener = (e) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  // Track mouse coordinates for eye-tracking
  useEffect(() => {
    if (!interactive || reducedMotion) return;

    const handleMouseMove = (e) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const mascotCenterX = rect.left + rect.width / 2;
      const mascotCenterY = rect.top + rect.height / 2;

      const dx = e.clientX - mascotCenterX;
      const dy = e.clientY - mascotCenterY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Max offset in pixels
      const maxOffset = 6;
      if (distance === 0) {
        setMousePos({ x: 0, y: 0 });
      } else {
        const factor = Math.min(distance / 250, 1) * maxOffset;
        setMousePos({
          x: (dx / distance) * factor,
          y: (dy / distance) * factor,
        });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [interactive, reducedMotion]);

  // Natural Blinking Cycle
  useEffect(() => {
    if (reducedMotion) return;

    const scheduleNextBlink = () => {
      const delay = 3000 + Math.random() * 4000; // blink every 3 to 7 seconds
      blinkTimerRef.current = setTimeout(() => {
        setIsBlinking(true);
        setTimeout(() => {
          setIsBlinking(false);
          scheduleNextBlink();
        }, 150); // Blink duration
      }, delay);
    };

    scheduleNextBlink();
    return () => {
      if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current);
    };
  }, [reducedMotion]);

  // Random Idle Behaviors
  useEffect(() => {
    if (action !== 'idle' || reducedMotion) {
      setRandomIdle(null);
      if (idleBehaviorTimerRef.current) clearTimeout(idleBehaviorTimerRef.current);
      return;
    }

    const triggerRandomBehavior = () => {
      const behaviors = ['yawn', 'shift', 'look_away', 'wiggle'];
      const randomBeh = behaviors[Math.floor(Math.random() * behaviors.length)];
      setRandomIdle(randomBeh);

      setTimeout(() => {
        setRandomIdle(null);
        scheduleNextBehavior();
      }, 2000); // Behavior lasts 2s
    };

    const scheduleNextBehavior = () => {
      const delay = 8000 + Math.random() * 8000; // Trigger behavior every 8-16s
      idleBehaviorTimerRef.current = setTimeout(triggerRandomBehavior, delay);
    };

    scheduleNextBehavior();
    return () => {
      if (idleBehaviorTimerRef.current) clearTimeout(idleBehaviorTimerRef.current);
    };
  }, [action, reducedMotion]);

  // Handle Speech Bubble Auto-dismiss on click
  const handleSpeechClick = () => {
    clearSpeech();
  };

  // SVG dimensions
  const svgWidth = 512;
  const svgHeight = 513;

  // Calculate dynamic rotation/translation based on current action & mood
  const motionStyles = useMemo(() => {
    // default baselines
    let headTransform = 'translate(0px, 0px) rotate(0deg)';
    let leftWingTransform = 'translate(0px, 0px) rotate(0deg)';
    let rightWingTransform = 'translate(0px, 0px) rotate(0deg)';
    let leftFootTransform = 'translate(0px, 0px) rotate(0deg)';
    let rightFootTransform = 'translate(0px, 0px) rotate(0deg)';
    let bodyTransform = 'translate(0px, 0px) rotate(0deg)';
    let beakTransform = 'translate(0px, 0px) scale(1)';
    let leftEyeTransform = 'scaleY(1)';
    let rightEyeTransform = 'scaleY(1)';
    let cheeksOpacity = 0.55;

    // Apply reduced motion or standard animations
    if (reducedMotion) {
      // In reduced motion, we use simple static poses for clarity
      switch (action) {
        case 'thinking':
          headTransform = 'scale(1)';
          break;
        case 'sleeping':
          leftEyeTransform = 'scaleY(1)';
          rightEyeTransform = 'scaleY(1)';
          headTransform = 'translateY(4px)';
          break;
        case 'celebrating':
          leftWingTransform = 'rotate(-40deg)';
          rightWingTransform = 'rotate(40deg)';
          bodyTransform = 'translateY(-4px)';
          break;
        case 'disappointed':
          headTransform = 'translateY(5px)';
          leftWingTransform = 'rotate(15deg)';
          rightWingTransform = 'rotate(-15deg)';
          break;
        default:
          break;
      }
    } else {
      // FULL fluid animations
      // 1. Idle behaviors
      if (action === 'idle') {
        if (randomIdle === 'shift') {
          bodyTransform = 'translate(2px, 0px) rotate(1deg)';
          headTransform = 'scale(1)';
        } else if (randomIdle === 'yawn') {
          beakTransform = 'translate(0px, 2px) scale(1.15)';
          headTransform = 'translateY(-2px)';
        } else if (randomIdle === 'look_away') {
          headTransform = 'scale(1)';
        } else if (randomIdle === 'wiggle') {
          leftWingTransform = 'rotate(-8deg)';
          rightWingTransform = 'rotate(8deg)';
        }
      }

      // 2. Main actions
      switch (action) {
        case 'waving':
          rightWingTransform = 'rotate(var(--wave-rotate, -45deg))';
          headTransform = 'scale(1)';
          break;
        case 'thinking':
          headTransform = 'translateY(-2px)';
          rightWingTransform = 'rotate(15deg)';
          beakTransform = 'scale(0.95)';
          break;
        case 'celebrating':
          bodyTransform = 'translateY(var(--bounce-y, -12px))';
          headTransform = 'translateY(var(--bounce-y, -12px))';
          leftWingTransform = 'rotate(-60deg)';
          rightWingTransform = 'rotate(60deg)';
          leftFootTransform = 'rotate(10deg)';
          rightFootTransform = 'rotate(-10deg)';
          cheeksOpacity = 0.95;
          break;
        case 'sleeping':
          leftEyeTransform = 'scaleY(1)';
          rightEyeTransform = 'scaleY(1)';
          headTransform = 'translateY(6px)';
          leftWingTransform = 'rotate(10deg)';
          rightWingTransform = 'rotate(-10deg)';
          bodyTransform = 'scaleY(0.97) translateY(2px)';
          cheeksOpacity = 0.25;
          break;
        case 'dancing':
          bodyTransform = 'translateX(var(--dance-x, 8px)) rotate(var(--dance-rot, 4deg))';
          headTransform = 'translateX(var(--dance-x, 8px))';
          leftWingTransform = 'rotate(var(--dance-wing-l, -35deg))';
          rightWingTransform = 'rotate(var(--dance-wing-r, 35deg))';
          leftFootTransform = 'translateY(var(--dance-foot-l, -2px))';
          rightFootTransform = 'translateY(var(--dance-foot-r, 0px))';
          break;
        case 'pointing':
          rightWingTransform = 'rotate(70deg)';
          headTransform = 'scale(1)';
          break;
        case 'disappointed':
          headTransform = 'translateY(8px)';
          leftWingTransform = 'rotate(18deg)';
          rightWingTransform = 'rotate(-18deg)';
          bodyTransform = 'scaleY(0.96)';
          leftEyeTransform = 'scaleY(0.7)';
          rightEyeTransform = 'scaleY(0.7)';
          break;
        case 'reading':
          headTransform = 'translateY(4px)';
          leftWingTransform = 'rotate(35deg)';
          rightWingTransform = 'rotate(-30deg)';
          leftEyeTransform = 'scaleY(0.95)';
          rightEyeTransform = 'scaleY(0.95)';
          break;
        case 'writing':
          headTransform = 'translateY(3px)';
          leftWingTransform = 'rotate(30deg)';
          rightWingTransform = 'rotate(var(--write-rotate, 15deg))';
          break;
        default:
          break;
      }
    }

    // Overwrite eye scales if blinking
    if (isBlinking && action !== 'sleeping') {
      leftEyeTransform = 'scaleY(0.05)';
      rightEyeTransform = 'scaleY(0.05)';
    }

    return {
      headTransform,
      leftWingTransform,
      rightWingTransform,
      leftFootTransform,
      rightFootTransform,
      bodyTransform,
      beakTransform,
      leftEyeTransform,
      rightEyeTransform,
      cheeksOpacity,
    };
  }, [action, randomIdle, isBlinking, reducedMotion]);

  // Adjust pupil and highlight translate styles
  const eyeOffsetStyle = useMemo(() => {
    if (action === 'sleeping' || reducedMotion) {
      return { transform: 'translate(0px, 0px)' };
    }
    if (action === 'thinking') {
      return { transform: 'translate(-2px, -3px)' };
    }
    return { transform: `translate(${mousePos.x}px, ${mousePos.y}px)` };
  }, [mousePos, action, reducedMotion]);

  // Render SVG Fallback
  const renderSVGMascot = () => (
    <svg
      version="1.1"
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 -90 ${svgWidth} ${svgHeight + 90}`}
      className={`mascot-svg ${action}-action ${mood}-mood`}
      filter="url(#shadowFilter)"
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
      }}
    >
      <defs>
        {/* Sleeping Cap Stripes Pattern */}
        <pattern id="sleepingCapPattern" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="20" height="40" fill="#39B1D1" />
          <rect x="20" width="20" height="40" fill="#ffffff" />
        </pattern>
        {/* Glow Filters for high-fidelity aesthetics */}
        <filter id="cheekGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="shadowFilter" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#000" floodOpacity="0.3" />
        </filter>
      </defs>

      <g>
        {/* Feet Group (Under Body) */}
        <g className="mascot-feet">
          {/* Left Foot */}
          <g
            className="mascot-part-foot-l"
            style={{
              transform: (!reducedMotion && (action === 'celebrating' || action === 'dancing')) ? undefined : motionStyles.leftFootTransform,
              transformOrigin: '335px 440px',
              transition: (!reducedMotion && (action === 'celebrating' || action === 'dancing')) ? 'none' : 'transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)',
            }}
          >
            <path
              d="M0 0 C5.06806858 3.3852013 8.57986593 10.4195805 9.84326172 16.23120117 C10.31199659 21.48103177 9.68274182 24.76916101 6.84326172 29.23120117 C5.21826172 31.16870117 5.21826172 31.16870117 2.84326172 32.23120117 C-3.66591902 32.53993702 -8.58422297 30.37207344 -14.15673828 27.23120117 C-14.38748047 27.82288086 -14.61822266 28.41456055 -14.85595703 29.02416992 C-16.89817137 33.9723019 -18.69282438 38.01303069 -23.15673828 41.23120117 C-26.46923828 41.98120117 -26.46923828 41.98120117 -30.15673828 41.23120117 C-32.41661513 39.62473255 -34.37245669 37.88952288 -36.35986328 35.95776367 C-38.24447957 34.04522547 -38.24447957 34.04522547 -41.15673828 32.23120117 C-41.38361328 32.78807617 -41.61048828 33.34495117 -41.84423828 33.91870117 C-44.01127185 37.73680793 -46.53752474 40.58351575 -50.65673828 42.23120117 C-54.15659469 42.23120117 -55.44415118 41.46908553 -58.15673828 39.23120117 C-63.10997806 33.36937895 -64.64391159 26.61084355 -66.15673828 19.23120117 C-65.06361328 19.09584961 -63.97048828 18.96049805 -62.84423828 18.82104492 C-43.8036013 16.25844546 -25.76361671 11.31504086 -8.75488281 2.25634766 C-7.94390137 1.83426025 -7.13291992 1.41217285 -6.29736328 0.97729492 C-5.5912793 0.5924292 -4.88519531 0.20756348 -4.15771484 -0.18896484 C-2.15673828 -0.76879883 -2.15673828 -0.76879883 0 0 Z"
              fill="#ff9e3b"
              transform="translate(335.15673828125,440.768798828125)"
            />
          </g>
          {/* Right Foot */}
          <g
            className="mascot-part-foot-r"
            style={{
              transform: (!reducedMotion && (action === 'celebrating' || action === 'dancing')) ? undefined : motionStyles.rightFootTransform,
              transformOrigin: '180px 442px',
              transition: (!reducedMotion && (action === 'celebrating' || action === 'dancing')) ? 'none' : 'transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)',
            }}
          >
            <path
              d="M0 0 C4.35933833 0.62393543 7.91783144 2.30471447 11.8125 4.25 C28.18768795 12.06197961 45.22148308 14.96602351 63 18 C62.71192266 19.57666505 62.41612674 21.15192078 62.1171875 22.7265625 C61.95331543 23.60393066 61.78944336 24.48129883 61.62060547 25.38525391 C60.29442235 30.97275242 57.70760453 36.53852608 53 40 C49.49164925 41.11968641 47.77884705 41.33379159 44.375 39.875 C41.76386954 37.81358122 39.89200695 35.73289892 38 33 C38 32.34 38 31.68 38 31 C37.18595703 31.72316406 37.18595703 31.72316406 36.35546875 32.4609375 C35.64003906 33.09257812 34.92460937 33.72421875 34.1875 34.375 C33.47980469 35.00148438 32.77210938 35.62796875 32.04296875 36.2734375 C28.41888704 39.33623695 25.90844528 40.63265329 21.06640625 40.5078125 C17.72612996 39.68695065 16.20229842 37.70618539 14.1875 35.0234375 C12.45088003 32.06432848 11.68488148 29.35591924 11 26 C9.865625 26.66 8.73125 27.32 7.5625 28 C3.15773184 30.20238408 -1.12805497 31.06663885 -6 30 C-8.51649938 27.92316488 -9.86432819 26.19658087 -10.23828125 22.8984375 C-10.53200045 12.91198472 -6.67529244 7.12031194 0 0 Z"
              fill="#ff9e3b"
              transform="translate(180,442)"
            />
          </g>
        </g>


        {/* Main Body Group (back body, white belly, right wing) */}
        <g
          className="mascot-body-group"
          style={{
            transform: (!reducedMotion && (action === 'celebrating' || action === 'dancing'))
              ? undefined
              : motionStyles.bodyTransform,
            transformOrigin: '274px 300px',
            transition: (!reducedMotion && (action === 'celebrating' || action === 'dancing'))
              ? 'none'
              : 'transform 0.5s cubic-bezier(0.25, 0.8, 0.25, 1)',
          }}
        >
          {/* Outer silhouette */}
          <path
            d="M256 42 C318 42 362 96 362 171 C362 211 378 234 396 266 C419 307 416 357 387 394 C358 431 310 448 256 448 C202 448 154 431 125 394 C96 357 93 307 116 266 C134 234 150 211 150 171 C150 96 194 42 256 42 Z"
            fill="#356a73"
          />
          {/* Inner face/belly cutout, layered on top */}
          <path
            d="M256 126 C276 82 331 82 350 126 C363 157 350 197 325 216 C350 261 361 337 330 381 C313 405 286 416 256 416 C226 416 199 405 182 381 C151 337 162 261 187 216 C162 197 149 157 162 126 C181 82 236 82 256 126 Z"
            fill="#faf8f5"
          />

          <path
            className="mascot-part-wing-l"
            d="M143 228 C106 266 81 318 88 340 C93 355 112 350 132 326 C149 305 163 272 169 246 C171 235 154 226 143 228 Z"
            fill="#356a73"
            style={{
              transform: (!reducedMotion && (action === 'celebrating' || action === 'dancing')) ? undefined : motionStyles.leftWingTransform,
              transformOrigin: '154px 244px',
              transition: (!reducedMotion && (action === 'celebrating' || action === 'dancing')) ? 'none' : 'transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)',
            }}
          />
          <path
            className="mascot-part-wing-r"
            d="M369 228 C406 266 431 318 424 340 C419 355 400 350 380 326 C363 305 349 272 343 246 C341 235 358 226 369 228 Z"
            fill="#356a73"
            style={{
              transform: (!reducedMotion && (action === 'waving' || action === 'celebrating' || action === 'dancing' || action === 'writing')) ? undefined : motionStyles.rightWingTransform,
              transformOrigin: '358px 244px',
              transition: (!reducedMotion && (action === 'waving' || action === 'celebrating' || action === 'dancing' || action === 'writing')) ? 'none' : 'transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)',
            }}
          />

        </g>

        {/* Head Group (Head outline, cheeks, beak, eyes, accessories) */}
        <g
          className="mascot-head"
          style={{
            transform: (!reducedMotion && (action === 'waving' || action === 'celebrating' || action === 'dancing' || action === 'writing'))
              ? undefined
              : motionStyles.headTransform,
            transformOrigin: '260px 150px',
            transition: (!reducedMotion && (action === 'waving' || action === 'celebrating' || action === 'dancing' || action === 'writing'))
              ? 'none'
              : 'transform 0.5s cubic-bezier(0.25, 0.8, 0.25, 1)',
          }}
        >
          {/* Beak */}
          <g
            className="mascot-part-beak"
            style={{
              transform: motionStyles.beakTransform,
              transformOrigin: '276px 148px',
              transition: 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
            }}
          >
            <path
              d="M0 0 C3.78244747 3.13458882 3.78244747 3.13458882 4.53125 6.11328125 C4.43827662 12.65628283 2.77840801 17.0295361 -1.6953125 21.8125 C-7.00240825 26.79730249 -13.52913801 31.7205711 -21 32.1875 C-30.03545336 28.61096638 -37.70985373 23.20055378 -42.9375 14.9375 C-44.13908125 11.61548124 -44.521332 9.50037201 -44 6 C-41.05095357 1.045602 -36.53873198 -1.93343083 -31.02758789 -3.59448242 C-21.15429067 -5.56914187 -8.79595682 -5.14420579 0 0 Z"
              fill="#ff9e3b"
              transform="translate(276,148)"
            />
          </g>

          {/* Cheek Left (Our Left / Penguin Right) */}
          <g
            className="mascot-part-cheek-l"
            style={{
              opacity: motionStyles.cheeksOpacity,
              transition: 'opacity 0.4s ease',
            }}
          >
            <path
              d="M0 0 C2.625 1.875 2.625 1.875 4 4 C4.125 6.9375 4.125 6.9375 3 10 C-2.00066929 15.11696393 -6.70275553 17.03503123 -13.875 17.375 C-20.01617882 17.24532202 -24.4834911 15.21147752 -29.0625 11.1875 C-30.56821095 7.67417445 -30.14104551 5.61331078 -29 2 C-20.79669407 -6.37465436 -9.55449226 -5.53054442 0 0 Z"
              fill="#fca698"
              transform="translate(201,163)"
              filter="url(#cheekGlow)"
            />
          </g>
          {/* Cheek Right (Our Right / Penguin Left) */}
          <g
            className="mascot-part-cheek-r"
            style={{
              opacity: motionStyles.cheeksOpacity,
              transition: 'opacity 0.4s ease',
            }}
          >
            <path
              d="M0 0 C2.21487846 1.56503637 3.51506003 2.6028484 4.59765625 5.12890625 C4.59765625 9.3658802 4.33540531 11.37066416 1.34765625 14.44140625 C-5.13711699 18.42069892 -10.90119036 18.92566088 -18.40234375 18.12890625 C-22.39108154 16.89671655 -25.34536057 15.05777026 -28.46484375 12.31640625 C-29.93211912 8.89276373 -29.41125933 6.66011079 -28.40234375 3.12890625 C-21.15415336 -4.53346645 -8.86826546 -5.22626732 0 0 Z"
              fill="#fca698"
              transform="translate(336.40234375,161.87109375)"
              filter="url(#cheekGlow)"
            />
          </g>

          {/* Eye Left (Our Left / Penguin Right) */}
          <g
            className="mascot-part-eye-l"
            style={{
              transform: motionStyles.rightEyeTransform,
              transformOrigin: '207px 143px',
              transition: 'transform 0.15s ease-in-out',
            }}
          >
            {action === 'sleeping' ? (
              <path
                d="M -13 11 Q -1 21 11 11"
                fill="none"
                stroke="#2D2D3D"
                strokeWidth="4.5"
                strokeLinecap="round"
                transform="translate(207,131)"
              />
            ) : (
              <>
                <path
                  d="M0 0 C3.46868763 2.06645221 5.80891972 4.10191909 7 8 C7.86284183 14.57916897 7.86284183 14.57916897 5.76171875 18.0390625 C2.34106813 22.16421436 0.18573047 23.75255881 -5.3125 24.375 C-10.25480563 23.87239265 -11.56012162 22.51987555 -15 19 C-17.33554736 15.22419843 -17.19727696 12.48548312 -16.6171875 8.19140625 C-15.6644595 4.80861884 -13.71321026 3.11762752 -11 1 C-7.53749757 -0.73125121 -3.78591771 -0.47815224 0 0 Z"
                  fill="#2D2D3D"
                  transform="translate(207,131)"
                />
                {/* Pupil and Highlight Group (Eye-Tracking) */}
                <g style={eyeOffsetStyle}>
                  <path
                    d="M0 0 C1.32 0 2.64 0 4 0 C4 1.65 4 3.3 4 5 C2.68 5.33 1.36 5.66 0 6 C-0.38218767 4.34385343 -0.71395102 2.67542976 -1 1 C-0.67 0.67 -0.34 0.34 0 0 Z"
                    fill="#E6DED3"
                    transform="translate(196,137)"
                  />
                </g>
              </>
            )}
          </g>

          {/* Eye Right (Our Right / Penguin Left) */}
          <g
            className="mascot-part-eye-r"
            style={{
              transform: motionStyles.leftEyeTransform,
              transformOrigin: '313px 142px',
              transition: 'transform 0.15s ease-in-out',
            }}
          >
            {action === 'sleeping' ? (
              <path
                d="M -13 12 Q -1 22 11 12"
                fill="none"
                stroke="#2C2D3D"
                strokeWidth="4.5"
                strokeLinecap="round"
                transform="translate(313,130)"
              />
            ) : (
              <>
                <path
                  d="M0 0 C4.31462779 2.28421471 7.16960237 4.42400593 9 9 C9.64337867 12.860272 9.88809228 16.36332418 7.98046875 19.87890625 C4.89570115 23.74651518 2.53794681 24.82589281 -2.3125 25.375 C-7.25480563 24.87239265 -8.56012162 23.51987555 -12 20 C-14.54191079 15.79240023 -14.70299779 11.8009605 -14 7 C-10.56417713 1.2327259 -6.66321886 -0.79958626 0 0 Z"
                  fill="#2C2D3D"
                  transform="translate(313,130)"
                />
                {/* Pupil and Highlight Group (Eye-Tracking) */}
                <g style={eyeOffsetStyle}>
                  <path
                    d="M0 0 C1.67542976 0.28604898 3.34385343 0.61781233 5 1 C5 2.32 5 3.64 5 5 C3.35 5.33 1.7 5.66 0 6 C-0.38218767 4.34385343 -0.71395102 2.67542976 -1 1 C-0.67 0.67 -0.34 0.34 0 0 Z"
                    fill="#E7E0D5"
                    transform="translate(304,137)"
                  />
                </g>
              </>
            )}
          </g>

          {/* Accessory overlay: Glasses */}
          {accessories?.glasses && (
            <g className="mascot-accessory-glasses" style={{ transition: 'all 0.5s ease' }}>
              <circle cx="202" cy="143" r="20" fill="none" stroke="#222" strokeWidth="3" />
              <circle cx="313" cy="142" r="20" fill="none" stroke="#222" strokeWidth="3" />
              <path d="M222 143 Q258 135 293 142" fill="none" stroke="#222" strokeWidth="3" />
              <path d="M182 143 L170 148" fill="none" stroke="#222" strokeWidth="2.5" />
              <path d="M333 142 L345 146" fill="none" stroke="#222" strokeWidth="2.5" />
            </g>
          )}

          {/* Accessory overlay: Party Hat */}
          {accessories?.party_hat && (
            <g className="mascot-accessory-partyhat" style={{ transition: 'all 0.5s ease' }} transform="translate(186, -84) scale(0.29)">
              <g>
                <path fill="#39B1D1" d="M217.545,147.142l-46.827,90.59c42.288-17.282,87.413-44.99,124.354-89.397l-10.556-20.428 c-8.538,4.422-18.239,6.921-28.517,6.921c-10.278,0-19.972-2.5-28.51-6.921L217.545,147.142z"/>
                <path fill="#D6FB61" d="M295.071,148.335c-36.942,44.407-82.067,72.115-124.354,89.397l-61.614,119.184 c59.116-9.132,159.956-38.21,226.257-130.643L295.071,148.335z"/>
                <path fill="#39B1D1" d="M335.361,226.272c-66.301,92.431-167.143,121.51-226.257,130.643l-31.466,60.871 c0,0,184.403,3.021,281.499-145.516L335.361,226.272z"/>
                <path fill="#D6FB61" d="M359.137,272.27C262.04,420.807,77.637,417.786,77.637,417.786L57.758,456.24 c27.816,16.055,61.726,27.847,98.484,35.331c35.248-3.83,166.632-25.27,245.735-136.424L359.137,272.27z"/>
                <path fill="#39B1D1" d="M401.979,355.148c-79.104,111.154-210.488,132.594-245.735,136.423 c54.549,11.124,115.364,12.759,171.805,4.796c35.55-21.159,70.918-50.947,98.926-92.866L401.979,355.148z"/>
                <path fill="#D6FB61" d="M426.974,403.503c-28.008,41.919-63.376,71.706-98.926,92.866 c47.19-6.642,91.327-19.997,126.192-40.127L426.974,403.503z"/>
                <path fill="#F6850C" d="M284.51,127.906c19.942-10.33,33.569-31.151,33.569-55.157c0-34.288-27.791-62.078-62.08-62.078 c-34.283,0-62.078,27.791-62.078,62.078c0,24.006,13.63,44.831,33.569,55.157c3.25,1.683,6.671,3.089,10.23,4.184 c5.777,1.779,11.917,2.737,18.28,2.737C266.276,134.828,275.977,132.328,284.51,127.906z"/>
              </g>
              <g>
                <path fill="#000000" d="M463.715,451.342L304.57,143.481c-0.015-0.029-0.031-0.061-0.046-0.09l-6.027-11.659 C316.8,118.509,328.746,97,328.746,72.745C328.746,32.633,296.111,0,255.998,0c-40.111,0-72.745,32.633-72.745,72.745 c0,24.255,11.946,45.762,30.249,58.987l-5.427,10.501c-0.017,0.029-0.031,0.059-0.046,0.09L48.284,451.342 c-2.619,5.063-0.794,11.288,4.142,14.136c51.207,29.566,125.467,46.521,203.735,46.521c24.834,0,49.27-1.723,72.699-5.017 c0.479-0.035,0.955-0.105,1.427-0.206c49.648-7.126,94.7-21.33,129.286-41.298C464.509,462.63,466.334,456.405,463.715,451.342z M116.112,366.585c48.167-8.077,115.796-28.023,174.651-76.927c4.531-3.764,5.152-10.49,1.388-15.022 c-3.764-4.531-10.49-5.152-15.022-1.388c-49.036,40.746-104.83,60.108-148.581,69.283l49.878-96.486 c45.017-18.959,83.394-45.469,114.333-78.957l54.009,104.48c-38.669,56.543-94.897,96.48-167.238,118.752 c-34.954,10.761-65.676,14.639-83.976,16.03L116.112,366.585z M279.57,141.576l2.721,5.265 c-24.17,27.635-53.605,50.482-87.834,68.187l31.356-60.655c4.938-3.444,9.755-6.999,14.388-10.63 c5.089,1.134,10.372,1.748,15.797,1.748c6.792,0,13.363-0.956,19.605-2.704c0.514-0.144,1.029-0.285,1.541-0.439 c0.396-0.121,0.787-0.247,1.179-0.375C278.739,141.839,279.157,141.718,279.57,141.576z M255.998,21.334 c28.349,0,51.413,23.064,51.413,51.411c0,20.342-11.88,37.963-29.064,46.291c-0.057,0.029-0.112,0.057-0.169,0.083 c-3.673,1.762-7.588,3.102-11.677,3.954c-0.085,0.017-0.169,0.035-0.252,0.054c-0.715,0.144-1.438,0.271-2.162,0.385 c-0.217,0.035-0.435,0.067-0.654,0.098c-0.645,0.094-1.294,0.179-1.948,0.247c-0.337,0.035-0.68,0.061-1.019,0.09 c-0.566,0.05-1.134,0.1-1.707,0.131c-0.542,0.027-1.089,0.035-1.637,0.048c-0.375,0.006-0.746,0.027-1.123,0.027 c-0.375,0-0.748-0.021-1.121-0.027c-0.548-0.013-1.096-0.02-1.64-0.048c-0.571-0.031-1.137-0.081-1.702-0.131 c-0.341-0.029-0.684-0.054-1.023-0.09c-0.566-0.05-1.134-0.1-1.707-0.131 c-0.542,0.027-1.089,0.035-1.637,0.048c-0.375,0.006-0.746,0.027-1.123,0.027 c-0.375,0-0.748-0.021-1.121-0.027c-0.548-0.013-1.096-0.02-1.64-0.048c-0.571-0.031-1.137-0.081-1.702-0.131 c-0.341-0.029-0.684-0.054-1.023-0.09c-0.652-0.068-1.3-0.155-1.944-0.247c-0.221-0.031-0.442-0.063-0.662-0.098 c-0.721-0.114-1.44-0.242-2.153-0.385c-0.087-0.019-0.177-0.037-0.265-0.057c-4.081-0.852-7.988-2.188-11.655-3.946 c-0.067-0.031-0.131-0.062-0.198-0.096c-17.178-8.332-29.049-25.947-29.049-46.286C204.587,44.398,227.651,21.334,255.998,21.334z M72.016,451.888l12.161-23.522c15.118-0.463,54.034-3.096,100.919-17.435c34.804-10.646,66.768-25.577,95.005-44.381 c30.347-20.209,56.401-44.955,77.671-73.691l31.7,61.319c-35.064,46.833-80.496,75.656-112.977,91.74 c-5.279,2.612-7.44,9.013-4.825,14.292c1.86,3.758,5.64,5.936,9.567,5.936c1.589,0,3.204-0.356,4.726-1.11 c32.688-16.186,77.733-44.551,114.301-89.98l14.298,27.66c-23.31,33.276-53.603,61.293-90.149,83.366 c-21.972,3.006-44.905,4.582-68.253,4.582C186.022,490.666,119.647,476.61,72.016,451.888z M375.438,476.054 c18.845-15.551,35.598-32.958,50.09-52.128l14.455,27.962C421.092,461.694,399.262,469.816,375.438,476.054z"/>
                <path fill="#000000" d="M307.532,270.274c2.842,0,5.675-1.13,7.775-3.362l0.523-0.542c4.079-4.25,3.942-11.002-0.308-15.085 c-4.25-4.079-11.002-3.942-15.082,0.308l-0.677,0.706c-4.035,4.291-3.827,11.045,0.467,15.078 C302.288,269.316,304.913,270.274,307.532,270.274z"/>
                <path fill="#000000" d="M246.994,458.38l-0.706,0.269c-5.517,2.063-8.319,8.208-6.256,13.728 c1.602,4.288,5.669,6.936,9.992,6.936c1.242,0,2.505-0.219,3.734-0.68l0.796-0.302c5.511-2.088,8.284-8.246,6.197-13.755 C258.66,459.067,252.502,456.293,246.994,458.38z"/>
              </g>
            </g>
          )}

          {/* Accessory overlay: Sleeping Cap */}
          {accessories?.sleeping_cap && (
            <g transform="translate(192, -58) scale(0.26)">
              <g className="mascot-accessory-sleepingcap" style={{ transition: 'all 0.5s ease' }}>
                {/* Brim Fill */}
                <path fill="#64B5F6" d="M475.99,435.409c-0.025,15.96-12.941,28.876-28.901,28.901H55.023 c-15.96-0.025-28.876-12.941-28.902-28.901V411.94c0.025-15.951,12.942-28.867,28.902-28.893h392.066 c15.96,0.026,28.876,12.942,28.901,28.893V435.409z"/>
                {/* Cap Body Fill */}
                <path fill="#39B1D1" d="M107.181,242.034c23.315-34.352,55.09-61.954,89.86-83.645 c31.47-19.659,66.222-28.332,99.885-35.916c16.818-3.81,33.332-7.355,48.994-12.117c10.016-3.053,19.659-6.726,28.817-11.275 c3.069,24.692,19.14,45.321,41.197,54.776c-7.321,8.265-13.077,16.675-17.142,25.263c-5.97,12.533-8.477,25.347-8.461,37.744 c0.009,14.388,3.24,28.171,7.72,41.487c6.76,19.956,16.368,39.13,24.005,58.169c5.492,13.613,9.897,27.039,11.98,40.406H68.008 C71.154,311.724,85.54,273.954,107.181,242.034z"/>
                {/* Decorative Spots */}
                <circle cx="180" cy="220" r="12" fill="#D6FB61" />
                <circle cx="250" cy="180" r="14" fill="#D6FB61" />
                <circle cx="310" cy="150" r="10" fill="#D6FB61" />
                {/* Pom-pom Fill */}
                <circle cx="443" cy="90" r="43" fill="#64B5F6" />
                {/* Black Outlines */}
                <path fill="#000000" d="M460.566,358.661c-2.95-26.172-13.18-49.828-22.694-71.723c-5.663-12.898-11.13-25.229-15.068-36.937 c-3.963-11.717-6.361-22.737-6.352-33.136c0.018-8.996,1.701-17.566,5.944-26.555c4.252-8.97,11.199-18.426,22.218-28.484 l-2.219-2.432c0.23,0,0.442,0.034,0.672,0.034c38.076-0.009,68.926-30.858,68.933-68.925 c-0.008-38.077-30.848-68.926-68.933-68.934c-31.589,0.008-58.127,21.258-66.29,50.236l-1.93-2.815 c-10.008,6.896-22.337,12.066-36.537,16.377c-21.283,6.505-46.58,11.003-73.279,17.856c-26.691,6.879-54.887,16.215-81.816,33.009 c-37.107,23.154-71.757,53.016-97.648,91.126c-24.592,36.155-40.925,79.928-43.824,131.252C17.78,364.561,0.009,386.143,0,411.94 v23.469c0.009,30.39,24.624,55.014,55.023,55.023h392.066c30.398-0.009,55.014-24.633,55.023-55.023V411.94 C502.103,386.211,484.434,364.681,460.566,358.661z M412.796,60.222c7.788-7.764,18.408-12.525,30.271-12.533 c11.87,0.008,22.49,4.77,30.279,12.533c7.763,7.788,12.525,18.417,12.533,30.28c-0.008,11.862-4.77,22.482-12.533,30.262 c-7.789,7.772-18.41,12.534-30.279,12.542c-11.862-0.009-22.482-4.771-30.271-12.534c-7.763-7.788-12.525-18.408-12.534-30.27 C400.271,78.639,405.033,68.011,412.796,60.222z M107.181,242.034c23.315-34.352,55.09-61.954,89.86-83.645 c31.47-19.659,66.222-28.332,99.885-35.916c16.818-3.81,33.332-7.355,48.994-12.117c10.016-3.053,19.659-6.726,28.817-11.275 c3.069,24.692,19.14,45.321,41.197,54.776c-7.321,8.265-13.077,16.675-17.142,25.263c-5.97,12.533-8.477,25.347-8.461,37.744 c0.009,14.388,3.24,28.171,7.72,41.487c6.76,19.956,16.368,39.13,24.005,58.169c5.492,13.613,9.897,27.039,11.98,40.406H68.008 C71.154,311.724,85.54,273.954,107.181,242.034z M475.99,435.409c-0.025,15.96-12.941,28.876-28.901,28.901H55.023 c-15.96-0.025-28.876-12.941-28.902-28.901V411.94c0.025-15.951,12.942-28.867,28.902-28.893h392.066 c15.96,0.026,28.876,12.942,28.901,28.893V435.409z"/>
              </g>
            </g>
          )}
        </g>
      </g>

      {/* Action props overlays */}
      {action === 'reading' && (
        <g className="mascot-prop-book" style={{ transform: 'translate(210px, 320px)', transition: 'all 0.5s ease' }}>
          <path d="M0 25 C15 15, 45 15, 50 22 C55 15, 85 15, 100 25 L95 5 C80 -5, 55 -5, 50 2 C45 -5, 20 -5, 0 5 Z" fill="#F8F0E2" stroke="#31535F" strokeWidth="2.5" />
          <path d="M50 2 L50 22" stroke="#DE3E3E" strokeWidth="3.5" />
        </g>
      )}

      {action === 'writing' && (
        <g className="mascot-prop-notepad" style={{ transform: 'translate(200px, 320px)', transition: 'all 0.5s ease' }}>
          <rect width="60" height="40" rx="3" fill="#ffffff" stroke="#31525E" strokeWidth="2" />
          <line x1="10" y1="10" x2="50" y2="10" stroke="#39B1D1" strokeWidth="2.5" />
          <line x1="10" y1="20" x2="45" y2="20" stroke="#cccccc" strokeWidth="1.5" />
          <line x1="10" y1="28" x2="48" y2="28" stroke="#cccccc" strokeWidth="1.5" />
        </g>
      )}
    </svg>
  );



  return (
    <div
      ref={containerRef}
      className={`mascot-container relative flex items-center justify-center`}
      onMouseEnter={handleMascotHover}
      onClick={handleMascotClick}
      onKeyDown={handleKeyDown}
      tabIndex={interactive ? 0 : -1}
      role={interactive ? 'button' : undefined}
      aria-label="Peri, interactive mascot. Press Enter or Space to interact."
      style={{
        width: `${size}px`,
        height: `${size}px`,
        minWidth: `${size}px`,
        minHeight: `${size}px`,
        cursor: interactive ? 'pointer' : 'default',
        transition: 'all 0.3s ease',
      }}
    >
      {interactive && speechText && containerRef.current && createPortal(
        <div
          style={bubbleStyle}
          onClick={handleSpeechClick}
          className="mascot-speech-bubble"
          aria-live="polite"
          role="status"
        >
          {speechText}
          {/* Tail points down toward Peri */}
          <div
            style={{
              position: 'absolute',
              bottom: '-7px',
              left: '18px',
              transform: 'rotate(45deg)',
              width: '13px',
              height: '13px',
              background: 'rgba(15, 23, 42, 0.95)',
              borderRight: '1px solid rgba(255, 255, 255, 0.12)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
              zIndex: -1,
            }}
          />
        </div>,
        document.body
      )}

      {/* Floating sleep Zzz particles */}
      {action === 'sleeping' && !reducedMotion && (
        <div className="absolute inset-0 pointer-events-none overflow-visible">
          <span className="sleep-z sleep-z1">Z</span>
          <span className="sleep-z sleep-z2">z</span>
          <span className="sleep-z sleep-z3">z</span>
        </div>
      )}

      {/* Floating Confetti particles */}
      {action === 'celebrating' && !reducedMotion && (
        <div className="absolute inset-0 pointer-events-none overflow-visible">
          <div className="confetti c1" />
          <div className="confetti c2" />
          <div className="confetti c3" />
          <div className="confetti c4" />
          <div className="confetti c5" />
          <div className="confetti c6" />
          <div className="confetti c7" />
          <div className="confetti c8" />
        </div>
      )}

      {renderSVGMascot()}
    </div>
  );
}
