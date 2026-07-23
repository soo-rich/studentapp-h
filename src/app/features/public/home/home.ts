import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { RouterLink } from '@angular/router';

/**
 * Page d'accueil publique — points d'entrée vers les inscriptions étudiant/recruteur et
 * vers la connexion partagée (Épic 1).
 */
@Component({
  selector: 'app-home',
  imports: [MatButtonModule, MatCardModule, RouterLink],
  templateUrl: './home.html',
})
export class Home {}
