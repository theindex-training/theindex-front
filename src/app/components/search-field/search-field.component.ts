import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { IconComponent } from '../icon/icon.component';

let nextId = 0;

/** Search input with a leading icon. Use with [(value)]; emits on every keystroke. */
@Component({
  selector: 'app-search-field',
  standalone: true,
  imports: [TranslocoPipe, IconComponent],
  templateUrl: './search-field.component.html',
  styleUrl: './search-field.component.scss'
})
export class SearchFieldComponent {
  /** Accessible label (visually hidden, already translated), e.g. "Search trainees". */
  @Input({ required: true }) label = '';
  /** Defaults to the translated "Search". */
  @Input() placeholder = '';
  @Input() value = '';
  @Output() readonly valueChange = new EventEmitter<string>();

  readonly id = `search-field-${nextId++}`;

  clear(input: HTMLInputElement): void {
    this.value = '';
    this.valueChange.emit('');
    input.focus();
  }

  handleInput(event: Event): void {
    this.value = (event.target as HTMLInputElement).value;
    this.valueChange.emit(this.value);
  }
}
