import { Component, EventEmitter, Input, Output } from '@angular/core';

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: string;
}

let nextId = 0;

/**
 * Single-choice segmented control, e.g. All / Active / Inactive. Built on native radios, so it is
 * announced as a group and arrow keys move the selection. Use with [(value)].
 */
@Component({
  selector: 'app-segmented-control',
  standalone: true,
  templateUrl: './segmented-control.component.html',
  styleUrl: './segmented-control.component.scss'
})
export class SegmentedControlComponent<T extends string = string> {
  /** Accessible name of the group (visually hidden), e.g. "Status". */
  @Input({ required: true }) label = '';
  @Input({ required: true }) options: SegmentedOption<T>[] = [];
  @Input({ required: true }) value!: T;
  @Output() readonly valueChange = new EventEmitter<T>();

  readonly name = `segmented-${nextId++}`;

  select(value: T): void {
    if (value !== this.value) {
      this.value = value;
      this.valueChange.emit(value);
    }
  }
}
