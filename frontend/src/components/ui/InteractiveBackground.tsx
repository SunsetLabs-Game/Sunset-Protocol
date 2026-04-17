import { memo, useEffect, useMemo, useState } from "react";
import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring } from "motion/react";

export const InteractiveBackground = memo(function InteractiveBackground() {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const smoothX = useSpring(mouseX, { damping: 50, stiffness: 400 });
  const smoothY = useSpring(mouseY, { damping: 50, stiffness: 400 });
  const prefersReducedMotion = useReducedMotion();
  const [enablePointerTracking, setEnablePointerTracking] = useState(false);

  const bgGlow = useMotionTemplate`
    radial-gradient(
      600px circle at ${smoothX}px ${smoothY}px,
      rgba(246, 232, 196, 0.24),
      transparent 80%
    )
  `;

  const maskGlow = useMotionTemplate`
    radial-gradient(
      250px circle at ${smoothX}px ${smoothY}px,
      black,
      transparent 80%
    )
  `;

  useEffect(() => {
    if (typeof window === "undefined" || prefersReducedMotion) {
      setEnablePointerTracking(false);
      return;
    }

    const mediaQuery = window.matchMedia("(pointer: fine)");
    const updateMode = () => setEnablePointerTracking(mediaQuery.matches);

    updateMode();
    mediaQuery.addEventListener("change", updateMode);
    return () => mediaQuery.removeEventListener("change", updateMode);
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (!enablePointerTracking) return;

    let rafId = 0;
    const handleMouseMove = ({ clientX, clientY }: MouseEvent) => {
      cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(() => {
        mouseX.set(clientX);
        mouseY.set(clientY);
      });
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [enablePointerTracking, mouseX, mouseY]);

  const ambientClassName = useMemo(
    () =>
      prefersReducedMotion
        ? "absolute inset-0 opacity-35 overflow-hidden"
        : "absolute inset-0 opacity-50 mix-blend-soft-light overflow-hidden",
    [prefersReducedMotion],
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-canvas">
      <div className={ambientClassName}>
        <motion.div
          animate={
            prefersReducedMotion
              ? undefined
              : {
                  x: [0, 100, -100, 0],
                  y: [0, -50, 50, 0],
                  scale: [1, 1.2, 0.8, 1],
                }
          }
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-[20%] -left-[10%] h-[50vh] w-[50vw] rounded-full bg-[#f6e8c4]/55 blur-[100px]"
        />
        <motion.div
          animate={
            prefersReducedMotion
              ? undefined
              : {
                  x: [0, -100, 100, 0],
                  y: [0, 100, -100, 0],
                  scale: [1, 0.9, 1.1, 1],
                }
          }
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute top-[40%] left-[60%] h-[60vh] w-[40vw] rounded-full bg-black/10 blur-[120px]"
        />
      </div>

      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(17, 17, 17, 0.16) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(17, 17, 17, 0.16) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />

      {enablePointerTracking && !prefersReducedMotion && (
        <>
          <motion.div className="absolute inset-0 z-10" style={{ background: bgGlow }} />

          <motion.div
            className="absolute inset-0 z-10"
            style={{
              backgroundImage: `
                linear-gradient(to right, rgba(17, 17, 17, 0.32) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(17, 17, 17, 0.32) 1px, transparent 1px)
              `,
              backgroundSize: "40px 40px",
              WebkitMaskImage: maskGlow,
              maskImage: maskGlow,
            }}
          />
        </>
      )}

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(120,95,48,0.18)_100%)] opacity-90" />
    </div>
  );
});
