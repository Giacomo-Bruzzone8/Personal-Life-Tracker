import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Navbar } from './ui/navbar/navbar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, TranslateModule, Navbar],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  constructor(private translate: TranslateService) {
    this.translate.addLangs(['it', 'en']);
    this.translate.setFallbackLang('it');
    this.translate.use('en');
  }
}
