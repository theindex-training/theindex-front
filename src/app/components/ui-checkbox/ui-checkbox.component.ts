import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-ui-checkbox',
  standalone: true,
  templateUrl: './ui-checkbox.component.html',
  styleUrl: './ui-checkbox.component.scss'
})
export class UiCheckboxComponent {
  @Input({ required: true }) id = '';
  @Input({ required: true }) label = '';
}
