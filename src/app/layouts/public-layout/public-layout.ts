import { Component } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterOutlet } from '@angular/router';

/**
 * Layout de l'espace public (accueil, à terme login/register en Épic 1).
 * Mobile-first : une colonne, header collant en haut, contenu qui ne déborde jamais
 * horizontalement.
 */
@Component({
  selector: 'app-public-layout',
  imports: [RouterOutlet, RouterLink, MatToolbarModule],
  templateUrl: './public-layout.html',
})
export class PublicLayout {}
