import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';

/**
 * Page d'accueil publique — placeholder (Épic 0). Le formulaire d'inscription/connexion
 * arrive en Épic 1 (`/auth/register`, `/auth/login` côté `studentapi`).
 */
@Component({
  selector: 'app-home',
  imports: [MatButtonModule, MatCardModule],
  templateUrl: './home.html',
})
export class Home {}
