import { Link } from "react-router";
import { motion } from "motion/react";
import { InteractiveBackground } from "@/components/ui/InteractiveBackground";
import { GlowingCard } from "@/components/ui/GlowingCard";
import { SnakeButton } from "@/components/ui/SnakeButton";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      type: "spring",
      mass: 1,
      stiffness: 100,
      damping: 20,
    },
  },
};

const textRevealVariants = {
  hidden: { opacity: 0, y: 40, filter: "blur(12px)", scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    scale: 1,
    transition: {
      type: "spring",
      mass: 1.2,
      stiffness: 80,
      damping: 20,
    },
  },
};

export function LandingPage() {
  return (
    <div className="relative min-h-screen bg-canvas overflow-hidden">
      <InteractiveBackground />

      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Nav */}
        <motion.nav
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-8"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold text-text-display tracking-tight border-b-2 border-text-display/40 pb-0.5">
              Sunset
            </span>
          </div>
          <Link
            to="/app"
            className="rounded-lg border border-border bg-surface/45 backdrop-blur-md px-5 py-2.5 text-sm font-medium text-text-body transition-all hover:bg-surface-elevated hover:border-text-display/40 hover:text-text-display hover:shadow-[0_10px_24px_rgba(17,17,17,0.08)]"
          >
            Launch App
          </Link>
        </motion.nav>

        {/* Hero */}
        <motion.section
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="mx-auto max-w-4xl px-6 pt-32 pb-24 text-center flex-1 relative"
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[60%] bg-[#f6e8c4]/35 blur-[120px] rounded-full point-events-none" />

          <motion.h1 variants={textRevealVariants} className="text-7xl md:text-8xl font-bold tracking-tighter leading-[1.05]">
            <span className="text-text-display">Shielded Liquidity</span>
            <br />
            <span className="bg-gradient-to-r from-text-display via-text-heading to-text-caption bg-clip-text text-transparent">
              for Conflux
            </span>
          </motion.h1>

          <motion.p variants={textRevealVariants} className="mx-auto mt-10 max-w-2xl text-xl text-text-body leading-relaxed font-light">
            The prime shielded concentrated liquidity market maker for Bitcoin wrappers
            and ecosystem stablecoins. Trade, route, and provide liquidity with
            absolute zero-knowledge privacy by default.
          </motion.p>

          <motion.div variants={itemVariants} className="mt-14 flex flex-wrap items-center justify-center gap-5">
            <SnakeButton to="/app" primary className="min-w-[200px]">
              Start Trading
            </SnakeButton>

            <SnakeButton href="#" className="min-w-[200px]">
              View GitHub
            </SnakeButton>
          </motion.div>
        </motion.section>

        {/* Bento Grid Features - PURE TYPOGRAPHY */}
        <motion.section
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="mx-auto w-full max-w-6xl px-6 pb-32"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-min">

            {/* Wide Card (2 cols) */}
            <GlowingCard variants={itemVariants} className="md:col-span-2 p-10">
              <h3 className="text-3xl font-bold tracking-tight text-text-display mb-4">Shielded Swaps</h3>
              <p className="text-lg text-text-caption max-w-lg leading-relaxed font-light">
                Route BTC wrappers and stablecoins privately through zero-knowledge proofs. Swap volumes, slippage margins, and execution metadata remain entirely hidden from public observers.
              </p>
            </GlowingCard>

            {/* Standard Card (1 col) */}
            <GlowingCard variants={itemVariants} className="p-10">
              <h3 className="text-2xl font-bold tracking-tight text-text-display mb-4">Concentrated Liquidity</h3>
              <p className="text-base text-text-caption leading-relaxed font-light">
                Maximize capital efficiency. Deploy liquidity in custom price ranges across premium markets like WBTC and USDT0.
              </p>
            </GlowingCard>

            {/* Standard Card (1 col) */}
            <GlowingCard variants={itemVariants} className="p-10">
              <h3 className="text-2xl font-bold tracking-tight text-text-display mb-4">Mathematical Privacy</h3>
              <p className="text-base text-text-caption leading-relaxed font-light">
                Industry-grade zk-SNARK circuits, commitments, and nullifiers keep balances and LP intent strictly confidential throughout the protocol lifecycle.
              </p>
            </GlowingCard>

            {/* Wide Card (2 cols) */}
            <GlowingCard variants={itemVariants} className="md:col-span-2 p-10">
              <h3 className="text-3xl font-bold tracking-tight text-text-display mb-4">Conflux eSpace Native</h3>
              <p className="text-lg text-text-caption max-w-lg leading-relaxed font-light">
                Engineered natively for Conflux eSpace. Sunset seamlessly merges true EVM compatibility with advanced privacy primitives to deliver lightning-fast, shielded DeFi.
              </p>
            </GlowingCard>

          </div>
        </motion.section>

        {/* Footer */}
        <motion.footer
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="border-t border-border/40 bg-surface/25 backdrop-blur-md py-10 text-center w-full"
        >
          <p className="text-sm font-medium tracking-wide text-text-caption">
            Sunset Protocol
          </p>
        </motion.footer>
      </div>
    </div>
  );
}
