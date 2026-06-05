import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <div class="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-center">
      <h1 class="font-serif text-2xl">This contract doesn't exist.</h1>
      <p class="text-ink-muted">It may have been removed or the link is wrong.</p>
      <a routerLink="/" class="text-accent hover:underline">← Back to Contracts</a>
    </div>
  `,
})
export class NotFoundPage {}
