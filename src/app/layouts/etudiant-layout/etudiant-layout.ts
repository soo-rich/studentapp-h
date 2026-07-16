import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterOutlet } from '@angular/router';

/**
 * Layout de l'espace étudiant (accès protégé par `roleGuard('etudiant')`, voir
 * `app.routes.ts`). Mobile-first : une colonne, header collant en haut, contenu qui ne
 * déborde jamais horizontalement.
 */
@Component({
  selector: 'app-etudiant-layout',
  imports: [RouterOutlet, RouterLink, MatToolbarModule, MatIconModule],
  templateUrl: './etudiant-layout.html',
})
export class EtudiantLayout {}
