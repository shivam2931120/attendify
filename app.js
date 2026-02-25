require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { clerkMiddleware } = require('@clerk/express');


const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes — Clerk middleware applied only here so API reads req.auth.userId
app.use('/api', clerkMiddleware(), apiRoutes);

// Serve static assets (JS, CSS, images, manifest, service-worker)
app.use(express.static(path.join(__dirname, 'public')));

// UI Routes — auth enforced client-side by Clerk.js on each page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/subjects', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'subjects.html'));
});
app.get('/calendar', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'calendar.html'));
});
app.get('/calculator', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'calculator.html'));
});
app.get('/profile', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});
app.get('/analytics', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'analytics.html'));
});
app.get('/subject-details', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'subject-details.html'));
});

const clerkAppearance = {
    layout: {
        logoPlacement: 'none',
        socialButtonsVariant: 'blockButton'
    },
    variables: {
        colorPrimary: '#ff3b3b',
        colorBackground: '#0d0d0d',
        colorText: 'white',
        colorDanger: '#ff3b3b',
        colorInputBackground: '#1f1f1f',
        colorInputText: 'white',
    },
    elements: {
        rootBox: 'w-full',
        card: 'bg-transparent shadow-none p-0 w-full max-w-sm mx-auto border-none sm:bg-[#0d0d0d] sm:border sm:border-[#1f1f1f] sm:shadow-2xl sm:p-8 sm:rounded-2xl',
        headerTitle: 'hidden',
        headerSubtitle: 'hidden',
        socialButtonsBlockButton: 'text-white border border-[#2a2a2a] bg-[#141414] hover:bg-[#1f1f1f] flex justify-center py-2.5 rounded-lg shadow-sm transition-all',
        socialButtonsBlockButtonText: 'text-white font-semibold',
        dividerRow: 'border-[#2a2a2a]',
        dividerText: 'text-neutral-500 font-medium',
        formFieldLabel: 'text-neutral-400 font-bold text-[10px] uppercase tracking-wider mb-1',
        formFieldInput: 'bg-[#141414] border-[#2a2a2a] text-white rounded-lg px-3 py-2.5 focus:border-[#ff3b3b] focus:ring-1 focus:ring-[#ff3b3b] transition-all',
        footerActionText: 'text-neutral-400',
        footerActionLink: 'text-[#ff3b3b] hover:text-[#ff4d4d] font-bold',
        identityPreviewText: 'text-white',
        identityPreviewEditButtonIcon: 'text-neutral-400',
        formButtonPrimary: 'bg-[#ff3b3b] w-full hover:bg-[#ff4d4d] text-white font-black tracking-widest uppercase text-xs py-3 rounded-lg transition-colors mt-2',
    }
};

const clerkOptionsStr = JSON.stringify(clerkAppearance);

// Suppress favicon 404 in console if missing (though we will use logo.png)
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Protected UI Routes - using Clerk requireAuth
app.get('/sign-in', (req, res) => {
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
                    async function initClerk() {
                        if (typeof Clerk === 'undefined') {
                            // Clerk script not loaded yet — retry
                            setTimeout(initClerk, 100);
                            return;
                        }
                        await Clerk.load();
                        if (Clerk.user) {
                            window.location.href = '/';
                            return;
                        }
                        Clerk.mountSignIn(document.getElementById('sign-in'), {
                           appearance: ${clerkOptionsStr},
                           signUpUrl: '/sign-up'
                        });
                        setInterval(() => {
                            document.querySelectorAll('.cl-internal-b3al6g').forEach(el => { el.style.display = 'none'; el.style.opacity = '0'; });
                            document.querySelectorAll('a[href*="clerk.com"]').forEach(el => { el.style.display = 'none'; el.style.opacity = '0'; });
                        }, 500);
                    }
                </script>
                <script crossorigin="anonymous"
                    data-clerk-publishable-key="${process.env.CLERK_PUBLISHABLE_KEY}"
                    src="https://bright-moray-2.clerk.accounts.dev/npm/@clerk/clerk-js@5/dist/clerk.browser.js"
                    onload="initClerk()"
                    type="text/javascript"></script>
            </body>
        </html>
    `);
});

app.get('/sign-up', (req, res) => {
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
                    async function initClerk() {
                        if (typeof Clerk === 'undefined') {
                            setTimeout(initClerk, 100);
                            return;
                        }
                        await Clerk.load();
                        if (Clerk.user) {
                            window.location.href = '/';
                            return;
                        }
                        Clerk.mountSignUp(document.getElementById('sign-up'), {
                           appearance: ${clerkOptionsStr},
                           signInUrl: '/sign-in'
                        });
                        setInterval(() => {
                            document.querySelectorAll('.cl-internal-b3al6g').forEach(el => { el.style.display = 'none'; el.style.opacity = '0'; });
                            document.querySelectorAll('a[href*="clerk.com"]').forEach(el => { el.style.display = 'none'; el.style.opacity = '0'; });
                        }, 500);
                    }
                </script>
                <script crossorigin="anonymous"
                    data-clerk-publishable-key="${process.env.CLERK_PUBLISHABLE_KEY}"
                    src="https://bright-moray-2.clerk.accounts.dev/npm/@clerk/clerk-js@5/dist/clerk.browser.js"
                    onload="initClerk()"
                    type="text/javascript"></script>
            </body>
        </html>
    `);
});


// Start server
app.listen(PORT, () => {
    console.log(`Attendify server running on http://localhost:${PORT}`);
});
