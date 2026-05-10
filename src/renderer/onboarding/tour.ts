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
  } else if (e.key === 'Enter') {
    $next!.click();
  }
});

showStep(1);
