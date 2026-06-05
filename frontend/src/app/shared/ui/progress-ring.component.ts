import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-progress-ring',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="inline-flex items-center gap-2" [attr.aria-label]="ariaLabel()">
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
        <circle cx="11" cy="11" r="9" stroke="var(--border)" stroke-width="2" fill="none" />
        <circle
          cx="11"
          cy="11"
          r="9"
          stroke="var(--accent)"
          stroke-width="2"
          fill="none"
          stroke-linecap="round"
          transform="rotate(-90 11 11)"
          [attr.stroke-dasharray]="circumference"
          [attr.stroke-dashoffset]="offset()"
        />
      </svg>
      <span class="text-xs text-ink-muted tabular-nums font-mono">
        {{ labeled() }}/{{ total() }}
      </span>
    </div>
  `,
})
export class ProgressRingComponent {
  labeled = input.required<number>();
  total = input.required<number>();

  readonly circumference = 2 * Math.PI * 9;

  offset = computed(() => {
    const t = this.total() || 1;
    return this.circumference * (1 - this.labeled() / t);
  });

  ariaLabel = computed(() => `${this.labeled()} of ${this.total()} sentences labelled`);
}
