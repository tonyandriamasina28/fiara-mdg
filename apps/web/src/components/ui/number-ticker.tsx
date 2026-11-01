'use client';

/**
 * Adapté de Magic UI « number-ticker » (récupéré via le serveur MCP magicuidesign).
 * Différences : format fr-FR (espaces fines), repart de la valeur précédente
 * plutôt que de 0, et respecte prefers-reduced-motion.
 */
import { useEffect, useRef, type ComponentPropsWithoutRef } from 'react';
import { useMotionValue, useReducedMotion, useSpring } from 'motion/react';

const format = new Intl.NumberFormat('fr-FR');

interface NumberTickerProps extends ComponentPropsWithoutRef<'span'> {
  value: number;
}

export function NumberTicker({ value, className, ...props }: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduceMotion = useReducedMotion();
  const motionValue = useMotionValue(value);
  const spring = useSpring(motionValue, { damping: 40, stiffness: 220 });

  useEffect(() => {
    if (reduceMotion) spring.jump(value);
    else motionValue.set(value);
  }, [value, motionValue, spring, reduceMotion]);

  useEffect(
    () =>
      spring.on('change', (latest) => {
        if (ref.current) ref.current.textContent = format.format(Math.round(latest));
      }),
    [spring],
  );

  return (
    <span ref={ref} className={`tabular inline-block ${className ?? ''}`} {...props}>
      {format.format(value)}
    </span>
  );
}
