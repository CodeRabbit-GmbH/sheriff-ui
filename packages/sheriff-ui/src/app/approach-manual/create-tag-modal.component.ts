import {
  Component,
  computed,
  inject,
  signal,
  ViewEncapsulation,
  ElementRef,
  viewChild,
  afterNextRender,
  ChangeDetectionStrategy,
} from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';

export interface TagCreatedEvent {
  tag: string;
}

const DEFAULT_KINDS = ['type', 'domain', 'shared', 'feature', 'scope'];

@Component({
  selector: 'app-create-tag-modal',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `
    <dialog #dialogRef class="modal modal-open">
      <div class="modal-box">
        <h3 class="text-lg font-bold">Create New Tag</h3>
        <p class="text-sm opacity-60 mt-1">
          Assigns the new tag to the selected module.
        </p>

        <div class="py-4 space-y-4">
          <div class="form-control w-full">
            <label class="label">
              <span class="label-text font-medium">Kind (prefix)</span>
            </label>
            <select
              class="select select-bordered w-full"
              [value]="kind()"
              (change)="kind.set($any($event.target).value)"
            >
              @for (k of kinds(); track k) {
                <option [value]="k">{{ k }}</option>
              }
              <option value="custom">(custom - no prefix)</option>
            </select>
          </div>

          <div class="form-control w-full">
            <label class="label">
              <span class="label-text font-medium">Value</span>
            </label>
            <input
              #tagInput
              data-testid="modal-new-tag-input"
              type="text"
              class="input input-bordered w-full"
              placeholder="e.g. auth, users, core"
              [value]="value()"
              (input)="value.set($any($event.target).value || '')"
              (keydown.enter)="confirm()"
            />
          </div>

          <div class="bg-base-200 rounded-lg px-4 py-3">
            <span class="text-xs opacity-60">Preview: </span>
            <span class="font-mono text-sm font-semibold text-primary">
              {{ preview() }}
            </span>
          </div>
        </div>

        <div class="modal-action">
          <button type="button" class="btn btn-ghost" (click)="close()">
            Cancel
          </button>
          <button
            data-testid="modal-create-tag-btn"
            type="button"
            class="btn btn-primary"
            [disabled]="!value().trim()"
            (click)="confirm()"
          >
            Create Tag
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button (click)="close()">close</button>
      </form>
    </dialog>
  `,
})
export class CreateTagModalComponent {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private dialogRef = viewChild<ElementRef<HTMLDialogElement>>('dialogRef');
  private tagInput = viewChild<ElementRef<HTMLInputElement>>('tagInput');

  protected kinds = signal<string[]>(DEFAULT_KINDS);
  protected kind = signal<string>(DEFAULT_KINDS[0]);
  protected value = signal('');

  protected preview = computed(() => {
    const k = this.kind();
    const v = this.value().trim();
    if (!v) return '(enter a value)';
    return k === 'custom' ? v : `${k}:${v}`;
  });

  constructor() {
    const params = this.route.snapshot.queryParams;
    if (params['kinds']) {
      try {
        const parsed = JSON.parse(params['kinds']);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const merged = [...new Set([...parsed, ...DEFAULT_KINDS])];
          this.kinds.set(merged);
          this.kind.set(merged[0]);
        }
      } catch {
        // noop
      }
    }

    afterNextRender(() => {
      this.dialogRef()?.nativeElement?.showModal();
      this.tagInput()?.nativeElement?.focus();
    });
  }

  protected close(): void {
    this.dialogRef()?.nativeElement?.close();
    this.router.navigate([{ outlets: { popup: null } }], {
      relativeTo: this.route.parent,
      queryParams: {},
    });
  }

  protected confirm(): void {
    const v = this.value().trim();
    if (!v) return;

    const tag = this.kind() === 'custom' ? v : `${this.kind()}:${v}`;

    window.dispatchEvent(
      new CustomEvent<TagCreatedEvent>('tagCreated', {
        bubbles: true,
        detail: { tag },
      })
    );

    this.close();
  }
}
