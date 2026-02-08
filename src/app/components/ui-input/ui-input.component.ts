import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-ui-input',
  standalone: true,
  templateUrl: './ui-input.component.html',
  styleUrl: './ui-input.component.scss'
})
export class UiInputComponent {
  @Input({ required: true }) id = '';
  @Input({ required: true }) label = '';
  @Input() type: 'text' | 'email' | 'password' = 'text';
  @Input() placeholder = '';
  @Input() autocomplete = '';
}
