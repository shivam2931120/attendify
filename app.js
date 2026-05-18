require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { clerkMiddleware } = require("@clerk/express");

const apiRoutes = require("./routes/api");

const app = express();
const PORT = process.env.PORT || 3000;
const CLERK_PUBLISHABLE_KEY =
  process.env.CLERK_PUBLISHABLE_KEY ||
  "pk_test_YnJpZ2h0LW1vcmF5LTIuY2xlcmsuYWNjb3VudHMuZGV2JA";
const hasClerkServerConfig = Boolean(process.env.CLERK_SECRET_KEY);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Clerk middleware is needed globally so all routes can process __clerk_handshake
// tokens. If server-side Clerk keys are absent, keep public pages available and
// let API auth fail with 401 instead of crashing every request.
if (hasClerkServerConfig) {
  app.use(clerkMiddleware({ publishableKey: CLERK_PUBLISHABLE_KEY }));
} else {
  console.warn(
    "Attendify warning: CLERK_SECRET_KEY is not set. Public pages will load, but API routes require Clerk server configuration."
  );
  app.use((req, _res, next) => {
    req.auth = () => ({ userId: null });
    next();
  });
}

// API Routes
app.use("/api", apiRoutes);

// Serve static assets (JS, CSS, images, manifest, service-worker)
app.use(express.static(path.join(__dirname, "public")));

// UI Routes — auth enforced client-side by Clerk.js on each page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
app.get("/calendar", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "calendar.html"));
});
app.get("/calculator", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "calculator.html"));
});
app.get("/profile", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "profile.html"));
});
app.get("/subject-details", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "subject-details.html"));
});

const clerkAppearance = {
  layout: {
    logoPlacement: "none",
    socialButtonsVariant: "blockButton",
  },
  variables: {
    colorPrimary: "#ff3b3b",
    colorBackground: "#0d0d0d",
    colorText: "white",
    colorDanger: "#ff3b3b",
    colorInputBackground: "#1f1f1f",
    colorInputText: "white",
  },
  elements: {
    rootBox: "w-full",
    card: "bg-transparent shadow-none p-0 w-full max-w-sm mx-auto border-none sm:bg-[#0d0d0d] sm:border sm:border-[#1f1f1f] sm:shadow-2xl sm:p-8 sm:rounded-2xl",
    headerTitle: "hidden",
    headerSubtitle: "hidden",
    socialButtonsBlockButton:
      "text-white border border-[#2a2a2a] bg-[#141414] hover:bg-[#1f1f1f] flex justify-center py-2.5 rounded-lg shadow-sm transition-all",
    socialButtonsBlockButtonText: "text-white font-semibold",
    dividerRow: "border-[#2a2a2a]",
    dividerText: "text-neutral-500 font-medium",
    formFieldLabel:
      "text-neutral-400 font-bold text-[10px] uppercase tracking-wider mb-1",
    formFieldInput:
      "bg-[#141414] border-[#2a2a2a] text-white rounded-lg px-3 py-2.5 focus:border-[#ff3b3b] focus:ring-1 focus:ring-[#ff3b3b] transition-all",
    footerActionText: "text-neutral-400",
    footerActionLink: "text-[#ff3b3b] hover:text-[#ff4d4d] font-bold",
    identityPreviewText: "text-white",
    identityPreviewEditButtonIcon: "text-neutral-400",
    formButtonPrimary:
      "bg-[#ff3b3b] w-full hover:bg-[#ff4d4d] text-white font-black tracking-widest uppercase text-xs py-3 rounded-lg transition-colors mt-2",
  },
};

const clerkOptionsStr = JSON.stringify(clerkAppearance);

// Suppress favicon 404 in console if missing (though we will use logo.png)
app.get("/favicon.ico", (req, res) => res.status(204).end());

// Protected UI Routes - using Clerk requireAuth
app.get("/sign-in", (req, res) => {
  res.send(`
        <html>
            <head>
                <meta charset="utf-8" />
                <meta content="width=device-width, initial-scale=1.0" name="viewport" />
                <title>Sign In - Attendify</title>
                <script src="https://cdn.tailwindcss.com"></script>
                <link rel="icon" href="/logo.png" type="image/png">
                <style>
                    * { font-family: 'Inter', sans-serif; }
                    /* Safely hide Clerk branding */
                    .cl-internal-b3al6g { display: none !important; opacity: 0 !important; visibility: hidden !important; pointer-events: none !important; }
                    a[href*="clerk.com"] { display: none !important; opacity: 0 !important; visibility: hidden !important; pointer-events: none !important; }
                </style>
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
            </head>
            <body class="bg-[#050505] text-white flex flex-col items-center justify-center min-h-screen p-6 sm:p-10">
                <div class="w-full max-w-[400px] mx-auto flex flex-col items-center">
                    <div class="mb-8 flex flex-col items-center text-center">
                        <div class="w-16 h-16 rounded-2xl bg-[#141414] border border-[#2a2a2a] mb-5 flex items-center justify-center overflow-hidden shadow-[0_0_20px_rgba(255,59,59,0.15)]">
                            <img src="/logo.png" alt="Attendify Logo" class="w-12 h-12 object-contain" />
                        </div>
                        <h1 class="text-3xl font-black text-white tracking-[0.2em] uppercase">Attendify</h1>
                        <p class="text-neutral-500 text-sm mt-3 font-medium">Sign in to sync your attendance portal.</p>
                    </div>
                    <div id="sign-in" class="w-full"></div>
                </div>
                <script>
                    // Force localhost instead of 127.0.0.1 for Clerk dev cookies to work reliably
                    if (window.location.hostname === '127.0.0.1') {
                        window.location.replace(window.location.href.replace('127.0.0.1', 'localhost'));
                    }

                    async function initClerk() {
                        if (typeof Clerk === 'undefined') {
                            setTimeout(initClerk, 100);
                            return;
                        }
                        await Clerk.load();

                        // If user is already signed in, go to dashboard
                        if (Clerk.user) {
                            window.location.href = '/';
                            return;
                        }

                        // CRITICAL: Detect hash-based SSO callback from OAuth providers
                        // Clerk redirects back to /sign-in#/sso-callback?... after Google auth
                        // We must call handleRedirectCallback instead of mounting SignIn
                        const hash = window.location.hash;
                        if (hash && hash.includes('/sso-callback')) {
                            try {
                                await Clerk.handleRedirectCallback({
                                    afterSignInUrl: '/',
                                    afterSignUpUrl: '/',
                                    redirectUrl: '/'
                                });
                            } catch (err) {
                                console.error('SSO callback error:', err);
                                // If callback fails, clear hash and show sign-in form
                                window.location.hash = '';
                                window.location.reload();
                            }
                            return;
                        }

                        Clerk.mountSignIn(document.getElementById('sign-in'), {
                           appearance: ${clerkOptionsStr},
                           signUpUrl: '/sign-up',
                           fallbackRedirectUrl: '/'
                        });
                        // Use MutationObserver instead of setInterval — fires once on DOM change, no leak
                        const _hideClerkBranding = () => {
                            document.querySelectorAll('.cl-internal-b3al6g, a[href*="clerk.com"]').forEach(el => {
                                el.style.cssText += 'display:none!important;opacity:0!important;pointer-events:none!important;';
                            });
                        };
                        _hideClerkBranding();
                        const _brandObserver = new MutationObserver(_hideClerkBranding);
                        _brandObserver.observe(document.body, { childList: true, subtree: true });
                        // Disconnect after 10 seconds — Clerk UI is fully rendered by then
                        setTimeout(() => _brandObserver.disconnect(), 10000);
                    }
                </script>
                <script crossorigin="anonymous"
                    data-clerk-publishable-key="${CLERK_PUBLISHABLE_KEY}"
                    src="https://bright-moray-2.clerk.accounts.dev/npm/@clerk/clerk-js@5/dist/clerk.browser.js"
                    onload="initClerk()"
                    type="text/javascript"></script>
            </body>
        </html>
    `);
});

app.get("/sign-up", (req, res) => {
  res.send(`
        <html>
            <head>
                <meta charset="utf-8" />
                <meta content="width=device-width, initial-scale=1.0" name="viewport" />
                <title>Sign Up - Attendify</title>
                <script src="https://cdn.tailwindcss.com"></script>
                <link rel="icon" href="/logo.png" type="image/png">
                <style>
                    * { font-family: 'Inter', sans-serif; }
                    /* Safely hide Clerk branding */
                    .cl-internal-b3al6g { display: none !important; opacity: 0 !important; visibility: hidden !important; pointer-events: none !important; }
                    a[href*="clerk.com"] { display: none !important; opacity: 0 !important; visibility: hidden !important; pointer-events: none !important; }
                </style>
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
            </head>
            <body class="bg-[#050505] text-white flex flex-col items-center justify-center min-h-screen p-6 sm:p-10">
                <div class="w-full max-w-[400px] mx-auto flex flex-col items-center">
                    <div class="mb-8 flex flex-col items-center text-center">
                        <div class="w-16 h-16 rounded-2xl bg-[#141414] border border-[#2a2a2a] mb-5 flex items-center justify-center overflow-hidden shadow-[0_0_20px_rgba(255,59,59,0.15)]">
                            <img src="/logo.png" alt="Attendify Logo" class="w-12 h-12 object-contain" />
                        </div>
                        <h1 class="text-3xl font-black text-white tracking-[0.2em] uppercase">Attendify</h1>
                        <p class="text-neutral-500 text-sm mt-3 font-medium">Create an account to track your attendance.</p>
                    </div>
                    <div id="sign-up" class="w-full"></div>
                </div>
                <script>
                    // Force localhost instead of 127.0.0.1 for Clerk dev cookies to work reliably
                    if (window.location.hostname === '127.0.0.1') {
                        window.location.replace(window.location.href.replace('127.0.0.1', 'localhost'));
                    }

                    async function initClerk() {
                        if (typeof Clerk === 'undefined') {
                            setTimeout(initClerk, 100);
                            return;
                        }
                        await Clerk.load();

                        // If user is already signed in, go to dashboard
                        if (Clerk.user) {
                            window.location.href = '/';
                            return;
                        }

                        // CRITICAL: Detect hash-based SSO callback from OAuth providers
                        const hash = window.location.hash;
                        if (hash && hash.includes('/sso-callback')) {
                            try {
                                await Clerk.handleRedirectCallback({
                                    afterSignInUrl: '/',
                                    afterSignUpUrl: '/',
                                    redirectUrl: '/'
                                });
                            } catch (err) {
                                console.error('SSO callback error:', err);
                                window.location.hash = '';
                                window.location.reload();
                            }
                            return;
                        }

                        Clerk.mountSignUp(document.getElementById('sign-up'), {
                           appearance: ${clerkOptionsStr},
                           signInUrl: '/sign-in',
                           fallbackRedirectUrl: '/'
                        });
                        // Use MutationObserver instead of setInterval — fires once on DOM change, no leak
                        const _hideClerkBranding = () => {
                            document.querySelectorAll('.cl-internal-b3al6g, a[href*="clerk.com"]').forEach(el => {
                                el.style.cssText += 'display:none!important;opacity:0!important;pointer-events:none!important;';
                            });
                        };
                        _hideClerkBranding();
                        const _brandObserver = new MutationObserver(_hideClerkBranding);
                        _brandObserver.observe(document.body, { childList: true, subtree: true });
                        // Disconnect after 10 seconds — Clerk UI is fully rendered by then
                        setTimeout(() => _brandObserver.disconnect(), 10000);
                    }
                </script>
                <script crossorigin="anonymous"
                    data-clerk-publishable-key="${CLERK_PUBLISHABLE_KEY}"
                    src="https://bright-moray-2.clerk.accounts.dev/npm/@clerk/clerk-js@5/dist/clerk.browser.js"
                    onload="initClerk()"
                    type="text/javascript"></script>
            </body>
        </html>
    `);
});

app.get("/sso-callback", (req, res) => {
  res.send(`
        <html>
            <head>
                <meta charset="utf-8" />
                <title>Authenticating...</title>
                <script src="https://cdn.tailwindcss.com"></script>
                <style>
                    body { background: #050505; color: white; display: flex; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; }
                    .loader { border: 4px solid #1f1f1f; border-top: 4px solid #ff3b3b; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; }
                    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                </style>
            </head>
            <body>
                <div class="flex flex-col items-center gap-4">
                    <div class="loader"></div>
                    <p class="text-sm font-bold tracking-widest uppercase text-neutral-400">Verifying...</p>
                </div>
                <script>
                    if (window.location.hostname === '127.0.0.1') window.location.hostname = 'localhost';

                    async function processSSO() {
                        if (typeof Clerk === 'undefined') {
                            setTimeout(processSSO, 100);
                            return;
                        }
                        await Clerk.load();
                        Clerk.handleRedirectCallback({
                            afterSignInUrl: '/',
                            afterSignUpUrl: '/',
                            redirectUrl: '/'
                        });
                    }
                </script>
                <script crossorigin="anonymous"
                    data-clerk-publishable-key="${CLERK_PUBLISHABLE_KEY}"
                    src="https://bright-moray-2.clerk.accounts.dev/npm/@clerk/clerk-js@5/dist/clerk.browser.js"
                    onload="processSSO()"
                    type="text/javascript"></script>
            </body>
        </html>
    `);
});

// Start server
app.listen(PORT, () => {
  console.log(`Attendify server running on http://localhost:${PORT}`);
});
