import { useEffect, useState, useRef } from 'react';

/**
 * Smoothly interpolates a number from previous value to new value
 */
export function useCountUp(targetValue: number, duration: number = 400): number {
  const [displayValue, setDisplayValue] = useState<number>(targetValue);
  const startValRef = useRef<number>(targetValue);
  const startTimeRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    // If change is tiny or 0, just set immediately
    if (Math.abs(targetValue - displayValue) < 0.001) {
      setDisplayValue(targetValue);
      return;
    }

    startValRef.current = displayValue;
    startTimeRef.current = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = startValRef.current + (targetValue - startValRef.current) * easeOut;

      setDisplayValue(current);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(targetValue);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [targetValue, duration]);

  return displayValue;
}
