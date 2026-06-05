import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-viewer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="px-8 py-8">
      <h1 class="font-serif text-2xl">Review</h1>
      <p class="text-ink-muted text-sm mt-1">Document id: {{ id() }}</p>
    </section>
  `,
})
export class ViewerPage {
  id = input.required<string>();
}
