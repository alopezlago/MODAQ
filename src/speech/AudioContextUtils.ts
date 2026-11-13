const userGestureEvents: string[] = ["pointerdown", "keydown", "touchend"];

/**
 * Keeps an AudioContext running. Browsers can create one suspended when it isn't made during a user gesture;
 * Safari does this, and doesn't count accepting the microphone prompt as a gesture. iOS Safari also interrupts
 * running contexts (e.g. for a phone call). A context that isn't running processes no audio, so resume it right
 * away, and whenever that isn't allowed, again on the user's next click or key press (moderators press keys
 * constantly).
 *
 * Returns a function that removes the listeners this adds.
 */
export function keepAudioContextRunning(audioContext: AudioContext): () => void {
    let listeningForGesture = false;

    // Compared as a string since "interrupted" (iOS Safari) isn't in TypeScript's AudioContextState
    const needsResume = (): boolean => {
        const state: string = audioContext.state;
        return state !== "running" && state !== "closed";
    };

    const onGesture = (): void => {
        if (needsResume()) {
            void audioContext.resume().catch(() => undefined);
        }
    };

    const setListeningForGesture = (listen: boolean): void => {
        if (listen === listeningForGesture) {
            return;
        }

        listeningForGesture = listen;
        for (const eventName of userGestureEvents) {
            if (listen) {
                document.addEventListener(eventName, onGesture, true);
            } else {
                document.removeEventListener(eventName, onGesture, true);
            }
        }
    };

    const onStateChange = (): void => setListeningForGesture(needsResume());

    audioContext.addEventListener("statechange", onStateChange);
    onGesture();
    onStateChange();

    return () => {
        audioContext.removeEventListener("statechange", onStateChange);
        setListeningForGesture(false);
    };
}
