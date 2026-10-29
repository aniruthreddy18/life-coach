// =============================================================
// SignIn.jsx — the sign-in screen
// -------------------------------------------------------------
// mode "email" (AUTH_MODE=email): type your email -> you're in.
//
// mode "otp" (AUTH_MODE=otp), two steps:
// Step 1 "email": you type your Gmail -> Supabase emails a code.
// Step 2 "code":  you type the code   -> Supabase gives a session.
// No passwords to remember (or leak). The same screen works for
// brand-new people and returning ones: Supabase creates the account
// the first time an email verifies a code.
// =============================================================
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRightIcon, ArrowLeftIcon, EnvelopeSimpleIcon, ShieldCheckIcon, PaperPlaneTiltIcon } from "@phosphor-icons/react";
import { supabase, friendlyAuthError } from "../supabase.js";
import { signInWithEmail } from "../auth.js";
import { Button, softSpring } from "../components.jsx";

const RESEND_SECONDS = 60; // Supabase allows one code per email per minute
const stagger = { show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } } };
const rise = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: softSpring } };
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

export default function SignIn({ mode = "email", onSignedIn }) {
  const withCode = mode === "otp";
  const [step, setStep] = useState("email"); // email | code
  const [email, setEmail] = useState(() => localStorage.getItem("last-email") ?? "");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [waking, setWaking] = useState(false); // the server is asleep and waking up
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef(null);

  // Count the resend timer down once a second
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendCode(e) {
    e?.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!isEmail(clean)) return setError("Enter a valid email, like you@gmail.com");
    setBusy(true);
    setError("");
    try {
      localStorage.setItem("last-email", clean);
    } catch {}
    if (!withCode) {
      // Email mode: no code, the server signs you in straight away
      try {
        return onSignedIn(await signInWithEmail(clean, () => setWaking(true)));
      } catch (err) {
        setBusy(false);
        setWaking(false);
        return setError(err.message);
      }
    }
    const { error } = await supabase().auth.signInWithOtp({ email: clean, options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) return setError(friendlyAuthError(error));
    setEmail(clean);
    setCode("");
    setStep("code");
    setCooldown(RESEND_SECONDS);
  }

  async function verify(e) {
    e?.preventDefault();
    if (code.length < 6) return;
    setBusy(true);
    setError("");
    const { data, error } = await supabase().auth.verifyOtp({ email, token: code, type: "email" });
    if (error) {
      setBusy(false);
      setCode("");
      codeRef.current?.focus();
      return setError(friendlyAuthError(error));
    }
    onSignedIn(data.session);
  }

  return (
    <main id="main" className="onboard signin">
      <div className="onboard-top">
        <span className="brand">
          <span className="brand-mark" aria-hidden>
            <svg width="16" height="16" viewBox="0 0 16 16"><path d="M2 12 L6 7.5 L9 10 L14 3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          <span className="brand-name">Life Coach</span>
        </span>
      </div>

      <div className="onboard-stage">
        <AnimatePresence mode="wait">
          {step === "email" ? (
            <motion.form key="email" className="question signin-card" onSubmit={sendCode} noValidate initial="hidden" animate="show" exit={{ opacity: 0, x: -40, transition: { duration: 0.18 } }} variants={stagger}>
              <motion.div className="signin-icon" variants={rise}><EnvelopeSimpleIcon size={26} weight="duotone" /></motion.div>
              <motion.span className="label" variants={rise}>Sign in</motion.span>
              <motion.h1 variants={rise}>
                Your coach is waiting. <span style={{ color: "var(--accent-ink)" }}>Let's get you in.</span>
              </motion.h1>
              <motion.p className="muted" variants={rise}>
                {withCode
                  ? "Enter your Gmail. We'll send a 6-digit code — no password needed."
                  : "Enter your email to continue. No password needed."}
              </motion.p>
              <motion.div className="field" variants={rise}>
                <label className="sr-only" htmlFor="email">Email</label>
                <input
                  id="email"
                  className="input lg-input"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                />
              </motion.div>
              <AnimatePresence>{error && <ErrorLine text={error} />}</AnimatePresence>
              <motion.div variants={rise}>
                <Button variant="primary" className="wide lg" type="submit" disabled={busy || !email.trim()}>
                  {withCode
                    ? busy ? "Sending…" : <>Send code <PaperPlaneTiltIcon size={18} weight="fill" /></>
                    : busy ? (waking ? "Waking up the server…" : "Signing in…") : <>Continue <ArrowRightIcon size={18} weight="bold" /></>}
                </Button>
              </motion.div>
              <motion.p className="hint" variants={rise} style={{ textAlign: "center" }}>
                First time? Same steps — your account is created automatically.
              </motion.p>
            </motion.form>
          ) : (
            <motion.form key="code" className="question signin-card" onSubmit={verify} noValidate initial="hidden" animate="show" exit={{ opacity: 0, x: 40, transition: { duration: 0.18 } }} variants={stagger}>
              <motion.div className="signin-icon" variants={rise}><ShieldCheckIcon size={26} weight="duotone" /></motion.div>
              <motion.span className="label" variants={rise}>Check your inbox</motion.span>
              <motion.h1 variants={rise}>Enter the code</motion.h1>
              <motion.p className="muted" variants={rise}>
                We sent it to <strong style={{ color: "var(--text)" }}>{email}</strong>. Not there? Check Spam or Promotions.
              </motion.p>
              <motion.div className="field" variants={rise}>
                <label className="sr-only" htmlFor="code">6-digit code</label>
                <input
                  id="code"
                  ref={codeRef}
                  className="input code-input"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="••••••"
                  maxLength={8}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  autoFocus
                />
              </motion.div>
              <AnimatePresence>{error && <ErrorLine text={error} />}</AnimatePresence>
              <motion.div variants={rise}>
                <Button variant="primary" className="wide lg" type="submit" disabled={busy || code.length < 6}>
                  {busy ? "Checking…" : <>Verify & continue <ArrowRightIcon size={18} weight="bold" /></>}
                </Button>
              </motion.div>
              <motion.div className="onboard-nav" variants={rise}>
                <Button variant="ghost" type="button" onClick={() => { setStep("email"); setError(""); }}>
                  <ArrowLeftIcon size={16} /> Change email
                </Button>
                <Button variant="ghost" type="button" disabled={busy || cooldown > 0} onClick={sendCode}>
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                </Button>
              </motion.div>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

function ErrorLine({ text }) {
  return (
    <motion.p className="error" role="alert" style={{ overflow: "hidden" }} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
      {text}
    </motion.p>
  );
}
