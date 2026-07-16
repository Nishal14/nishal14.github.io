// Click-to-enter intro gate (only present on the home page). The
// skip-intro class is set synchronously in an inline <script> at the top of
// <body>, before this overlay is even parsed, so there's never a flash of it
// when arriving via index.html#hero (e.g. clicking the logo from another page).
const introOverlay = document.getElementById('intro-overlay');
if (introOverlay) {
    if (document.documentElement.classList.contains('skip-intro')) {
        introOverlay.remove();
        document.documentElement.classList.add('hero-animations-active');
    } else {
        const dismissIntro = () => {
            document.body.classList.remove('intro-pending');
            introOverlay.classList.add('intro-hidden');
            introOverlay.removeEventListener('click', dismissIntro);
            introOverlay.removeEventListener('keydown', handleIntroKey);
            setTimeout(() => introOverlay.remove(), 1300);
            // The comet/telescope sequence should only start once the
            // visitor can actually see the hero, not while it was hidden
            // behind the intro gate.
            document.documentElement.classList.add('hero-animations-active');
        };
        const handleIntroKey = (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                dismissIntro();
            }
        };
        introOverlay.addEventListener('click', dismissIntro);
        introOverlay.addEventListener('keydown', handleIntroKey);
    }
}

// Smooth cross-page transitions: fade the current page out, then navigate.
// The next page fades itself in on load (see the .page-fade-in rule in CSS).
const isHomePage = /\/(index\.html)?$/.test(window.location.pathname);

document.querySelectorAll('.nav-logo, .nav-link').forEach((link) => {
    if (link.target === '_blank') return;
    const href = link.getAttribute('href');
    if (!href) return;

    link.addEventListener('click', (e) => {
        // Logo, already on the home page: just reveal the hero directly,
        // no real navigation happens so there's nothing to fade.
        if (link.classList.contains('nav-logo') && isHomePage) {
            e.preventDefault();
            const overlay = document.getElementById('intro-overlay');
            if (overlay) {
                document.body.classList.remove('intro-pending');
                overlay.remove();
            }
            return;
        }

        e.preventDefault();
        document.body.classList.add('page-leaving');
        requestAnimationFrame(() => {
            document.body.classList.add('page-leaving-active');
        });
        setTimeout(() => { window.location.href = href; }, 350);
    });
});

// Fixed navigation with cursor proximity detection
const fixedNav = document.getElementById('fixedNav');

window.addEventListener('mousemove', (e) => {
    if (fixedNav) {
        if (e.clientY < 100) {
            fixedNav.classList.add('visible');
        } else {
            fixedNav.classList.remove('visible');
        }
    }
});

// Scroll-reveal for content sections
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const revealSections = document.querySelectorAll('.content-wrapper section');

if (!prefersReducedMotion && 'IntersectionObserver' in window) {
    revealSections.forEach(section => section.classList.add('reveal'));

    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                revealObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });

    revealSections.forEach(section => revealObserver.observe(section));
}
