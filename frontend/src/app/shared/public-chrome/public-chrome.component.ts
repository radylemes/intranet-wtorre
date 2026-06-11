import { Component } from '@angular/core';
import { HeaderComponent } from '../header/header.component';
import { TopbarComponent } from '../topbar/topbar.component';

@Component({
  selector: 'app-public-chrome',
  standalone: true,
  imports: [HeaderComponent, TopbarComponent],
  templateUrl: './public-chrome.component.html',
  styleUrl: './public-chrome.component.scss',
})
export class PublicChromeComponent {}
