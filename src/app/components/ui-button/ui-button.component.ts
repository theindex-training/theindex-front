import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-ui-button',
  standalone: true,
  templateUrl: './ui-button.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './ui-button.component.scss',
})
export class UiButtonComponent {
  @Input() type: 'button' | 'submit' = 'button';
  @Input() variant: 'primary' | 'secondary' = 'primary';
}
