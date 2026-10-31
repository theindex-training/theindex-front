import { Component, EventEmitter, Input, Output } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

let nextId = 0;

/** Search input with a leading icon. Use with [(value)]; emits on every keystroke. */
@Component({
  selector: 'app-search-field',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './search-field.component.html',
  styleUrl: './search-field.component.scss'
})
export class SearchFieldComponent {
  /** Accessible label (visually hidden), e.g. "Search trainees". */
  @Input({ required: true }) label = '';
  @Input() placeholder = 'Search';
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
