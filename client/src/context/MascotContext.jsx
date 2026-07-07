import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

const MascotContext = createContext(null);

export const PRIORITIES = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
};

const INACTIVITY_TIMEOUT = 45000;

export function MascotProvider({ children }) {
  const [mood, setMood] = useState('neutral');
  const [action, setAction] = useState('idle');
  const [accessories, setAccessories] = useState({
    glasses: false,
    party_hat: false,
    sleeping_cap: false,
  });
  const [speechText, setSpeechText] = useState(null);

  const actionQueueRef = useRef([]);
  const currentActionTimeoutRef = useRef(null);
  const currentActionRef = useRef(null);
  const inactivityTimerRef = useRef(null);
  const isInactiveRef = useRef(false);

  const clearCurrentAction = useCallback(() => {
    if (currentActionTimeoutRef.current) {
      clearTimeout(currentActionTimeoutRef.current);
      currentActionTimeoutRef.current = null;
    }
    currentActionRef.current = null;
  }, []);

  const processQueue = useCallback(() => {
    if (actionQueueRef.current.length === 0) {
      setAction('idle');
      setMood('neutral');
      setAccessories({
        glasses: false,
        party_hat: false,
        sleeping_cap: false,
      });
      setSpeechText(null);
      currentActionRef.current = null;
      return;
    }

    actionQueueRef.current.sort((a, b) => b.priority - a.priority);
    const nextAction = actionQueueRef.current.shift();

    currentActionRef.current = nextAction;
    setAction(nextAction.type);

    if (nextAction.mood) setMood(nextAction.mood);
    if (nextAction.accessories) {
      setAccessories((prev) => {
        const updated = { ...prev };
        nextAction.accessories.forEach((acc) => {
          updated[acc] = true;
        });
        return updated;
      });
    }
    setSpeechText(nextAction.speech || null);

    const duration = nextAction.duration || 3000;
    currentActionTimeoutRef.current = setTimeout(() => {
      clearCurrentAction();
      processQueue();
    }, duration);
  }, [clearCurrentAction]);

  const putToSleep = useCallback(() => {
    isInactiveRef.current = true;
    clearCurrentAction();
    actionQueueRef.current = [];

    currentActionRef.current = {
      type: 'sleeping',
      mood: 'tired',
      accessories: ['sleeping_cap'],
      priority: PRIORITIES.HIGH,
      speech: 'Zzz... wake me up when you\'re ready! 😴',
    };

    setAction('sleeping');
    setMood('tired');
    setAccessories({
      glasses: false,
      party_hat: false,
      sleeping_cap: true,
    });
    setSpeechText('Zzz... wake me up when you\'re ready! 😴');
  }, [clearCurrentAction]);

  const silentWake = useCallback(() => {
    if (!isInactiveRef.current) return false;
    isInactiveRef.current = false;
    clearCurrentAction();
    actionQueueRef.current = [];
    currentActionRef.current = null;
    setAction('idle');
    setMood('neutral');
    setAccessories({ glasses: false, party_hat: false, sleeping_cap: false });
    setSpeechText(null);
    return true;
  }, [clearCurrentAction]);

  const triggerMascotAction = useCallback((actionObj) => {
    if (isInactiveRef.current) {
      silentWake();
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = setTimeout(() => putToSleep(), INACTIVITY_TIMEOUT);
    }

    const newAction = {
      type: actionObj.type,
      mood: actionObj.mood || null,
      accessories: actionObj.accessories || null,
      duration: actionObj.duration || 3000,
      priority: PRIORITIES[actionObj.priority] || PRIORITIES.MEDIUM,
      speech: actionObj.speech || null,
      id: Math.random().toString(36).substr(2, 9),
    };

    const currentPriority = currentActionRef.current
      ? (currentActionRef.current.priority || PRIORITIES.MEDIUM)
      : PRIORITIES.LOW;

    if (newAction.priority === PRIORITIES.HIGH || newAction.priority > currentPriority) {
      clearCurrentAction();

      if (newAction.priority === PRIORITIES.HIGH) {
        actionQueueRef.current = actionQueueRef.current.filter(
          (act) => act.priority === PRIORITIES.HIGH,
        );
      }

      currentActionRef.current = newAction;
      setAction(newAction.type);
      if (newAction.mood) setMood(newAction.mood);

      setAccessories((prev) => {
        const updated = { glasses: false, party_hat: false, sleeping_cap: false };
        if (newAction.accessories) {
          newAction.accessories.forEach((acc) => {
            updated[acc] = true;
          });
        }
        return updated;
      });

      setSpeechText(newAction.speech || null);

      currentActionTimeoutRef.current = setTimeout(() => {
        clearCurrentAction();
        processQueue();
      }, newAction.duration);
    } else {
      actionQueueRef.current.push(newAction);
    }
  }, [clearCurrentAction, processQueue, silentWake, putToSleep]);

  const wakeUp = useCallback(() => {
    isInactiveRef.current = false;
    clearCurrentAction();
    actionQueueRef.current = [];

    triggerMascotAction({
      type: 'waving',
      mood: 'happy',
      duration: 2500,
      priority: 'HIGH',
      speech: "Mmm, I'm awake! Let's go!",
    });
  }, [triggerMascotAction, clearCurrentAction]);

  const resetInactivityTimer = useCallback(() => {
    if (isInactiveRef.current) {
      wakeUp();
    }

    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }

    inactivityTimerRef.current = setTimeout(() => {
      putToSleep();
    }, INACTIVITY_TIMEOUT);
  }, [wakeUp, putToSleep]);

  useEffect(() => {
    resetInactivityTimer();
    return () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, [resetInactivityTimer]);

  const lastActivityRef = useRef(0);
  const ACTIVITY_THROTTLE_MS = 500;

  useEffect(() => {
    const onActivity = () => {
      const now = Date.now();
      if (now - lastActivityRef.current < ACTIVITY_THROTTLE_MS) return;
      lastActivityRef.current = now;
      resetInactivityTimer();
    };

    const events = ['mousedown', 'keydown', 'touchstart', 'mousemove', 'scroll'];
    events.forEach((event) => {
      document.addEventListener(event, onActivity, { passive: true, capture: true });
    });

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, onActivity, { capture: true });
      });
    };
  }, [resetInactivityTimer]);

  const clearSpeech = useCallback(() => {
    setSpeechText(null);
  }, []);

  return (
    <MascotContext.Provider value={{
      mood,
      action,
      accessories,
      speechText,
      setMood,
      setAction,
      setAccessories,
      triggerMascotAction,
      clearSpeech,
      resetInactivityTimer,
      isSleeping: action === 'sleeping',
      setSpeech: setSpeechText,
    }}>
      {children}
    </MascotContext.Provider>
  );
}

export const useMascot = () => {
  const ctx = useContext(MascotContext);
  if (!ctx) throw new Error('useMascot must be used within MascotProvider');
  return ctx;
};
