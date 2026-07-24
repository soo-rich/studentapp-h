import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

/**
 * Layout de l'espace étudiant (accès protégé par `roleGuard('etudiant')`, voir
 * `app.routes.ts`). Mobile-first : une colonne, header collant en haut, contenu qui ne
 * déborde jamais horizontalement.
 *
 * Barre de navigation secondaire (Épic 3) : accès direct à `offres`/`candidatures` depuis
 * n'importe quel écran de l'espace étudiant — `RouterLinkActive` marque l'onglet courant.
 */
@Component({
  selector: 'app-etudiant-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatToolbarModule, MatIconModule],
  templateUrl: './etudiant-layout.html',
})
export class EtudiantLayout {}
