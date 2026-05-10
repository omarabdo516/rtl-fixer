// Three-step onboarding tour. Bound to first-launch state (loaded by
// widgetWindow when settings.onboardingCompleted === false).

const TOTAL_STEPS = 3;

const $steps = document.querySelectorAll<HTMLElement>('.tour-step');
const $dots = document.querySelectorAll<HTMLElement>('.dot');
const $next = document.getElementById('tour-next') as HTMLButtonElement | null;
const $skip = document.getElementById('tour-skip') as HTMLButtonElement | null;

if (!$next || !$skip) {
  throw new Error('tour.ts: missing required DOM elements');
}

let currentStep = 1;

const $tour = document.getElementById('tour');

function showStep(step: number): void {
  $steps.forEach((el) => {
    if (Number(el.dataset.step) === step) {
      el.removeAttribute('hidden');
    } else {
      el.setAttribute('hidden', '');
    }
  });
  $dots.forEach((dot) => {
    dot.classList.toggle('is-active', Number(dot.dataset.stepDot) === step);
  });
  $next!.textContent = step === TOTAL_STEPS ? 'يلا نبدأ' : 'التالي';
  // Update aria-labelledby so screen readers announce the active step heading
  $tour?.setAttribute('aria-labelledby', `tour-step-${step}-heading`);
  // Move focus to the primary action to keep keyboard flow tight
  $next!.focus();
}

function complete(): void {
  void window.api.app.completeOnboarding();
}

$next.addEventListener('click', () => {
  if (currentStep < TOTAL_STEPS) {
    currentStep += 1;
    showStep(currentStep);
  } else {
    complete();
  }
});

$skip.addEventListener('click', () => {
  complete();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    complete();
    return;
  }
  if (e.key === 'Enter') {
    $next!.click();
    return;
  }
  // Trap Tab inside the tour dialog (only Skip and Next are focusable)
  if (e.key === 'Tab') {
    const focusables = [$skip!, $next!];
    const activeIdx = focusables.indexOf(document.activeElement as HTMLButtonElement);
    if (activeIdx === -1) {
      e.preventDefault();
      $next!.focus();
      return;
    }
    if (e.shiftKey && activeIdx === 0) {
      e.preventDefault();
      focusables[focusables.length - 1]!.focus();
    } else if (!e.shiftKey && activeIdx === focusables.length - 1) {
      e.preventDefault();
      focusables[0]!.focus();
    }
  }
});

showStep(1);
